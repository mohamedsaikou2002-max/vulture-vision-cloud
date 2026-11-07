import { Link } from "react-router-dom";
import PlatformShowcase from "@/components/PlatformShowcase";
import PublicShell from "@/components/PublicShell";
import { Button } from "@/components/ui/button";
import { MEMBERSHIP_OFFER } from "@/lib/billingApi";
export default function Welcome() {
  return <PublicShell><main className="welcome-main"><PlatformShowcase />
    <section className="membership-section" id="membership"><div><span className="section-index">03 — MEMBERSHIP</span>
      <h2>Your next<br />vantage point.</h2><p>Market intelligence, scenario research, and financial analytics alongside your trading terminal.</p>
      <small>Research support, not investment advice. No guaranteed outcomes.</small></div>
      <div className="membership-offer"><h3>Vulture Vision membership</h3>
        <p><strong>${(MEMBERSHIP_OFFER.introCents / 100).toFixed(0)} for {MEMBERSHIP_OFFER.days} days</strong>, then <strong>${(MEMBERSHIP_OFFER.monthlyCents / 100).toLocaleString("en-US")}/month</strong> until canceled.</p>
        <p>Secure checkout and subscription management through Stripe. Introductory payment is charged immediately; recurring billing begins after seven days.</p>
        <Button asChild><Link to="/login">Create account or sign in</Link></Button>
        <Button asChild variant="outline"><Link to="/account">Manage membership</Link></Button>
        <small>Payment collection will be enabled after the Stripe integration is verified in test mode.</small>
      </div>
    </section></main></PublicShell>;
}
