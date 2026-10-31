import test from "node:test";
import assert from "node:assert/strict";
import {score} from "../public-web/public/labs/sc5-chronos/sc5-core.mjs";
import {prepareChronosInput,invokeChronosEngine} from "../public-web/public/labs/sc5-chronos/chronos-adapter.mjs";
const event=score({assessmentId:"sample-1",timestamp:"2026-10-31T00:00:00Z",plate:"РЕСУРС",responses:Array(15).fill(.5),consent:true,cycleId:"cycle-sample-001",phase:"before"});
test("adapter prepares validated deterministic events",()=>{
 const a=prepareChronosInput([event]); assert.equal(a.events.length,1);
 assert.equal(a.events[0].values.alpha,.5);
 assert.equal(a.researchOnly,true);
});
test("engine is unavailable by default, fail closed",async()=>{
 await assert.rejects(()=>invokeChronosEngine([event]),/не подключён/);
});
test("engine output requires explicit safe contract",async()=>{
 await assert.rejects(()=>invokeChronosEngine([event],async()=>({prediction:true})),/контракту/);
 const res=await invokeChronosEngine([event],async input=>({schema:"ChronosEngineResult.v1",sourceSchema:input.schema,researchOnly:true,prediction:false,diagnosis:false,accessDecision:false,events:input.events.map(x=>x.eventId)}));
 assert.equal(res.engineVerified,false);
});
test("invalid source records cannot reach engine",async()=>{
 let called=false;
 await assert.rejects(()=>invokeChronosEngine([{...event,consent:false}],async()=>{called=true;}));
 assert.equal(called,false);
});
