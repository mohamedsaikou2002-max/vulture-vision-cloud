import { workspaceSession } from '@/lib/workspaceSession';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { backendOrigin } from '@/lib/backendOrigin';
import { pcmWav } from '@/lib/speechAudio';
import type { VoiceOptions } from './useVoiceInput';

const origin=backendOrigin(import.meta.env.VITE_VOICE_HOST, false, 8090, typeof location!=='undefined' && location.protocol==='https:');
export const whisperConfigured=!!origin;
export function useWhisperInput({onFinal}:VoiceOptions){
  const [listening,setListening]=useState(false),[processing,setProcessing]=useState(false),[error,setError]=useState('');
  const callback=useRef(onFinal);callback.current=onFinal;
  const recording=useRef<{context:AudioContext;stream:MediaStream;node:ScriptProcessorNode;input:MediaStreamAudioSourceNode;chunks:Float32Array[];speech:boolean;lastSpeech:number;started:number}|null>(null);
  const abort=useRef<AbortController|null>(null), alive=useRef(true), starting=useRef(false);
  const dispose=useCallback(()=>{const r=recording.current;if(!r)return null;recording.current=null;r.node.onaudioprocess=null;r.node.disconnect();r.input.disconnect();r.stream.getTracks().forEach(t=>t.stop());void r.context.close();return r;},[]);
  const stop=useCallback(async()=>{
    const r=dispose();if(!r)return;
    setListening(false);
    if(!r.speech){setError('No speech detected. Tap the microphone and try again.');return;}
    setProcessing(true);
    const controller=new AbortController();abort.current=controller;
    try{
      const session=await workspaceSession(supabase);if(!session)throw new Error('Workspace session is unavailable.');
      const response=await fetch(`${origin}/api/voice/transcribe`,{method:'POST',headers:{'Content-Type':'audio/wav',Authorization:`Bearer ${session.access_token}`},body:pcmWav(r.chunks,r.context.sampleRate),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(65000)])});
      if(!response.ok)throw new Error(response.status===429?'Speech server is busy. Try again shortly.':'Speech server unavailable. Your scenario has been retained.');
      const data=await response.json();if(typeof data.text!=='string'||data.text.length>2000)throw new Error('Invalid speech response');
      if(alive.current && data.text.trim())callback.current(data.text.trim(),0);
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Transcription failed');}
    finally{if(alive.current)setProcessing(false);}
  },[dispose]);
  const stopRef=useRef(stop);stopRef.current=stop;
  const start=useCallback(async()=>{
    if(recording.current||starting.current||processing)return;
    starting.current=true;setError('');
    let stream:MediaStream|null=null,context:AudioContext|null=null;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(!alive.current){stream.getTracks().forEach(t=>t.stop());return;}
      context=new AudioContext();await context.resume();
      const input=context.createMediaStreamSource(stream),node=context.createScriptProcessor(4096,1,1);
      const r={context,stream,input,node,chunks:[] as Float32Array[],speech:false,lastSpeech:performance.now(),started:performance.now()};recording.current=r;
      node.onaudioprocess=e=>{
        const samples=e.inputBuffer.getChannelData(0), rms=Math.sqrt(samples.reduce((n,v)=>n+v*v,0)/samples.length),now=performance.now();
        r.chunks.push(new Float32Array(samples));
        if(rms>.015){r.speech=true;r.lastSpeech=now;}
        if(now-r.started>15000 || (r.speech && now-r.lastSpeech>1400))void stopRef.current();
      };
      input.connect(node);node.connect(context.destination);setListening(true);
    }catch{stream?.getTracks().forEach(t=>t.stop());if(context)void context.close();setError('Microphone could not start. Check browser permissions.');}
    finally{starting.current=false;}
  },[processing]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;dispose();abort.current?.abort();};},[dispose]);
  return {supported:whisperConfigured&&!!navigator.mediaDevices?.getUserMedia,listening,processing,interim:processing?'Transcribing…':'',error,start:()=>void start(),stop:()=>void stop(),engine:'whisper.cpp'};
}
