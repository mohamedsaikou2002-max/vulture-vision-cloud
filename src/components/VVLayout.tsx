import { ReactNode, useEffect, useRef, useState } from "react";
import "@/styles/belicia-theme.css";
import "@/styles/pr7-workspace.css";
import BackgroundVideo from "@/components/BackgroundVideo";
import { NavLink } from "react-router-dom";

interface Props {
  children: ReactNode;
  status?: { label: string; tone?: "green" | "red" | "gold" | "cyan" };
  blurred?: boolean;
}

const links = [
  { to: "/dashboard", label: "INTEL" },
  { to: "/analytics", label: "ANALYTICS" },
  { to: "/socioeconomics", label: "SOCIO-ECONOMICS" },
  { to: "/simulations", label: "SIMULATIONS" },
  { to: "/news", label: "NEWS FEED" },
  { to: "/account", label: "ACCOUNT / BILLING" },
];

export default function VVLayout({ children, status }: Props) {
  const [newIntel, setNewIntel] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [navHeight, setNavHeight] = useState(64);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(() => setNavHeight(nav.getBoundingClientRect().height));
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onIntel = () => {
      setNewIntel(true);
      clearTimeout(timer);
      timer = setTimeout(() => setNewIntel(false), 30000);
    };
    window.addEventListener("vv-new-intel", onIntel);
    return () => { clearTimeout(timer); window.removeEventListener("vv-new-intel", onIntel); };
  }, []);

  const dotClass = `status-dot ${status?.tone || "gold"}`;
  const statusLabel = newIntel ? "NEW INTEL" : (status?.label || "STATUS UNVERIFIED");

  return (
    <div className="belicia-workspace pr7-workspace">
      <div className="video-bg blurred"><BackgroundVideo /></div><div className="video-overlay" />
      <div className="scanlines" aria-hidden="true"/><div className="noise" aria-hidden="true"/>
      <div className="corner corner-tl" aria-hidden="true"/><div className="corner corner-tr" aria-hidden="true"/>
      <div className="corner corner-bl" aria-hidden="true"/><div className="corner corner-br" aria-hidden="true"/>
      <nav className="nav" ref={navRef} aria-label="Main navigation">
        <NavLink to="/" className="nav-logo">VULTURE VISION</NavLink>
        <div className="nav-links">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className={`nav-status${newIntel ? " new-intel" : ""}`}>
          <div className={newIntel ? "status-dot gold" : dotClass} />
          {statusLabel}
        </div>
      </nav>

      <main id="main-content" className="page-content" style={{ paddingTop: navHeight }}>{children}</main>
    </div>
  );
}
