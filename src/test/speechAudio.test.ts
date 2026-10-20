import {it,expect} from 'vitest';
import {pcmWav} from '@/lib/speechAudio';
it('resamples microphone audio into a bounded mono 16 kHz WAV',async()=>{
 const input=new Float32Array(48000);input.fill(.5);
 const wav=pcmWav([input],48000);
 const bytes=await new Promise<ArrayBuffer>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=reject;reader.readAsArrayBuffer(wav);});
 const view=new DataView(bytes);expect(view.getUint32(24,true)).toBe(16000);expect(view.getUint16(22,true)).toBe(1);expect(view.getUint32(40,true)).toBe(32000);expect(view.getInt16(44,true)).toBe(16383);
});
