import { transferableAbortController } from 'node:util';
import { renderHook,act,waitFor } from '@testing-library/react';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
const {getSession}=vi.hoisted(()=>({getSession:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getSession}}}));
vi.mock('@/lib/backendOrigin',()=>({backendOrigin:()=> 'https://voice.example.com'}));
import {useWhisperInput} from '@/hooks/useWhisperInput';
let process:((event:unknown)=>void)|null,stop:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 process=null;stop=vi.fn();
 const controller=transferableAbortController();vi.stubGlobal("AbortSignal",controller.signal.constructor);vi.stubGlobal("AbortController",controller.constructor);
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn(async()=>({getTracks:()=>[{stop}]}))}});
 class Audio {
  sampleRate=48000;resume=vi.fn(async()=>{});close=vi.fn(async()=>{});destination={};
  createMediaStreamSource(){return {connect:vi.fn(),disconnect:vi.fn()};}
  createScriptProcessor(){return {connect:vi.fn(),disconnect:vi.fn(),set onaudioprocess(value:typeof process){process=value;}};}
 }
 vi.stubGlobal('AudioContext',Audio);
 getSession.mockResolvedValue({data:{session:{access_token:'fixture'}}});
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({text:'Nasdaq liquidity shock',confidence:null})));
});
afterEach(()=>vi.unstubAllGlobals());
it('records only after activation and stops the microphone before authenticated transcription',async()=>{
 const onFinal=vi.fn();const {result,unmount}=renderHook(()=>useWhisperInput({onFinal}));
 expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
 await act(async()=>result.current.start());
 await waitFor(()=>expect(result.current.listening).toBe(true));
 act(()=>process?.({inputBuffer:{getChannelData:()=>new Float32Array(48000).fill(.2)}}));
 await act(async()=>result.current.stop());
 await waitFor(()=>expect(onFinal).toHaveBeenCalledWith('Nasdaq liquidity shock',0));
 expect(stop).toHaveBeenCalled();expect(fetch).toHaveBeenCalledWith('https://voice.example.com/api/voice/transcribe',expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer fixture'})}));
 unmount();
});
it('releases recording resources on navigation without submitting audio',async()=>{
 const {result,unmount}=renderHook(()=>useWhisperInput({onFinal:vi.fn()}));
 await act(async()=>result.current.start());await waitFor(()=>expect(result.current.listening).toBe(true));
 unmount();expect(stop).toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
