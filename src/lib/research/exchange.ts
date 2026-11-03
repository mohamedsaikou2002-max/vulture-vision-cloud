/** Bounded research artifact exchange. No imported output is treated as verified evidence. */
export const DARPA_SOURCES = [
  { id:"macm", label:"MACM / SocialSim", license:"GPL-3.0", domain:"social" },
  { id:"rhpc_smple", label:"RHPC_SMPLE / SocialSim", license:"GPL-3.0", domain:"social" },
  { id:"armory", label:"GARD Armory", license:"MIT", domain:"ai-robustness" },
  { id:"atlantis", label:"AIxCC ATLANTIS", license:"MIT (check transitive)", domain:"defensive-security" },
  { id:"dragonradio", label:"DragonRadio", license:"MIT", domain:"passive-rf-lab" },
  { id:"benchq", label:"BenchQ", license:"Apache-2.0", domain:"quantum" },
  { id:"pyliqtr", label:"pyLIQTR", license:"BSD-2-Clause (verify package assets)", domain:"quantum" },
  { id:"angr", label:"angr", license:"BSD-2-Clause", domain:"binary-audit" },
  { id:"openroad", label:"OpenROAD", license:"BSD-3-Clause", domain:"chip-design" },
] as const;
export type ResearchSource = typeof DARPA_SOURCES[number]["id"];
export type ResearchEnvelope = {
 schema_version: "gc-research-exchange/1";
 source: ResearchSource;
 upstream_version: string;
 scope: "synthetic" | "authorized_lab";
 aggregates: Record<string,number>;
 imported_status:"UNVERIFIED_EXTERNAL_RESULT";
};
const METRIC_KEYS: Record<ResearchSource,readonly string[]> = {
 macm:["events","steps","simulated_agents"],
 rhpc_smple:["posts","interactions","simulated_users"],
 armory:["samples","clean_accuracy","perturbed_accuracy"],
 atlantis:["findings","patches_proposed","tests_passed"],
 dragonradio:["frames","packet_loss_pct","rssi_dbm"],
 benchq:["physical_qubits","duration_seconds","logical_qubits"],
 pyliqtr:["logical_qubits","t_count","clifford_count"],
 angr:["blocks","functions","imports"],
 openroad:["cells","die_area_um2","setup_wns_ns"],
};
const isRecord=(x:unknown):x is Record<string,unknown>=>Boolean(x)&&typeof x==="object"&&!Array.isArray(x);
const own=(x:Record<string,unknown>,k:string)=>Object.prototype.hasOwnProperty.call(x,k);
export function parseResearchEnvelope(value:string):ResearchEnvelope {
 if(value.length>40000)throw new Error("Artifact exceeds 40,000 characters");
 let data:unknown;
 try { data=JSON.parse(value) } catch {throw new Error("Invalid JSON artifact")}
 if(!isRecord(data))throw new Error("Expected JSON object");
 const allowedTop=["schema_version","source","upstream_version","scope","aggregates","imported_status"];
 if(Object.keys(data).some(k=>!allowedTop.includes(k)))throw new Error("Unsupported fields; only aggregate research metrics may be imported");
 if(data.schema_version!=="gc-research-exchange/1")throw new Error("Unsupported exchange schema");
 if(typeof data.source!=="string"||!own(METRIC_KEYS,data.source))throw new Error("Unknown source");
 const source=data.source as ResearchSource;
 if(typeof data.upstream_version!=="string" || !/^[a-zA-Z0-9._+-]{1,80}$/.test(data.upstream_version)) throw new Error("Invalid upstream version");
 if(data.scope!=="synthetic"&&data.scope!=="authorized_lab")throw new Error("Explicit synthetic or authorized scope is required");
 if(data.imported_status!=="UNVERIFIED_EXTERNAL_RESULT")throw new Error("External results must be labeled unverified");
 if(!isRecord(data.aggregates))throw new Error("Aggregates missing");
 if(Object.keys(data.aggregates).length===0 || Object.keys(data.aggregates).length>3)throw new Error("Expected 1–3 metrics");
 const metrics:Record<string,number>={};
 for(const [key,val] of Object.entries(data.aggregates)){
   if(!METRIC_KEYS[source].includes(key))throw new Error("Unsupported metric: "+key);
   if(typeof val!=="number"||!Number.isFinite(val)||Math.abs(val)>1e12)throw new Error("Nonfinite or unbounded metric: "+key);
   if(key.includes("accuracy")||key.endsWith("_pct")){if(val<0||val>(key.endsWith("_pct")?100:1))throw new Error("Invalid rate: "+key)}
   else if(key!=="rssi_dbm"&&!key.endsWith("_ns")&&val<0)throw new Error("Negative count: "+key);
   metrics[key]=val;
 }
 return {schema_version:"gc-research-exchange/1",source,upstream_version:data.upstream_version,scope:data.scope,
   aggregates:metrics,imported_status:"UNVERIFIED_EXTERNAL_RESULT"};
}
