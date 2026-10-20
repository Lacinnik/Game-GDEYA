import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PRACTICE_PROGRAMS } from "../public-web/public/labs/practice/catalog.mjs";
import {
  attachPracticeReceipt,
  buildPracticePlan,
  buildPracticeReceipt,
  PRACTICE_PLAN_SCHEMA,
  validatePracticePlan,
} from "../public-web/public/labs/practice/protocol.mjs";

const shared = {
  program:"session",
  object:"Проверяемый практический объект",
  subjectManifestation:"Существует один рабочий черновик.",
  reflectedImage:"Черновик воспринимается как незавершённый.",
  targetRelation:"Провести объект к одному внешнему следу.",
  context:"Один проект, одна ответственная сторона.",
  invariant:"Не подменять объект оценкой человека.",
  startDate:"2026-10-20",
  evidencePolicy:"Локальные записи и ссылки на рабочие документы.",
  firstAction:"За 20 минут собрать один абзац.",
  completionSignal:"Для каждой единицы существует отдельная квитанция.",
};

const commonEntries = {
  action:"Собран один абзац.",
  artifact:"Абзац сохранён в документе.",
  observation:"Внешний отклик пока неизвестен.",
  reflection:"Перед проверкой убрать второй сценарий.",
};

test("practice studio exposes four sourced time contours", () => {
  assert.equal(PRACTICE_PROGRAMS.length, 4);
  assert.deepEqual(PRACTICE_PROGRAMS.map((program) => program.units.length), [6, 6, 7, 30]);
  assert.equal(new Set(PRACTICE_PROGRAMS.map((program) => program.productId)).size, 4);
  assert.equal(PRACTICE_PROGRAMS[1].units.at(-1).optional, true);
  assert.ok(PRACTICE_PROGRAMS.every((program) => program.sourceStatus && program.purpose));
});

test("practice plan preserves the tensor and begins without a manufactured result", () => {
  const plan = buildPracticePlan(shared,{now:0,uuid:()=>"plan-test"});
  assert.equal(plan.schema,PRACTICE_PLAN_SCHEMA);
  assert.equal(plan.tensor.O,shared.object);
  assert.equal(plan.tensor.Q,null);
  assert.equal(plan.q,null);
  assert.equal(plan.verified,false);
  assert.equal(plan.outcome_confirmed,false);
  assert.equal(plan.diagnosis,false);
  assert.deepEqual(plan.progress,{reported_units:0,total_units:6,ratio:0,status:"activity-trace-only"});
  assert.equal(validatePracticePlan(plan),true);
});

test("one receipt advances only the visible activity trace and replaces the same unit", () => {
  const plan = buildPracticePlan(shared,{now:0,uuid:()=>"plan-test"});
  const first = buildPracticeReceipt(plan,{unitId:"contract",state:"attempted",entries:commonEntries,evidencePointer:"docs/session.md#contract"},{now:1,uuid:()=>"receipt-1"});
  const once = attachPracticeReceipt(plan,first);
  assert.deepEqual(once.progress,{reported_units:1,total_units:6,ratio:0.167,status:"activity-trace-only"});
  assert.equal(once.receipts[0].q,null);
  assert.equal(once.receipts[0].outcome_confirmed,false);
  const replacement = buildPracticeReceipt(once,{unitId:"contract",state:"completed-self-reported",entries:commonEntries,evidencePointer:"docs/session.md#contract-v2"},{now:2,uuid:()=>"receipt-2"});
  const twice = attachPracticeReceipt(once,replacement);
  assert.equal(twice.receipts.length,1);
  assert.equal(twice.progress.reported_units,1);
  assert.equal(twice.receipts[0].state,"completed-self-reported");
});

test("thirty-day receipts preserve the five declared daily observations", () => {
  const plan = buildPracticePlan({...shared,program:"crash"},{now:0,uuid:()=>"crash-test"});
  const entries = {morning_premise:"Действую из заявленной цели.",external_contact:"Отправлено одно сообщение.",internal_preparation:"Записан один тезис.",observed_response:"Ответа пока нет.",retrospective_note:"Сделать следующее сообщение короче."};
  const receipt = buildPracticeReceipt(plan,{unitId:"day-1",state:"attempted",entries,evidencePointer:"journal/day-01"},{now:1,uuid:()=>"day-1"});
  assert.deepEqual(Object.keys(receipt.entries),Object.keys(entries));
  assert.equal(receipt.evidence_status,"self-reported-unverified");
});

test("practice protocol rejects unknown units, states and missing observations", () => {
  const plan = buildPracticePlan(shared);
  assert.throws(() => buildPracticeReceipt(plan,{unitId:"day-99",state:"attempted",entries:commonEntries,evidencePointer:"x"}),/UNIT_REQUIRED/u);
  assert.throws(() => buildPracticeReceipt(plan,{unitId:"contract",state:"verified",entries:commonEntries,evidencePointer:"x"}),/STATE_REQUIRED/u);
  assert.throws(() => buildPracticeReceipt(plan,{unitId:"contract",state:"attempted",entries:{...commonEntries,artifact:""},evidencePointer:"x"}),/ARTIFACT_REQUIRED/u);
});

test("practice shell, versioned assets, offline route and tactics handoff stay connected", async () => {
  const root = new URL("../public-web/public/labs/practice/",import.meta.url);
  const [html,app,worker] = await Promise.all([readFile(new URL("index.html",root),"utf8"),readFile(new URL("app.mjs",root),"utf8"),readFile(new URL("../../sw.js",root),"utf8")]);
  assert.match(html,/styles\.css\?v=practice-20261020-r1/u);
  assert.match(html,/app\.mjs\?v=practice-20261020-r1/u);
  assert.match(app,/\.\.\/tactics\/\?\$\{parameters\}#workbench/u);
  assert.match(worker,/CACHE_REVISION = 'rhythm-20261020-r1'/u);
  assert.match(worker,/\.\/labs\/practice\/index\.html/u);
});
