import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicShell from "@/components/PublicShell";
const LandingScene = lazy(() => import("@/components/LandingScene"));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function Index() {
  const [scene, setScene] = useState<{ color: string; reduced: boolean } | null>(null);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setScene({ color: getComputedStyle(document.documentElement).getPropertyValue("--gold").trim(), reduced });
  }, []);
  return <PublicShell>
    <main>
      <section className="public-hero">
        <div className="public-eyebrow"><span /> INDEPENDENT INTELLIGENCE. ELEVATED.</div>
        <h1>VULTURE<br /><span>VISION</span><span className="title-period">.</span></h1>
        <div className="hero-bottom"><p>A higher perspective.<br />A clearer view of the market.</p><Button asChild size="lg"><Link to="/welcome">Discover the perspective <ArrowUpRight /></Link></Button></div>
        <div className="hero-coordinate">EST. BY GREY COMPANY <span>01 / THE OVERVIEW</span></div>
        <div className="public-scene" aria-hidden="true"><SceneBoundary><Suspense fallback={null}>{scene && <LandingScene {...scene} />}</Suspense></SceneBoundary></div>
      </section>
      <section className="public-intro">
        <span className="section-index">01 — THE NAME</span>
        <div><h2>Perspective changes<br />everything.</h2><p>Inspired by the vulture’s extraordinary altitude and long-range vision, Vulture Vision is built around one idea: rise above the noise and see what others miss.</p><p>From a single vantage point, a vulture surveys miles of terrain. We bring that same wide-angle perspective to markets—connecting signals, context, and risk before you make your next move.</p><Button asChild variant="link"><Link to="/welcome">Meet Vulture Vision <ArrowUpRight /></Link></Button></div>
        <ArrowDown className="intro-arrow" aria-hidden="true" />
      </section>
      <section className="public-proof"><div><strong>400+</strong><span>Day traders in beta testing</span></div><p>From independent day traders to hedge funds and capital management firms. A broader view for researching allocation, managing risk, and making informed capital decisions.</p></section>
    </main>
  </PublicShell>;
}