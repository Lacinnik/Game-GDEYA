import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FACILITATION_PROGRAMS } from "../public-web/public/labs/facilitation/catalog.mjs";
import {
  attachFacilitationNote,
  buildFacilitationNote,
  buildFacilitationPlan,
  FACILITATION_PLAN_SCHEMA,
  validateFacilitationPlan,
} from "../public-web/public/labs/facilitation/protocol.mjs";

const shared = {
  program:"workshop", object:"Общий рабочий объект", subjectManifestation:"Существуют два черновика и протокол встречи.", reflectedImage:"Команда описывает объект как несогласованный.", targetRelation:"Собрать одну предъявимую версию.", context:"Малая команда, одна встреча, общий документ.", invariant:"Не подменять вклад участника коллективной интерпретацией.", title:"Мастерская одного решения", facilitatorRole:"Удерживает процесс и не принимает решение за группу.", participantRoles:"Автор, редактор, продюсер.", startDate:"2026-10-20", duration:"90 минут", observationBoundary:"Фиксируются только действия, слова в общем круге и рабочие артефакты.", storagePolicy:"Локальное досье; экспорт только по отдельному решению группы.", withdrawalPath:"Стоп-сигнал в любой момент; участник может потребовать исправить или удалить свой вклад.", voluntaryConsent:true, sharedBoundaryAck:true, noPeopleScoringAck:true,
};

const entries = { fact:"Создан один общий абзац.", interpretation:"Гипотеза: единый пример снимает терминологический разрыв.", participant_correction:"Команда уточнила, что разрыв относится только к вступлению.", next_action:"Показать абзац одному внешнему читателю." };

test("facilitation studio exposes five sourced product forms", () => {
  assert.equal(FACILITATION_PROGRAMS.length,5);
  assert.ok(FACILITATION_PROGRAMS.every((program)=>program.phases.length===6));
  assert.equal(new Set(FACILITATION_PROGRAMS.map((program)=>program.productId)).size,5);
  assert.ok(FACILITATION_PROGRAMS.every((program)=>program.sourceStatus&&program.purpose));
});

test("facilitation plan preserves consent, tensor and non-scoring boundary", () => {
  const plan=buildFacilitationPlan(shared,{now:0,uuid:()=>"plan-test"});
  assert.equal(plan.schema,FACILITATION_PLAN_SCHEMA);
  assert.equal(plan.tensor.O,shared.object);
  assert.equal(plan.tensor.Q,null);
  assert.equal(plan.people_scored,false);
  assert.equal(plan.outcome_confirmed,false);
  assert.equal(plan.access_granted,false);
  assert.deepEqual(plan.progress,{documented_phases:0,total_phases:6,ratio:0,status:"facilitation-trace-only"});
  assert.equal(validateFacilitationPlan(plan),true);
});

test("all three consent acknowledgements are mandatory", () => {
  assert.throws(()=>buildFacilitationPlan({...shared,noPeopleScoringAck:false}),/CONSENT_REQUIRED/u);
  assert.throws(()=>buildFacilitationPlan({...shared,sharedBoundaryAck:false}),/CONSENT_REQUIRED/u);
  assert.throws(()=>buildFacilitationPlan({...shared,voluntaryConsent:false}),/CONSENT_REQUIRED/u);
});

test("a phase note keeps evidence status and participant correction visible", () => {
  const plan=buildFacilitationPlan(shared,{now:0,uuid:()=>"plan-test"});
  const note=buildFacilitationNote(plan,{phaseId:"charter",evidenceStatus:"observed",roleScope:"Группа целиком",entries,evidencePointer:"protocol.md#charter",participantReviewed:true},{now:1,uuid:()=>"note-test"});
  const next=attachFacilitationNote(plan,note);
  assert.equal(next.notes[0].entries.participant_correction,entries.participant_correction);
  assert.equal(next.notes[0].participant_reviewed,true);
  assert.equal(next.notes[0].people_scored,false);
  assert.deepEqual(next.progress,{documented_phases:1,total_phases:6,ratio:0.167,status:"facilitation-trace-only"});
});

test("facilitation protocol rejects hidden certainty and unknown phases", () => {
  const plan=buildFacilitationPlan(shared);
  assert.throws(()=>buildFacilitationNote(plan,{phaseId:"missing",evidenceStatus:"observed",roleScope:"Группа",entries,evidencePointer:"x"}),/PHASE_REQUIRED/u);
  assert.throws(()=>buildFacilitationNote(plan,{phaseId:"charter",evidenceStatus:"proven",roleScope:"Группа",entries,evidencePointer:"x"}),/EVIDENCE_STATUS_REQUIRED/u);
  const note=buildFacilitationNote(plan,{phaseId:"charter",evidenceStatus:"hypothesis",roleScope:"Группа",entries,evidencePointer:"x"});
  assert.throws(()=>attachFacilitationNote(plan,{...note,people_scored:true}),/NOTE_INVALID/u);
  assert.equal(validateFacilitationPlan({...plan,charter:{...plan.charter,withdrawal_path:""}}),false);
  assert.throws(()=>attachFacilitationNote(plan,{...note,entries:{...note.entries,fact:""}}),/NOTE_INVALID/u);
});

test("facilitation shell, offline route and two handoffs stay connected", async () => {
  const root=new URL("../public-web/public/labs/facilitation/",import.meta.url);
  const [html,app,worker]=await Promise.all([readFile(new URL("index.html",root),"utf8"),readFile(new URL("app.mjs",root),"utf8"),readFile(new URL("../../sw.js",root),"utf8")]);
  assert.match(html,/styles\.css\?v=facilitation-20261020-r1/u);
  assert.match(html,/app\.mjs\?v=facilitation-20261020-r1/u);
  assert.match(app,/handoffUrl\("\.\.\/practice\//u);
  assert.match(app,/handoffUrl\("\.\.\/tactics\//u);
  assert.match(worker,/CACHE_REVISION = 'guide-20261020-r1'/u);
  assert.match(worker,/\.\/labs\/facilitation\/index\.html/u);
});
