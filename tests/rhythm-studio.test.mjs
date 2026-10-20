import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RHYTHM_INTENTS, RHYTHM_PROGRAMS } from "../public-web/public/labs/rhythm/catalog.mjs";
import {
  attachRhythmCheckin,
  buildRhythmCheckin,
  buildRhythmPlan,
  RHYTHM_PLAN_SCHEMA,
  validateRhythmPlan,
} from "../public-web/public/labs/rhythm/protocol.mjs";

const shared = {
  program: "interval",
  intent: "slow",
  object: "Импульс нового продукта",
  subjectManifestation: "Создана одна заметка с описанием идеи.",
  reflectedImage: "Идея кажется срочной и полностью готовой.",
  targetRelation: "Проверить идею до запуска.",
  context: "Один автор, две недели и локальный документ.",
  invariant: "Не терять исходный объект и не выдавать ожидание за отклик.",
  startDate: "2026-10-20",
  timeBudget: "До двадцати минут в день.",
  evidencePolicy: "Локальная заметка и ссылка на созданный артефакт.",
  stopCondition: "Остановиться при угрозе безопасности или необходимости профильной оценки.",
  authorshipAck: true,
  nonMedicalAck: true,
  localScheduleAck: true,
};

test("rhythm studio exposes five sourced product forms", () => {
  assert.equal(RHYTHM_PROGRAMS.length, 5);
  assert.equal(RHYTHM_INTENTS.length, 5);
  assert.equal(new Set(RHYTHM_PROGRAMS.map((program) => program.productId)).size, 5);
  assert.deepEqual(RHYTHM_PROGRAMS.map((program) => program.steps.length), [4, 5, 4, 4, 7]);
  assert.ok(RHYTHM_PROGRAMS.every((program) => program.sourceStatus && program.purpose));
});

test("rhythm plan preserves the tensor and builds explicit dates", () => {
  const plan = buildRhythmPlan(shared, { now: 0, uuid: () => "plan-test" });
  assert.equal(plan.schema, RHYTHM_PLAN_SCHEMA);
  assert.equal(plan.tensor.O, shared.object);
  assert.equal(plan.tensor.Q, null);
  assert.equal(plan.automated_notification, false);
  assert.equal(plan.medical_assessment, false);
  assert.deepEqual(plan.steps.map((step) => step.due_date), ["2026-10-20", "2026-10-22", "2026-10-22", "2026-10-27", "2026-11-03"]);
  assert.equal(validateRhythmPlan(plan), true);
});

test("all three rhythm boundaries are mandatory", () => {
  assert.throws(() => buildRhythmPlan({ ...shared, authorshipAck: false }), /BOUNDARY_ACK_REQUIRED/u);
  assert.throws(() => buildRhythmPlan({ ...shared, nonMedicalAck: false }), /BOUNDARY_ACK_REQUIRED/u);
  assert.throws(() => buildRhythmPlan({ ...shared, localScheduleAck: false }), /BOUNDARY_ACK_REQUIRED/u);
});

test("documented and completed progress remain different", () => {
  const plan = buildRhythmPlan(shared, { now: 0, uuid: () => "plan-test" });
  const checkin = buildRhythmCheckin(plan, {
    stepId: "capture",
    completionState: "partial",
    evidenceStatus: "observed",
    observedTrace: "Заметка сохранена, но ресурс ещё не оценён.",
    interpretation: "Импульс можно удержать без немедленного запуска.",
    nextAction: "Дополнить карточку доступным ресурсом.",
    evidencePointer: "notes/impulse.md",
  }, { now: 1, uuid: () => "checkin-test" });
  const next = attachRhythmCheckin(plan, checkin);
  assert.deepEqual(next.progress, { documented_steps: 1, completed_steps: 0, total_steps: 5, ratio: 0.2, status: "activity-trace-only" });
  assert.equal(next.checkins[0].outcome_confirmed, false);
  assert.equal(next.checkins[0].q, null);
});

test("forged outcomes and unknown steps fail closed", () => {
  const plan = buildRhythmPlan(shared);
  assert.throws(() => buildRhythmCheckin(plan, { stepId: "future", evidenceStatus: "observed", completionState: "done" }), /STEP_REQUIRED/u);
  const checkin = buildRhythmCheckin(plan, {
    stepId: "capture",
    completionState: "stopped",
    evidenceStatus: "unknown",
    observedTrace: "Внешних данных нет.",
    interpretation: "Продолжение сейчас не обосновано.",
    nextAction: "Остановить маршрут.",
    evidencePointer: "внешнего свидетельства нет",
  });
  assert.throws(() => attachRhythmCheckin(plan, { ...checkin, outcome_confirmed: true }), /CHECKIN_INVALID/u);
  assert.equal(validateRhythmPlan({ ...plan, diagnosis: true }), false);
});

test("rhythm shell, offline route and handoffs remain connected", async () => {
  const root = new URL("../public-web/public/labs/rhythm/", import.meta.url);
  const [html, app, worker] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.mjs", root), "utf8"),
    readFile(new URL("../../sw.js", root), "utf8"),
  ]);
  assert.match(html, /styles\.css\?v=rhythm-20261020-r1/u);
  assert.match(html, /app\.mjs\?v=rhythm-20261020-r1/u);
  assert.match(app, /handoffUrl\("\.\.\/guide\//u);
  assert.match(app, /handoffUrl\("\.\.\/practice\//u);
  assert.match(worker, /CACHE_REVISION = 'frontier-20261020-r1'/u);
  assert.match(worker, /\.\/labs\/rhythm\/index\.html/u);
});
