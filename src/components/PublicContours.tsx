import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
const Scene = lazy(() => import("./LandingScene"));
class SafeScene extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
export default function PublicContours() {
  const [scene, setScene] = useState<{ color: string; reduced: boolean } | null>(null);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || window.matchMedia('(max-width: 600px)').matches) return;
    const canvas = document.createElement("canvas");
    try {
      if (!canvas.getContext("webgl2") && !canvas.getContext("webgl")) return;
      setScene({ color: getComputedStyle(document.documentElement).getPropertyValue("--gold").trim(), reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    } catch { /* Video and content remain available without WebGL. */ }
  }, []);
  return scene ? <div className="public-contours" aria-hidden="true"><SafeScene><Suspense fallback={null}><Scene {...scene} /></Suspense></SafeScene></div> : null;
}