import {describe,it,expect} from "vitest";
import {simulateScenario,DEFAULT_SCENARIO,PRESET_SCENARIOS} from "@/lib/localSocioScenario";
const zero={credit:0,supply:0,demand:0,policy:0,periods:12};
describe("local socio-economic simulation",()=>{
  it("is available without credentials and deterministic",()=>{
    expect(simulateScenario(DEFAULT_SCENARIO)).toEqual(simulateScenario(DEFAULT_SCENARIO));
  });
  it("provides baseline plus one point per requested period",()=>{
    expect(simulateScenario(zero)).toHaveLength(13);
    expect({...simulateScenario(zero)[0],period:12}).toEqual(simulateScenario(zero)[12]);
  });
  it("keeps every modeled index finite and bounded",()=>{
    for(const preset of Object.values(PRESET_SCENARIOS)){
      for(const point of simulateScenario(preset)){
        for(const [key,v] of Object.entries(point)){
          if(key!=="period"){expect(Number.isFinite(v)).toBe(true);expect(v).toBeGreaterThanOrEqual(0);expect(v).toBeLessThanOrEqual(1);}
        }
      }
    }
  });
  it("models reduced liquidity from tighter credit",()=>{
    expect(simulateScenario({...zero,credit:95})[1].liquidity).toBeLessThan(simulateScenario(zero)[1].liquidity);
  });
  it("models greater default stress after credit tightening",()=>{
    expect(simulateScenario({...zero,credit:95})[1].defaultRisk).toBeGreaterThan(simulateScenario(zero)[1].defaultRisk);
  });
  it("models supply disruption as an inflation stressor",()=>{
    expect(simulateScenario({...zero,supply:95})[1].inflation).toBeGreaterThan(simulateScenario(zero)[1].inflation);
  });
  it("models policy support as partial credit stress offset",()=>{
    expect(simulateScenario({...zero,credit:80,policy:85})[1].liquidity).toBeGreaterThan(simulateScenario({...zero,credit:80})[1].liquidity);
  });
  it("rejects unsupported inputs",()=>{
    expect(()=>simulateScenario({...zero,periods:100})).toThrow(RangeError);
    expect(()=>simulateScenario({...zero,demand:101})).toThrow(RangeError);
    expect(()=>simulateScenario({...zero,credit:Number.NaN})).toThrow(RangeError);
  });
});
