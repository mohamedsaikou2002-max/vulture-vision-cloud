import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import SwarmCanvas from '@/components/sim/SwarmCanvas';
import {simulationFixture} from './fixtures/autosim';
afterEach(cleanup);
it('shows representative cohort nodes without claiming independent simulated agents',()=>{
 const {container}=render(<SwarmCanvas result={null} count={100} onInspect={vi.fn()}/>);
 expect(container.querySelectorAll('circle')).toHaveLength(100);
 expect(screen.getByRole('button',{name:'Auto replay'})).toBeDisabled();
 expect(screen.getByText(/not an independently simulated person/)).toBeInTheDocument();
});
it('replays completed data locally and interrogates the selected economic cohort',()=>{
 const onInspect=vi.fn();const result=simulationFixture();render(<SwarmCanvas result={result} onInspect={onInspect}/>);
 expect(screen.getByText('DAY 3 / 3')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Reset view'}));expect(screen.getByText('DAY 0 / 3')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Next day'}));expect(screen.getByText('DAY 1 / 3')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/central banks/}));fireEvent.click(screen.getByRole('button',{name:'Interrogate cohort ↗'}));expect(onInspect).toHaveBeenCalledWith('central_banks');
});
