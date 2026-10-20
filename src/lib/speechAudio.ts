/** Convert one microphone utterance to the PCM format accepted by whisper.cpp. */
export function pcmWav(chunks: Float32Array[], sampleRate: number): Blob {
  if (!Number.isFinite(sampleRate) || sampleRate < 16000) throw new Error('Unsupported microphone sample rate');
  const input = new Float32Array(chunks.reduce((n,c)=>n+c.length,0));
  let offset=0; for(const chunk of chunks){input.set(chunk,offset);offset+=chunk.length;}
  const count=Math.floor(input.length*16000/sampleRate);
  const buffer=new ArrayBuffer(44+count*2), view=new DataView(buffer);
  const word=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  word(0,'RIFF');view.setUint32(4,36+count*2,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,count*2,true);
  for(let i=0;i<count;i++){
    const at=i*sampleRate/16000, lo=Math.floor(at), t=at-lo;
    const value=Math.max(-1,Math.min(1,input[lo]*(1-t)+(input[Math.min(lo+1,input.length-1)]||0)*t));
    view.setInt16(44+i*2,value<0?value*32768:value*32767,true);
  }
  return new Blob([buffer],{type:'audio/wav'});
}
