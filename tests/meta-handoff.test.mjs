import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createHandoff, inspectHandoff, readHandoff, readReceipts, sendHandoff, saveReceipt, HANDOFF_KEY, SOURCE_KEY, RECEIPTS_KEY, TTL_MS } from "../public-web/public/labs/meta-core/handoff.mjs";
import { evaluateTransition } from "../public-web/public/labs/meta-core/runtime.mjs";
const root=new URL("../public-web/public/labs/meta-core/",import.meta.url);
const now=Date.parse("2026-09-20T10:00:00.000Z");
const trace={schema:"architectonica.voidocr-trace/1.1.0",id:"trace-fixture",ts:new Date(now).toISOString(),laboratory:"gdeya",trigger:"Тестовый объект без подмены",pre_state:"напряжение",post_state:"ясность",delta_type:"auto_form",quadrant:"result",stability:3,decision:"ALLOW"};
const store=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
function fixture() {
  const local=store(),session=store();local.setItem(SOURCE_KEY,JSON.stringify([trace]));
  const envelope=createHandoff(trace,{now,uuid:()=>"handoff-fixture"});
  session.setItem(HANDOFF_KEY,JSON.stringify(envelope));
  const draft={owner:"Тестовый оператор",action:"Собрать локальный тестовый макет",invariant:"Сохранить текст объекта",context:"personal",impact:"draft",phase:"materialize",risk:"low",stop:false,responsible:false,confirmed:true,observedQ:1,observation:"Синтетическая тестовая фикстура, не эмпирический результат",metrics:{alpha:1,IY:1,Cm:1,T:1},metricBasis:"Синтетические входы модульного теста"};
  return {local,session,envelope,draft};
}
test("vendor files match the exact pinned upstream bytes",async()=>{
  const manifest=JSON.parse(await readFile(new URL("vendor/provenance.json",root)));
  assert.equal(manifest.commit,"7fc57decef0467cfb37a6595856b0333d9582510");
  for(const [path,hash] of Object.entries(manifest.files)) assert.equal(createHash("sha256").update(await readFile(new URL("vendor/"+path,root))).digest("hex"),hash,path);
});
test("handoff binds exact object, recipient, purpose and source journal",()=>{
  const {envelope,local}=fixture();assert.equal(inspectHandoff(envelope,local,now).ok,true);
  for(const change of [{recipient:"module"},{producer:"other"},{purpose:"execute"},{schema:"old"}, {trace:{...trace,trigger:"Подменённый чужой объект"}}]) assert.equal(inspectHandoff({...envelope,...change},local,now).ok,false);
  assert.equal(envelope.trace.trigger,trace.trigger);
});
test("DENY, forged ALLOW, mismatched quadrant and malformed source fail closed",()=>{
  for(const change of [{stability:1},{decision:"DENY"},{stability:"3"},{quadrant:"resource"},{delta_type:"__proto__"},{pre_state:"unknown"},{schema:"old"}]) assert.throws(()=>createHandoff({...trace,...change},{now}),/SOURCE_NOT_ALLOWED/);
  assert.throws(()=>createHandoff({...trace,stability:0,decision:"DENY"},{now}),/SOURCE_NOT_ALLOWED/);
});
test("expiry is anchored to source timestamp, not renewed by handoff",()=>{
  const {local,envelope}=fixture();
  assert.equal(inspectHandoff(envelope,local,now+TTL_MS-1).ok,true);
  assert.equal(inspectHandoff(envelope,local,now+TTL_MS).reason,"EXPIRED_OR_FUTURE");
  assert.equal(inspectHandoff(envelope,local,now-1).ok,false);
  assert.equal(inspectHandoff({...envelope,expiresAt:new Date(now+2*TTL_MS).toISOString()},local,now).ok,false);
  assert.throws(()=>createHandoff(trace,{now:now+TTL_MS}),/EXPIRED/);
  const later=createHandoff(trace,{now:now+500,uuid:()=>"later"});
  assert.equal(later.expiresAt,envelope.expiresAt);
});
test("corrupt and missing journals never masquerade as a fresh source",()=>{
  const {local,envelope,session}=fixture();
  for(const raw of ["{","null","{}","[]"]) {local.setItem(SOURCE_KEY,raw);assert.equal(inspectHandoff(envelope,local,now).ok,false);assert.equal(local.getItem(SOURCE_KEY),raw);}
  session.setItem(HANDOFF_KEY,"{");assert.equal(readHandoff(session,local,now).ok,false);
});
test("sender verifies writes and retains source",()=>{
  const {local}=fixture(),original=local.getItem(SOURCE_KEY);
  assert.equal(sendHandoff(store(),local,trace,{now,uuid:()=>"sent"}).ok,true);
  for(const target of [{getItem:()=>null,setItem(){}},{getItem:()=>null,setItem(){throw Error("quota")}}]) assert.equal(sendHandoff(target,local,trace,{now}).ok,false);
  assert.equal(local.getItem(SOURCE_KEY),original);
});
test("local allowed fixture runs original cascade but executes nothing",()=>{
  const {local,envelope,draft}=fixture();const report=evaluateTransition(envelope,draft,local,now);
  assert.equal(report.status,"PASS_INTERNAL");assert.equal(report.runtime.gate,"measure");
  assert.equal(report.object,trace.trigger);assert.equal(report.execution.performed,false);
  assert.equal(report.evidence.return,"user-reported-not-independently-verified");
  assert.deepEqual(report.checks.map(x=>x.gate),["handoff","neg","gov","meta","measure"]);
});
test("VoidOCR stability never fills observed Q",()=>{
  const {local,envelope,draft}=fixture();
  for(const observedQ of [null,undefined,"1",true,.75]) {
    const report=evaluateTransition(envelope,{...draft,observedQ},local,now);
    assert.equal(report.status,"HOLD_PROTOCOL");assert.equal(report.observedQ,null);assert.equal(report.gate,"demons/evidence");
  }
  assert.equal(evaluateTransition(envelope,{...draft,observation:""},local,now).observedQ,null);
});
test("STOP and receiver boundaries override source ALLOW",()=>{
  const {local,envelope,draft}=fixture();
  const cases=[[{stop:true},"neg"],[{stop:undefined},"neg"],[{risk:"unknown"},"neg"],[{risk:"critical"},"neg"],
    [{context:"oops"},"gov/context"],[{context:"public"},"meta/context"],[{phase:"oops"},"meta/phase"],
    [{impact:"irreversible"},"gov/impact"],[{impact:"shared"},"gov/impact"],[{impact:"public"},"gov/impact"],
    [{impact:"oops"},"gov/impact"],[{confirmed:false},"gov/confirmation"],[{owner:""},"gov/confirmation"],
    [{context:"org",responsible:false},"gov/responsibility"]];
  for(const [change,gate] of cases) {const report=evaluateTransition(envelope,{...draft,...change},local,now);assert.equal(report.status,"HOLD_PROTOCOL");assert.equal(report.gate,gate);}
});
test("missing, coerced and out of range metrics are not accepted",()=>{
  const {local,envelope,draft}=fixture();
  for(const value of [null,undefined,"1",true,-1,2,NaN,Infinity]) {
    const report=evaluateTransition(envelope,{...draft,metrics:{...draft.metrics,alpha:value}},local,now);
    assert.equal(report.gate,"demons/metrics");assert.equal(report.status,"HOLD_PROTOCOL");
  }
  assert.equal(evaluateTransition(envelope,{...draft,metricBasis:""},local,now).status,"HOLD_PROTOCOL");
});
test("original love and measure thresholds still decide valid inputs",()=>{
  const {local,envelope,draft}=fixture();
  assert.equal(evaluateTransition(envelope,{...draft,observedQ:0},local,now).gate,"love");
  assert.equal(evaluateTransition(envelope,{...draft,metrics:{...draft.metrics,IY:0}},local,now).gate,"measure");
  assert.equal(evaluateTransition(envelope,{...draft,phase:"love",metrics:{...draft.metrics,IY:0}},local,now).status,"PASS_INTERNAL");
});
test("receipt closes one handoff and a reload detects it",()=>{
  const {local,session,envelope,draft}=fixture(),report=evaluateTransition(envelope,draft,local,now);
  const saved=saveReceipt(session,local,envelope,report,now);
  assert.equal(saved.ok,true);assert.equal(session.getItem(HANDOFF_KEY),null);
  session.setItem(HANDOFF_KEY,JSON.stringify(envelope));
  assert.equal(readHandoff(session,local,now).reason,"ALREADY_CONSUMED");
  assert.equal(saveReceipt(session,local,envelope,report,now).ok,false);
  assert.equal(JSON.parse(local.getItem(RECEIPTS_KEY)).length,1);
  assert.equal(readReceipts(local).entries[0].report.object,trace.trigger);
});
test("stale previews, storage failure and corrupt receipts cannot report saved",()=>{
  const {local,session,envelope,draft}=fixture(),report=evaluateTransition(envelope,draft,local,now);
  assert.equal(saveReceipt(session,local,envelope,report,now+TTL_MS).ok,false);
  const denied={getItem:local.getItem,setItem(){throw Error("quota")}};
  assert.equal(saveReceipt(session,denied,envelope,report,now).ok,false);
  assert.notEqual(session.getItem(HANDOFF_KEY),null);assert.equal(local.getItem(RECEIPTS_KEY),null);
  local.setItem(RECEIPTS_KEY,"broken");assert.equal(saveReceipt(session,local,envelope,report,now).ok,false);assert.equal(local.getItem(RECEIPTS_KEY),"broken");
});
test("failed session cleanup cannot make a stored receipt reusable",()=>{
  const {local,session,envelope,draft}=fixture();
  const brokenCleanup={...session,removeItem(){throw Error("denied")}};
  assert.equal(saveReceipt(brokenCleanup,local,envelope,evaluateTransition(envelope,draft,local,now),now).ok,true);
  assert.equal(readHandoff(session,local,now).reason,"ALREADY_CONSUMED");
});
test("all imported browser modules are included in offline shell",async()=>{
  const sw=await readFile(new URL("../sw.js",new URL("../",root)),"utf8");
  for(const path of ["app.mjs","runtime.mjs","handoff.mjs","vendor/meta_core_v2.js","vendor/skela_full_activation.js","vendor/subject_core.js","vendor/gdeya_demons_v1.js","vendor/gdeya_demons_v1_angelic.js","vendor/governance_core_v1.js","vendor/negative_core_v1.js","vendor/tzar_language_001.js"]) {
    await access(new URL(path,root));assert.ok(sw.includes("./labs/meta-core/"+path),path);
  }
});

 test("unchanged and reverse-direction self-reports survive handoff without changing the gate",()=>{
  for (const [pre_state,post_state] of [["напряжение","напряжение"],["ясность","напряжение"]]) {
    const source={...trace,pre_state,post_state};
    const local=store(),session=store();local.setItem(SOURCE_KEY,JSON.stringify([source]));
    const sent=sendHandoff(session,local,source,{now,uuid:()=>"symmetric"});
    assert.equal(sent.ok,true);
    const received=readHandoff(session,local,now);
    assert.equal(received.ok,true);
    assert.deepEqual(received.envelope.trace,source);
    const {draft}=fixture();
    assert.equal(evaluateTransition(received.envelope,{...draft,observedQ:null},local,now).status,"HOLD_PROTOCOL");
    assert.throws(()=>createHandoff({...source,stability:1,decision:"DENY"},{now}),/SOURCE_NOT_ALLOWED/);
  }
});
