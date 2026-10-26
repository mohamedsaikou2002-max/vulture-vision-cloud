import io
import unittest
import wave
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from services.voice.app import app, validate_wav
from fastapi import HTTPException

def wav(seconds=1, rate=16000):
    output=io.BytesIO()
    with wave.open(output,'wb') as audio:
        audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(rate);audio.writeframes(b'\0\0'*int(rate*seconds))
    return output.getvalue()

class VoiceTests(unittest.TestCase):
    def test_valid_audio_and_rejected_malformed_duration(self):
        self.assertEqual(validate_wav(wav()),1)
        for data in [b'broken',wav(.1),wav(31),wav(1,44100)]:
            with self.assertRaises(HTTPException):validate_wav(data)

    def test_invalid_audio_never_calls_engine(self):
        with patch('httpx.AsyncClient.post',new=AsyncMock()) as infer:
            result=TestClient(app).post('/api/voice/transcribe',content=b'broken',headers={'content-type':'audio/wav'})
        self.assertEqual(result.status_code,422)
        infer.assert_not_called()

    def test_public_inference_without_auth_or_billing(self):
        import httpx
        response=httpx.Response(200,json={'text':'  A funding crisis  '})
        with patch('httpx.AsyncClient.get',new=AsyncMock()) as identity,patch('httpx.AsyncClient.post',new=AsyncMock(return_value=response)) as infer:
            result=TestClient(app).post('/api/voice/transcribe',content=wav(),headers={'content-type':'audio/wav'})
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['text'],'A funding crisis')
        self.assertIsNone(result.json()['confidence'])
        self.assertEqual(infer.call_count,1)
        identity.assert_not_called()

    def test_engine_health_does_not_require_supabase(self):
        import httpx
        with patch.dict('os.environ',{'SUPABASE_URL':'','SUPABASE_ANON_KEY':''}),patch('httpx.AsyncClient.get',new=AsyncMock(return_value=httpx.Response(200))):
            result=TestClient(app).get('/health')
        self.assertEqual(result.json()['status'],'ready')
