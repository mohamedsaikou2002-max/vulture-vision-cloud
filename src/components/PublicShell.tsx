import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import BackgroundVideo from "@/components/BackgroundVideo";
import PublicContours from "./PublicContours";
import "@/styles/public-info.css";

export function SocialLinks() {
  return <div className="public-socials">
    <a href="https://www.instagram.com/greycompanyusa/" target="_blank" rel="noopener noreferrer" aria-label="Grey Company on Instagram"><Instagram size={17} /> Instagram <ArrowUpRight size={13} /></a>
    <a href="https://www.tiktok.com/@greycompanyco" target="_blank" rel="noopener noreferrer" aria-label="Grey Company on TikTok">TikTok <ArrowUpRight size={13} /></a>
  </div>;
}

export default function PublicShell({ children }: { children: ReactNode }) {
  const scroll = useRef<HTMLDivElement>(null);
  const media = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { if (query.matches) media.current?.pause(); else media.current?.play().catch(() => undefined); };
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return <div className="public-site" ref={scroll} onScroll={() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && media.current) {
      media.current.style.transform = `translateY(${Math.min((scroll.current?.scrollTop ?? 0) * .065, 65)}px) scale(1.12)`;
    }
  }}>
    <div className="public-video"><BackgroundVideo videoRef={media} /></div>
    <div className="public-shade" />
    <PublicContours />
    <header className="public-header">
      <Link className="public-wordmark" to="/">VV<span>VULTURE VISION</span></Link>
      <nav aria-label="Main navigation"><Link to="/welcome">The perspective</Link><Button asChild variant="outline" size="sm"><Link to="/welcome#membership">Get access <ArrowUpRight /></Link></Button></nav>
    </header>
    {children}
    <footer className="public-footer"><Link to="/" className="public-wordmark">VV</Link><p>Built by <strong>GREY COMPANY</strong></p><SocialLinks /><small>© {new Date().getFullYear()} Grey Company</small></footer>
  </div>;
}