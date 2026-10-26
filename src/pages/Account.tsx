import { Link } from 'react-router-dom';
import VVLayout from '@/components/VVLayout';
import { Button } from '@/components/ui/button';
export default function Account() {
  return <VVLayout><section className="account-page"><h1>WORKSPACE ACCESS</h1>
    <section className="panel space-y-5"><h2 className="panel-title">FULL ACCESS</h2>
      <p>No payment or subscription is required. A private guest session keeps research records separate between browsers.</p>
      <p>Guest research stays associated with this browser. Clearing browser storage can lose access to that history.</p>
      <Button asChild><Link to="/dashboard">Open workspace</Link></Button>
    </section></section></VVLayout>;
}
