import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DIAGNOSTIC_MODES } from "../public-web/public/labs/diagnostics/catalog.mjs";
import {
  buildDiagnosticPassport,
  DIAGNOSTIC_SCHEMA,
  validateDiagnosticPassport,
} from "../public-web/public/labs/diagnostics/protocol.mjs";

const shared = {
  object: "Рабочий объект",
  subjectManifestation: "Собран наблюдаемый черновик.",
  reflectedImage: "Объект воспринимается как незавершённый.",
  targetRelation: "Перевести объект в один проверяемый шаг.",
  context: "Один проект, одна ответственная сторона.",
  invariant: "Сохранить исходный объект без подмены.",
  observationWindow: "Последние две недели.",
  evidencePointer: "docs/working-note.md",
  nextAction: "Проверить черновик с одним участником.",
};

function scaleAnswers(mode, value = 0.5) {
  return Object.fromEntries(mode.sections.flatMap((section) => section.questions.map((question) => [question.id, value])));
}

test("diagnostic studio exposes five distinct product protocols", () => {
  assert.equal(DIAGNOSTIC_MODES.length, 5);
  assert.equal(new Set(DIAGNOSTIC_MODES.map((mode) => mode.id)).size, 5);
  assert.equal(new Set(DIAGNOSTIC_MODES.map((mode) => mode.productId)).size, 5);
  assert.deepEqual(DIAGNOSTIC_MODES.map((mode) => mode.path?.length ?? mode.sections.flatMap((section) => section.questions).length), [16, 9, 8, 4, 12]);
  assert.ok(DIAGNOSTIC_MODES.every((mode) => mode.sourceStatus && mode.purpose));
});

test("business passport uses visible equal weights and routes to the lowest sector", () => {
  const mode = DIAGNOSTIC_MODES.find((candidate) => candidate.id === "business");
  const answers = scaleAnswers(mode, 0.75);
  for (const question of mode.sections[1].questions) answers[question.id] = 0.25;
  const passport = buildDiagnosticPassport({ ...shared, mode:mode.id, answers }, { now:0, uuid:() => "business-test" });
  assert.equal(passport.schema, DIAGNOSTIC_SCHEMA);
  assert.deepEqual(passport.instrument.sections.map((section) => section.score), [0.75, 0.25, 0.75, 0.75]);
  assert.deepEqual(passport.instrument.routing_hypothesis.lowest_sections.map((section) => section.id), ["buka"]);
  assert.equal(passport.tensor.O, shared.object);
  assert.equal(passport.tensor.Q, null);
  assert.equal(passport.q, null);
  assert.equal(passport.diagnosis, false);
  assert.equal(passport.calibrated_probability, false);
  assert.equal(passport.verified, false);
  assert.equal(validateDiagnosticPassport(passport), true);
});

test("decision navigation preserves the authored path without synthetic scoring", () => {
  const answers = { kher:"Нет внешнего отклика.", point:"Есть один черновик.", rtsy:"Проверяю черновик.", sut:"Не менять объект проверки." };
  const passport = buildDiagnosticPassport({ ...shared, mode:"decision", answers }, { now:0, uuid:() => "decision-test" });
  assert.equal(passport.instrument.method, "authored-four-step-path");
  assert.deepEqual(passport.instrument.steps.map((step) => step.statement), Object.values(answers));
  assert.equal("score" in passport.instrument, false);
  assert.equal(validateDiagnosticPassport(passport), true);
});

test("diagnostic passport rejects missing or off-scale observations", () => {
  const mode = DIAGNOSTIC_MODES.find((candidate) => candidate.id === "hws");
  const answers = scaleAnswers(mode);
  delete answers.h_1;
  assert.throws(() => buildDiagnosticPassport({ ...shared, mode:mode.id, answers }), /H_1_SCALE/u);
  answers.h_1 = 0.4;
  assert.throws(() => buildDiagnosticPassport({ ...shared, mode:mode.id, answers }), /H_1_SCALE/u);
});

test("diagnostic shell, versioned assets and tactics handoff remain connected", async () => {
  const root = new URL("../public-web/public/labs/diagnostics/", import.meta.url);
  const [html, app, worker] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.mjs", root), "utf8"),
    readFile(new URL("../../sw.js", root), "utf8"),
  ]);
  assert.match(html, /styles\.css\?v=diagnostics-20261020-r1/u);
  assert.match(html, /app\.mjs\?v=diagnostics-20261020-r1/u);
  assert.match(app, /\.\.\/tactics\/\?\$\{parameters\}#workbench/u);
  assert.match(worker, /CACHE_REVISION = 'diagnostics-20261020-r1'/u);
  assert.match(worker, /\.\/labs\/diagnostics\/index\.html/u);
});
