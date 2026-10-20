import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FRONTIER_TRACKS } from "../public-web/public/labs/frontier/catalog.mjs";
import {
  attachFrontierReceipt,
  buildFrontierBlueprint,
  buildFrontierReceipt,
  FRONTIER_BLUEPRINT_SCHEMA,
  FRONTIER_PRODUCT_IDS,
  validateFrontierBlueprint,
} from "../public-web/public/labs/frontier/protocol.mjs";

const shared = {
  mode: "human-ai",
  object: "Совместный выпуск проектного решения",
  subjectManifestation: "Есть авторский бриф и протокол прошлой встречи.",
  reflectedImage: "ИИ воспринимается как соавтор, а поле — как единый голос.",
  targetRelation: "Развести вклад и вернуть финальное решение человеку.",
  context: "Один автор, ИИ-помощник и три участника просмотра.",
  invariant: "Авторство решения остаётся у человека.",
  scenarioTitle: "Один цикл бриф → варианты → поле → решение",
  participant: "Автор и три добровольных участника",
  duration: "60 минут",
  successSignal: "Существует матрица ролей, три отдельных голоса и решение с основанием.",
  stopCondition: "Остановиться при смешении авторства или отзыве согласия.",
  answers: {
    roles: "Автор формулирует и решает; ИИ предлагает; участники дают отдельный отклик.",
    ai_scope: "ИИ создаёт варианты, но не выбирает и не публикует.",
    field_protocol: "Каждый участник оставляет отдельную запись до общего обсуждения.",
  },
  authorshipAck: true,
  boundaryAck: true,
  localAck: true,
};

test("frontier foundry exposes 18 distinct, product-specific tracks", () => {
  assert.equal(FRONTIER_TRACKS.length, 18);
  assert.equal(new Set(FRONTIER_PRODUCT_IDS).size, 18);
  assert.equal(FRONTIER_TRACKS.filter((track) => track.sourceStage === "specified").length, 7);
  assert.equal(FRONTIER_TRACKS.filter((track) => track.sourceStage === "hypothesis").length, 11);
  assert.ok(FRONTIER_TRACKS.every((track) => track.questions.length === 3 && track.steps.length === 4 && track.guardrails.length === 3));
});

test("blueprint preserves TeZar coordinates and cannot claim validation", () => {
  const blueprint = buildFrontierBlueprint(shared, { now: 0, uuid: () => "blueprint-test" });
  assert.equal(blueprint.schema, FRONTIER_BLUEPRINT_SCHEMA);
  assert.equal(blueprint.tensor.O, shared.object);
  assert.equal(blueprint.tensor.Q, null);
  assert.equal(blueprint.q, null);
  assert.equal(blueprint.flags.prototype_validated, false);
  assert.deepEqual(blueprint.progress, { documented_steps: 0, completed_steps: 0, total_steps: 4, ratio: 0, status: "prototype-trace-only" });
  assert.equal(validateFrontierBlueprint(blueprint), true);
  assert.equal(validateFrontierBlueprint({ ...blueprint, q: 1 }), false);
  assert.equal(validateFrontierBlueprint({ ...blueprint, flags: { ...blueprint.flags, outcome_confirmed: true } }), false);
});

test("three acknowledgements and every product-specific answer are mandatory", () => {
  assert.throws(() => buildFrontierBlueprint({ ...shared, authorshipAck: false }), /ACKNOWLEDGEMENTS_REQUIRED/u);
  assert.throws(() => buildFrontierBlueprint({ ...shared, answers: { ...shared.answers, roles: "" } }), /ROLES_REQUIRED/u);
});

test("receipt advances documented and completed progress without confirming outcome", () => {
  const blueprint = buildFrontierBlueprint(shared, { now: 0, uuid: () => "blueprint-test" });
  const receipt = buildFrontierReceipt(blueprint, {
    stepId: "step-1",
    completionState: "done",
    evidenceStatus: "observed",
    observedTrace: "Матрица содержит четыре явно разделённые роли.",
    interpretation: "Разделение достаточно для первого цикла.",
    evidencePointer: "docs/roles.md",
    nextAction: "Провести одну передачу входа и выхода.",
    participantReviewed: true,
  }, { now: 1, uuid: () => "receipt-test" });
  const next = attachFrontierReceipt(blueprint, receipt, { now: 2 });
  assert.deepEqual(next.progress, { documented_steps: 1, completed_steps: 1, total_steps: 4, ratio: 0.25, status: "prototype-trace-only" });
  assert.equal(next.receipts[0].outcome_confirmed, false);
  assert.equal(next.receipts[0].prototype_validated, false);
  assert.equal(next.receipts[0].q, null);
});

test("catalog routes all 18 former frontier objects into their exact modes", async () => {
  const catalog = JSON.parse(await readFile(new URL("../public-web/public/ecosystem/catalog.json", import.meta.url), "utf8"));
  const byId = new Map(catalog.items.map((item) => [item.id, item]));
  for (const track of FRONTIER_TRACKS) {
    assert.equal(byId.get(track.id).delivery_stage, "prototype");
    assert.equal(byId.get(track.id).entrypoint, `../labs/frontier/?mode=${track.mode}`);
  }
  assert.equal(byId.get("facilitator-certification").delivery_stage, "final-phase");
  assert.equal(byId.get("facilitator-certification").entrypoint, "../labs/certification/");
});

test("frontier shell and offline route are wired", async () => {
  const root = new URL("../public-web/public/labs/frontier/", import.meta.url);
  const [html, app, worker] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.mjs", root), "utf8"),
    readFile(new URL("../../sw.js", root), "utf8"),
  ]);
  assert.match(html, /styles\.css\?v=frontier-20261020-r1/u);
  assert.match(html, /app\.mjs\?v=frontier-20261020-r1/u);
  assert.match(app, /frontierTrackByProduct/u);
  assert.match(worker, /CACHE_REVISION = 'certification-20261020-r1'/u);
  assert.match(worker, /\.\/labs\/frontier\/index\.html/u);
});

