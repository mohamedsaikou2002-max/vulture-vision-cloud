import {describe,it,expect} from "vitest";
import { DARPA_SOURCES,parseResearchEnvelope } from "./exchange";
const specimen = {schema_version:"gc-research-exchange/1",source:"macm",upstream_version:"v1",scope:"synthetic",aggregates:{events:15,steps:5},imported_status:"UNVERIFIED_EXTERNAL_RESULT"};
describe("DARPA research envelope",()=>{
 it("lists all nine codebases",()=>expect(DARPA_SOURCES).toHaveLength(9));
 it("accepts a valid aggregate and retains unverified label",()=>{
  const v=parseResearchEnvelope(JSON.stringify(specimen));
  expect(v.aggregates.events).toBe(15);
  expect(v.imported_status).toBe("UNVERIFIED_EXTERNAL_RESULT");
 });
 it("rejects personally-identifying or arbitrary fields",()=>{
  expect(()=>parseResearchEnvelope(JSON.stringify({...specimen,person_id:"123"}))).toThrow();
  expect(()=>parseResearchEnvelope(JSON.stringify({...specimen,aggregates:{user_id:44}}))).toThrow();
 });
 it("rejects invalid rates and fabricated external verification",()=>{
  expect(()=>parseResearchEnvelope(JSON.stringify({...specimen,source:"armory",aggregates:{clean_accuracy:2}}))).toThrow();
  expect(()=>parseResearchEnvelope(JSON.stringify({...specimen,imported_status:"VERIFIED"}))).toThrow();
 });
 it("rejects fractional counts but permits signed radio and timing metrics",()=>{
  expect(()=>parseResearchEnvelope(JSON.stringify({...specimen,aggregates:{events:1.5}}))).toThrow(/whole numbers/);
  const rf=parseResearchEnvelope(JSON.stringify({...specimen,source:"dragonradio",aggregates:{rssi_dbm:-65.5,packet_loss_pct:0.5}}));
  expect(rf.aggregates.rssi_dbm).toBe(-65.5);
  const timing=parseResearchEnvelope(JSON.stringify({...specimen,source:"openroad",aggregates:{setup_wns_ns:-0.2}}));
  expect(timing.aggregates.setup_wns_ns).toBe(-0.2);
 });
 it("rejects unknown source, oversized payload and missing scope",()=>{
  expect(()=>parseResearchEnvelope(JSON.stringify({...specimen,source:"unknown"}))).toThrow();
  expect(()=>parseResearchEnvelope(" ".repeat(41000))).toThrow();
  expect(()=>parseResearchEnvelope(JSON.stringify({...specimen,scope:null}))).toThrow();
 });
});
