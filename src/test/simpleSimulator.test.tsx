import {webcrypto} from 'node:crypto';
import {MemoryRouter} from 'react-router-dom';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {simulationFixture} from './fixtures/autosim';
const {run,status,load}=vi.hoisted(()=>({run:vi.fn(),status:vi.fn(),load:vi.fn()}));
vi.mock('@/components/VVLayout',()=>({default:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock('@/lib/autoSimApi',()=>({ApiError:class extends Error{constructor(public code:string,message:string,public status:number){super(message)}},runSimulation:run,jobStatus:status,loadJob:load}));
import SimpleSimulator from '@/pages/SimpleSimulator';
import {ApiError} from '@/lib/autoSimApi';
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);run.mockReset();status.mockReset();load.mockReset();});afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const mount=()=>render(<MemoryRouter><SimpleSimulator/></MemoryRouter>);
it('uses the existing engine with conservative seven-day constraints',async()=>{
 run.mockImplementation(async p=>({job_id:p.job_id,result:simulationFixture()}));mount();
 fireEvent.change(screen.getByRole('textbox',{name:'What happens?'}),{target:{value:'Nasdaq faces credit stress'}});fireEvent.click(screen.getByRole('button',{name:'Explore this scenario'}));
 await screen.findByText('Fixture scenario');expect(run.mock.calls[0][0].constraints).toEqual({horizon_days:7,risk_profile:'conservative'});expect(screen.getByText('Lower range')).toBeInTheDocument();
});
it('recovers a lost response without starting another paid request',async()=>{
 let id='';run.mockImplementation(async p=>{id=p.job_id;throw new ApiError('timeout','Response lost',0);});status.mockResolvedValue('completed');load.mockResolvedValue(simulationFixture());mount();
 fireEvent.change(screen.getByRole('textbox',{name:'What happens?'}),{target:{value:'Nasdaq faces credit stress'}});fireEvent.click(screen.getByRole('button',{name:'Explore this scenario'}));await screen.findByText('Response lost');
 fireEvent.click(screen.getByRole('button',{name:'Check pending run'}));await screen.findByText('Fixture scenario');await waitFor(()=>expect(load).toHaveBeenCalledWith(id));expect(run).toHaveBeenCalledTimes(1);
});
