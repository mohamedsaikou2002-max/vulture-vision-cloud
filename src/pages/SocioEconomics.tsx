import {Link} from 'react-router-dom';
import VVLayout from '@/components/VVLayout';
import WorldState from '@/components/sim/WorldState';
import {AGENTS} from '../../supabase/functions/_shared/autosim_engine';
import '@/styles/simulator.css';
export default function SocioEconomics(){
 return <VVLayout><section className="socio-page"><header><h1>SOCIO-ECONOMICS</h1><p>Nasdaq market context across ten economic dimensions and seven modeled economic actor groups.</p></header><section className="panel"><h2 className="panel-title">ECONOMIC STATE &amp; SOURCE HEALTH</h2><WorldState/></section><section className="panel"><h2 className="panel-title">MODELED ECONOMIC ACTORS</h2><ul className="cohort-grid">{AGENTS.map(agent=><li key={agent}>{agent.replace(/_/g,' ')}</li>)}</ul><p>These groups use explicit, uncalibrated scenario coefficients. They are not independent live agents.</p></section><div><Link to="/simulations">Open simulation room ↗</Link> · <Link to="/simulations/simple">Quick Nasdaq scenario ↗</Link></div></section></VVLayout>;
}
