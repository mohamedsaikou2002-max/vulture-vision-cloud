import {it,expect,vi} from 'vitest';
import {loadEdgeHandler} from './helpers/edgeHarness';
it.each(['vv-billing','stripe-webhook'])('retires %s without external requests or database writes',async name=>{
 const network=vi.fn(),database=vi.fn();
 const handler=loadEdgeHandler(name,network,{},database);
 for(const body of [{action:'checkout'},{action:'portal'},{type:'invoice.paid'}]){
  const response=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify(body)}));
  expect(response.status).toBe(410);
 }
 expect(network).not.toHaveBeenCalled();expect(database).not.toHaveBeenCalled();
});
