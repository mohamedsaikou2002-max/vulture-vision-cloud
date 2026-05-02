import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const nav = useNavigate();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const pad = (x: number) => String(x).padStart(2, "0");
      setClock(`SYS // ${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="video-bg">
        <video autoPlay muted loop playsInline>
          <source src="/video.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="video-overlay" />
      <div className="scanlines" />
      <div className="noise" />

      <div className="corner corner-tl" />
      <div className="corner corner-tr" />
      <div className="corner corner-bl" />
      <div className="corner corner-br" />

      <main className="landing-wrap" onClick={() => nav("/dashboard")}>
        <h1 className="eagle-title">VULTURE VISION</h1>
        <p className="eagle-sub">Intelligence Dominance</p>
        <div className="click-hint">Click anywhere to continue</div>
      </main>

      <div className="sys-clock">{clock}</div>
    </>
  );
};

export default Index;
