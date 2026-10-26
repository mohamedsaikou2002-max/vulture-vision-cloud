import { Link } from 'react-router-dom';
import PlatformShowcase from '@/components/PlatformShowcase';
import PublicShell from '@/components/PublicShell';
import { Button } from '@/components/ui/button';
export default function Welcome() {
  return <PublicShell><main className="welcome-main"><PlatformShowcase />
    <section className="membership-section" id="membership"><div><span className="section-index">03 — WORKSPACE</span>
      <h2>Your next<br />vantage point.</h2><p>Market intelligence, scenario research and financial analytics alongside your trading terminal.</p>
      <small>Research support, not investment advice. No guaranteed outcomes.</small></div>
      <div className="membership-offer"><h3>Full workspace access</h3><p>No subscription, checkout or payment required.</p>
      <Button asChild><Link to="/dashboard">Open workspace ↗</Link></Button></div>
    </section></main></PublicShell>;
}
