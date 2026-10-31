import test from "node:test";
import assert from "node:assert/strict";
import {score,toChronosInput,summarizeChronos,importDataset,exportDataset,validateRecord,compareCycle} from "../public-web/public/labs/sc5-chronos/sc5-core.mjs";
const input=(responses=Array(15).fill(.5))=>({plate:"РЕСУРС",responses,consent:true,assessmentId:"a",timestamp:"2026-10-31T00:00:00.000Z"});
test("полная оценка: пять факторов",()=>{const r=score(input());assert.equal(r.complete,true);assert.deepEqual(Object.values(r.factors),Array(5).fill(.5));assert.equal(toChronosInput(r).metrics.alpha,.5)});
test("пропуски не преобразуются в нули",()=>{const a=Array(15).fill(.5);a[3]=null;const r=score(input(a));assert.equal(r.complete,false);assert.equal(r.factors.IY,null);assert.throws(()=>toChronosInput(r))});
test("нет согласия — нет записи",()=>assert.throws(()=>score({...input(),consent:false})));
test("неверные ответы отклонены",()=>{assert.throws(()=>score(input(Array(15).fill(2))));assert.throws(()=>score(input(Array(14).fill(.5))))});
test("расчет изменения временных самоотчетов",()=>{const a=score(input()),b=score({...input(Array(15).fill(.75)),assessmentId:"b",timestamp:"2026-11-01T00:00:00.000Z"});assert.equal(summarizeChronos([b,a]).delta.alpha,.25)});
test("экспорт/импорт без потери данных",()=>{const a=score(input());const imported=importDataset(exportDataset([a]));assert.equal(imported.length,1);assert.deepEqual(imported[0],a)});
test("подмененная метрика отклонена",()=>{const r=score(input());r.factors.alpha=1;assert.throws(()=>validateRecord(r))});
test("дубликаты импорта отклонены",()=>{const r=score(input());assert.throws(()=>importDataset(JSON.stringify({schema:"SC5Dataset.v1",records:[r,r]})))});

test("сопоставление только одной пары цикла",()=>{const a=score({...input(),assessmentId:"p1",cycleId:"cycle-test-001",phase:"before"});const b=score({...input(Array(15).fill(.75)),assessmentId:"p2",timestamp:"2026-11-01T00:00:00.000Z",cycleId:"cycle-test-001",phase:"after"});assert.equal(compareCycle([a,b],"cycle-test-001").delta.alpha,.25);assert.equal(compareCycle([a],"cycle-test-001").status,"incomplete-pair");assert.equal(compareCycle([a,b],"cycle-other").status,"incomplete-pair")});
test("двойная итоговая оценка не дает ложную пару",()=>{const a=score({...input(),assessmentId:"p1",cycleId:"cycle-test-002",phase:"before"});const b=score({...input(),assessmentId:"p2",cycleId:"cycle-test-002",phase:"after"});const c=score({...input(),assessmentId:"p3",cycleId:"cycle-test-002",phase:"after"});assert.equal(compareCycle([a,b,c],"cycle-test-002").status,"incomplete-pair")});
