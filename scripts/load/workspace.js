/* global __ENV, __ITER, __VU, open */
// Run only against an authorized staging deployment with provider budgets and test members.
// k6 run -e BASE_URL=https://PROJECT.supabase.co -e API_KEY=PUBLIC_KEY -e TARGET_VUS=100 -e TOKEN_FILE=/private/members.json scripts/load/workspace.js
import http from 'k6/http';
import {check,sleep} from 'k6';
import {SharedArray} from 'k6/data';
const members=new SharedArray('staging members',()=>JSON.parse(open(__ENV.TOKEN_FILE)));
const vus=Number(__ENV.TARGET_VUS||100);
if(![100,1000,5000].includes(vus))throw new Error('Use 100, 1000 or 5000 staging virtual users');
if(members.length<vus)throw new Error('Provide a distinct, paid staging identity for every virtual user');
export const options={stages:[{duration:'1m',target:vus},{duration:'3m',target:vus},{duration:'30s',target:0}],thresholds:{http_req_failed:['rate<0.01'],http_req_duration:['p(95)<2000','p(99)<5000']},summaryTrendStats:['avg','p(50)','p(95)','p(99)','max']};
export default function(){
 const token=members[(__VU-1)%members.length];
 const headers={authorization:`Bearer ${token}`,apikey:__ENV.API_KEY,'Content-Type':'application/json'};
 const route=__ITER%2?'vv-regime':'vv-news';
 const response=http.post(`${__ENV.BASE_URL}/functions/v1/${route}`,'{}',{headers,tags:{feature:route},timeout:'20s'});
 check(response,{'member read succeeds':r=>r.status===200});sleep(5+Math.random()*5);
}
