import { ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface Props {
  children: ReactNode;
  status?: { label: string; tone?: "green" | "red" | "gold" | "cyan" };
  blurred?: boolean;
}

const links = [
  { to: "/dashboard", label: "INTEL" },
  { to: "/analytics", label: "ANALYTICS" },
  { to: "/trading", label: "TRADING" },
  { to: "/onion", label: "ONION SEARCH" },
  { to: "/news", label: "NEWS FEED" },
  { to: "/worldview", label: "EARTH INTEL" },
];

export default function VVLayout({ children, status, blurred = true }: Props) {
  const dotClass = status?.tone && status.tone !== "green" ? `status-dot ${status.tone}` : "status-dot";
  return (
    <>
      <div className={`video-bg${blurred ? " blurred" : ""}`}>
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

      <nav className="nav">
        <NavLink to="/" className="nav-logo">VULTURE VISION</NavLink>
        <div className="nav-links">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-status">
          <div className={dotClass} />
          {status?.label || "SYSTEM ONLINE"}
        </div>
      </nav>

      <div className="page-content">{children}</div>
    </>
  );
}
