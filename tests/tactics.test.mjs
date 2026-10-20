import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  TACTICS_PLAN_SCHEMA,
  TACTICS_RECEIPT_SCHEMA,
  createTacticalPlan,
  createTacticalReceipt,
  tacticalEmptiness,
  tacticalVolume,
  timeFitsEnvironment,
  validateTacticalPlan,
  validateTacticalReceipt,
} from "../public-web/public/labs/tactics/protocol.mjs";

const input = {
  object: "Передать один проект в исполнимый микро-шаг",
  target_relation: "Сохранить авторство и уменьшить масштаб действия",
  context: "Рабочий стол проекта, один исполнитель, сегодня",
  invariant: "Исходная формулировка объекта",
  metric_basis: "Есть 15 минут, один документ и прямой доступ к исполнителю.",
  noise: 0.25,
  local_density: 0.75,
  focus: 1,
  scope: 0.25,
  time_load: 0.5,
  energy: 0.75,
  environment: "m2",
  planned_minutes: 15,
  micro_decision: "Собрать один абзац",
  micro_vector: "К проверяемому описанию действия",
  action: "Написать и сохранить один абзац сценария",
  completion_signal: "Файл содержит один новый абзац",
  micro_collapse: "Закрыть редактор и сделать паузу",
  feedback_window_min: 15,
};

test("tactical plan preserves O and derives only visible relative indices", () => {
  const plan = createTacticalPlan(input, { now: 0, uuid: () => "plan-12345678" });
  assert.equal(plan.schema, TACTICS_PLAN_SCHEMA);
  assert.equal(plan.object, input.object);
  assert.equal(plan.derived.tactical_emptiness_p_m, 0.5625);
  assert.equal(plan.derived.tactical_volume_v_m, 0.0938);
  assert.equal(plan.derived.calibrated_probability, false);
  assert.equal(plan.derived.protocol_status, "ready-for-micro-action");
  assert.equal(plan.q, null);
  assert.ok(validateTacticalPlan(plan));
});

test("formulas reject hidden interpolation and environment fit stays explicit", () => {
  assert.equal(tacticalEmptiness(input), 0.5625);
  assert.equal(tacticalVolume(input), 0.0938);
  assert.throws(() => tacticalEmptiness({ ...input, noise: 0.3 }), /NOISE_SCALE/u);
  assert.throws(() => tacticalEmptiness({ ...input, noise: "" }), /NOISE_SCALE/u);
  assert.equal(timeFitsEnvironment("m1", 5), true);
  assert.equal(timeFitsEnvironment("m1", 15), false);
  assert.equal(timeFitsEnvironment("m4", 1440), true);
});

test("low tactical emptiness holds action without diagnosing the user", () => {
  const plan = createTacticalPlan({ ...input, noise: 0.75 }, { now: 0, uuid: () => "hold-12345678" });
  assert.equal(plan.derived.protocol_status, "hold-empty-space");
  assert.equal(plan.evidence_status.authored_inputs, "self-reported");
  assert.equal(plan.evidence_status.outcome, "unknown");
});

test("tactical receipt records I10-I12 but cannot manufacture Q", () => {
  const plan = createTacticalPlan(input, { now: 0, uuid: () => "plan-12345678" });
  const receipt = createTacticalReceipt(plan, {
    action_result: "Абзац сохранён в рабочем документе.",
    elapsed_minutes: 12,
    correction: "Убрал второй сценарий из текущего шага.",
    recognition: "Один абзац достаточно ясно задаёт проверку.",
    synthesis: "Следующий цикл начнётся после чтения другим участником.",
  }, { now: 1000, uuid: () => "receipt-12345678" });
  assert.equal(receipt.schema, TACTICS_RECEIPT_SCHEMA);
  assert.equal(receipt.q, null);
  assert.ok(validateTacticalReceipt(receipt, plan));
  assert.throws(() => createTacticalReceipt(plan, { elapsed_minutes: 1 }), /ACTION_RESULT_REQUIRED/u);
});

test("tactics page is linked, offline and names its interpretation boundary", async () => {
  const root = new URL("../public-web/public/", import.meta.url);
  const [html, app, css, sw, axis] = await Promise.all([
    readFile(new URL("labs/tactics/index.html", root), "utf8"),
    readFile(new URL("labs/tactics/app.mjs", root), "utf8"),
    readFile(new URL("labs/tactics/styles.css", root), "utf8"),
    readFile(new URL("sw.js", root), "utf8"),
    readFile(new URL("labs/axis-cycle/app.mjs", root), "utf8"),
  ]);
  assert.match(html, /Пₘ = \(1 − Noiseₜ\)/u);
  assert.match(html, /не являются вероятностью успеха/u);
  assert.match(app, /architectonica\.tactics\.journal\.v1/u);
  assert.match(app, /function materializationUrl\(plan\)/u);
  assert.match(app, /source_tactic: plan\.id/u);
  assert.match(html, /id="materialize-plan"/u);
  assert.match(css, /@media\(max-width:700px\)/u);
  assert.match(axis, /function tacticsUrl\(handoff\)/u);
  for (const name of ["index.html", "styles.css", "app.mjs", "protocol.mjs", "CONTRACT.md"]) {
    assert.match(sw, new RegExp(`labs/tactics/${name.replace(".", "\\.")}`, "u"));
  }
});
