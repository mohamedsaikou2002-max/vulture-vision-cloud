import { useWhisperInput, whisperConfigured } from "./useWhisperInput";
import { useCallback, useEffect, useRef, useState } from "react";

// Browser speech recognition. Starts only after the user taps the mic; nothing is recorded otherwise.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = any;
export interface VoiceOptions { lang?: string; onFinal: (text: string, confidence: number) => void }

export function useVoiceInput(options: VoiceOptions) {
  const whisper = useWhisperInput(options);
  const browser = useBrowserVoiceInput(options);
  return whisperConfigured ? whisper : { ...browser, processing: false, engine: "browser speech" };
}

function useBrowserVoiceInput({ lang = "en-US", onFinal }: VoiceOptions) {
  const W = typeof window !== "undefined" ? (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }) : {};
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  const supported = !!Ctor;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<Rec>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  const stop = useCallback(() => { try { rec.current?.stop(); } catch { /* already stopped */ } }, []);
  const start = useCallback(() => {
    if (!Ctor) { setError("Voice input isn't supported in this browser. Use Chrome, Edge or Safari."); return; }
    setError(""); setInterim("");
    const r: Rec = new Ctor();
    r.lang = lang; r.continuous = false; r.interimResults = true; r.maxAlternatives = 1;
    let finalText = "", conf = 0;
    r.onresult = (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence: number } }> }) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) { finalText += res[0].transcript; conf = res[0].confidence || conf; } else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e: { error: string }) => {
      setError(e.error === "not-allowed" ? "Microphone permission was denied. Allow it in your browser's site settings." : e.error === "no-speech" ? "Didn't hear anything. Tap the mic and try again." : `Voice input error: ${e.error}`);
    };
    r.onend = () => { if(timer.current)clearTimeout(timer.current); setListening(false); setInterim(""); if (finalText.trim()) cb.current(finalText.trim(), conf); };
    rec.current = r;
    try { r.start(); setListening(true);timer.current=setTimeout(()=>{try{r.stop();}catch{/* Already stopped. */}},15000); } catch { setError("Couldn't start the microphone."); }
  }, [Ctor, lang]);

  useEffect(() => () => { if(timer.current)clearTimeout(timer.current);try { rec.current?.abort(); } catch { /* noop */ } }, []);
  return { supported, listening, interim, error, start, stop };
}

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}
export const stopSpeaking = () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
