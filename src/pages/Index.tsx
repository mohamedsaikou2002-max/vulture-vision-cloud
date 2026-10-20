import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundVideo from "@/components/BackgroundVideo";

const pad = (n: number) => String(n).padStart(2, "0");

export default function Index() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const go = () => navigate("/welcome");
  return <>
    <div className="video-bg"><BackgroundVideo /></div>
    <div className="video-overlay" />
    <div className="scanlines" />
    <div className="noise" />
    <div className="corner corner-tl" /><div className="corner corner-tr" />
    <div className="corner corner-bl" /><div className="corner corner-br" />
    <main className="landing-wrap" onClick={go} onKeyDown={e => e.key === "Enter" && go()} role="button" tabIndex={0} aria-label="Continue to Vulture Vision">
      <h1 className="eagle-title">VULTURE VISION</h1>
      <p className="eagle-sub">Intelligence Dominance</p>
      <div className="click-hint">Click anywhere to continue</div>
    </main>
    <div className="sys-clock">SYS // {pad(now.getUTCHours())}:{pad(now.getUTCMinutes())}:{pad(now.getUTCSeconds())} UTC</div>
  </>;
}
