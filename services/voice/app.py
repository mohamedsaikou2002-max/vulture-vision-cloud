"""Public, bounded WAV gateway. Keep the inference engine on loopback."""
import asyncio
import io
import os
import wave
import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=[s for s in os.getenv('VOICE_ALLOWED_ORIGINS','http://localhost:5173').split(',') if s],allow_methods=['POST','GET'],allow_headers=['authorization','content-type'])
slots=asyncio.Semaphore(2)
MAX_BYTES=1_000_000

def validate_wav(data):
    try:
        with wave.open(io.BytesIO(data),'rb') as audio:
            frames=audio.getnframes()
            if audio.getnchannels()!=1 or audio.getsampwidth()!=2 or audio.getframerate()!=16000 or not 8000<=frames<=480000 or len(audio.readframes(frames))!=frames*2:
                raise ValueError()
            return frames/16000
    except (wave.Error, EOFError, ValueError): raise HTTPException(422,'Expected 0.5–30 seconds of mono 16 kHz PCM WAV')

@app.get('/health')
async def health():
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r=await client.get(os.getenv('WHISPER_URL','http://127.0.0.1:8080')+'/health')
        ready=r.status_code==200
    except httpx.HTTPError:ready=False
    return {'status':'ready' if ready else 'unavailable','engine':'whisper.cpp'}

@app.post('/api/voice/transcribe')
async def transcribe(request:Request):
    if request.headers.get('content-type','').split(';')[0]!='audio/wav':raise HTTPException(415,'Send audio/wav')
    data=bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data)>MAX_BYTES:raise HTTPException(413,'Audio exceeds 30 seconds')
    duration=validate_wav(data)
    try:
        await asyncio.wait_for(slots.acquire(),timeout=.1)
    except TimeoutError:raise HTTPException(429,'Transcription is busy; try again shortly')
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r=await client.post(os.getenv('WHISPER_URL','http://127.0.0.1:8080')+'/inference',files={'file':('speech.wav',bytes(data),'audio/wav')},data={'response_format':'json','temperature':'0.0','no_context':'true'})
        if r.status_code!=200:raise HTTPException(503,'Speech engine is unavailable')
        text=r.json().get('text','')
        if not isinstance(text,str) or len(text)>2000:raise HTTPException(502,'Invalid transcription')
        # Whisper text is not accompanied by a calibrated probability.
        return {'text':text.strip(),'engine':'whisper.cpp','confidence':None,'duration_seconds':duration}
    except (httpx.HTTPError, ValueError):raise HTTPException(503,'Speech engine is unavailable')
    finally:slots.release()
