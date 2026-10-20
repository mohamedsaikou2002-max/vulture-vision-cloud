import { webcrypto } from 'node:crypto';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { simulationFixture } from './fixtures/autosim';
const api=vi.hoisted(()=>({run:vi.fn(),ask:vi.fn(),list:vi.fn(),load:vi.fn(),status:vi.fn()}));
vi.mock('@/components/VVLayout',()=>({default:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock('@/components/sim/WorldState',()=>({default:()=>null}));
vi.mock('@/lib/autoSimApi',()=>({ApiError:class extends Error {constructor(public code:string,message:string,public status:number){super(message)}},runSimulation:api.run,interrogateAgent:api.ask,listJobs:api.list,loadJob:api.load,jobStatus:api.status}));
import Simulator from '@/pages/Simulator';
import { ApiError } from '@/lib/autoSimApi';
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);api.run.mockReset();api.ask.mockReset();api.list.mockResolvedValue([]);api.status.mockResolvedValue(null);api.ask.mockResolvedValue({answer:'Fixture answer'});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const mount=(url='/simulations')=>render(<MemoryRouter initialEntries={[url]}><Simulator/></MemoryRouter>);
describe('Simulator result identity and handoff',()=>{
  it('keeps a completed result paired with its own ID after a later run fails',async()=>{
    let completedId='';
    api.run.mockImplementationOnce(async p=>{completedId=p.job_id;return {job_id:p.job_id,result:simulationFixture()};}).mockRejectedValueOnce(new ApiError('fixture_failed','Second run failed',503));
    mount();fireEvent.change(screen.getByRole('textbox',{name:'Scenario'}),{target:{value:'First funding scenario'}});fireEvent.click(screen.getByRole('button',{name:'Simulate scenario'}));
    await screen.findByText('Fixture scenario');
    fireEvent.change(screen.getByRole('textbox',{name:'Scenario'}),{target:{value:'Second funding scenario'}});fireEvent.click(screen.getByRole('button',{name:'Simulate scenario'}));
    await screen.findByText('Second run failed');fireEvent.click(screen.getByRole('tab',{name:'agents'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Question'}),{target:{value:'What changed?'}});fireEvent.click(screen.getByRole('button',{name:/^Ask$/}));
    await waitFor(()=>expect(api.ask).toHaveBeenCalledWith(completedId,'investors','What changed?'));
  });
  it('reads the news scenario and sends bounded selected references',async()=>{
    api.run.mockImplementation(async p=>({job_id:p.job_id,result:simulationFixture()}));
    mount('/simulations?'+new URLSearchParams({scenario:'Explore the funding consequences',articles:'a'.repeat(64)}));
    expect(screen.getByRole('textbox',{name:'Scenario'})).toHaveValue('Explore the funding consequences');
    fireEvent.click(screen.getByRole('button',{name:'Simulate scenario'}));
    await waitFor(()=>expect(api.run).toHaveBeenCalled());expect(api.run.mock.calls[0][0].article_ids).toEqual(['a'.repeat(64)]);
  });
  it('preserves the pending job after a lost response and recovers its durable result',async()=>{
    let pendingId='';api.run.mockImplementation(async p=>{pendingId=p.job_id;throw new ApiError('timeout','Response lost',0);});api.status.mockResolvedValue('completed');api.load.mockResolvedValue(simulationFixture());
    mount();fireEvent.change(screen.getByRole('textbox',{name:'Scenario'}),{target:{value:'Funding stress with lost response'}});fireEvent.click(screen.getByRole('button',{name:'Simulate scenario'}));
    await screen.findByText('Response lost');expect(screen.getByRole('button',{name:'Simulate scenario'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Check pending run'}));
    await screen.findByText('Fixture scenario');expect(api.load).toHaveBeenCalledWith(pendingId);expect(api.run).toHaveBeenCalledTimes(1);
  });
});
