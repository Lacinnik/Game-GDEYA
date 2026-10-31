import test from "node:test";
import assert from "node:assert/strict";
import {score} from "../public-web/public/labs/sc5-chronos/sc5-core.mjs";
import {replayAssessmentHistory,REPLAY_VERSION} from "../public-web/public/labs/sc5-chronos/temporal-replay.mjs";
const record=(id,ts,values,cycleId="cycle-research-001",plate="РЕСУРС")=>score({assessmentId:id,timestamp:ts,consent:true,plate,cycleId,phase:id==="a"?"before":"after",responses:values});
test("replay is deterministic independent of input order",()=>{
 const a=record("a","2026-10-31T00:00:00Z",Array(15).fill(.5));
 const b=record("b","2026-11-01T00:00:00Z",Array(15).fill(.75));
 const first=replayAssessmentHistory([b,a]),second=replayAssessmentHistory([a,b]);
 assert.deepEqual(first,second);
 assert.equal(first.schema,REPLAY_VERSION);
 assert.equal(first.trajectory[1].delta.alpha,.25);
 assert.equal(first.prediction,false);
});
test("no comparison across plates or cycles",()=>{
 const a=record("a","2026-10-31T00:00:00Z",Array(15).fill(.5));
 const b=record("b","2026-11-01T00:00:00Z",Array(15).fill(.75),"cycle-other-001");
 assert.equal(replayAssessmentHistory([a,b]).trajectory[1].delta,null);
});
test("incomplete assessments never become zeros",()=>{
 const v=Array(15).fill(.5);v[0]=null;
 const a=record("a","2026-10-31T00:00:00Z",v);
 const b=record("b","2026-11-01T00:00:00Z",Array(15).fill(.75));
 assert.equal(replayAssessmentHistory([a,b]).trajectory[1].delta,null);
});
test("duplicate events rejected; source array not mutated",()=>{
 const a=record("a","2026-10-31T00:00:00Z",Array(15).fill(.5));
 assert.throws(()=>replayAssessmentHistory([a,a]),/Повторный/);
 const events=[a];replayAssessmentHistory(events);assert.deepEqual(events,[a]);
});
test("replay supports cycle filter",()=>{
 const a=record("a","2026-10-31T00:00:00Z",Array(15).fill(.5));
 const b=record("b","2026-11-01T00:00:00Z",Array(15).fill(.75),"cycle-other-001");
 const result=replayAssessmentHistory([a,b],{cycleId:"cycle-research-001"});
 assert.equal(result.eventCount,1);
});
