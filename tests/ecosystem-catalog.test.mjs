import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../public-web/public/ecosystem/", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("catalog.json", root), "utf8"));
const byId = new Map(catalog.items.map((item) => [item.id, item]));
const stageIds = new Set(catalog.stages.map((stage) => stage.id));
const categoryIds = new Set(catalog.categories.map((category) => category.id));

test("ecosystem catalog preserves 56 unique build objects", () => {
  assert.equal(catalog.schema, "architectonica.ecosystem-catalog/0.1.0");
  assert.equal(catalog.items.length, 56);
  assert.equal(byId.size, catalog.items.length);
  for (const item of catalog.items) {
    assert.ok(item.name && item.object && item.role && item.next_action, `${item.id} has an incomplete passport`);
    assert.ok(item.evidence.length > 0, `${item.id} has no evidence trace`);
    assert.ok(stageIds.has(item.delivery_stage), `${item.id} has an unknown delivery stage`);
    assert.ok(categoryIds.has(item.category), `${item.id} has an unknown category`);
    assert.equal(item.canonical_status, "unstated", `${item.id} invents an author status`);
  }
});

test("six-part spine follows the declared product line", () => {
  assert.deepEqual(catalog.spine, [
    "gdeya-practical",
    "reson",
    "architectonics-tactics",
    "living-materialization-module",
    "core-architecture-license",
    "architect-creator",
  ]);
  for (const id of catalog.spine) assert.ok(byId.has(id), `spine references missing object ${id}`);
  assert.equal(byId.get("architectonics-tactics").delivery_stage, "prototype");
  assert.equal(byId.get("architectonics-tactics").entrypoint, "../labs/tactics/");
  assert.equal(byId.get("living-materialization-module").delivery_stage, "live");
  assert.equal(byId.get("living-materialization-module").entrypoint, "../labs/module/");
  assert.equal(byId.get("core-architecture-license").delivery_stage, "prototype");
  assert.equal(byId.get("core-architecture-license").entrypoint, "../labs/core-license/");
  assert.equal(byId.get("architect-creator").delivery_stage, "prototype");
  assert.equal(byId.get("architect-creator").entrypoint, "../labs/creator-gate/");
});

test("final decisions and observed Q remain outside the registry", () => {
  assert.deepEqual(catalog.boundary.deferred, [
    "канон",
    "юридические заявления",
    "цены",
    "права доступа",
    "подтверждение реальных результатов",
  ]);
  assert.match(catalog.boundary.q_policy, /Q остаётся null/u);
  assert.ok(catalog.items.every((item) => !("q" in item)), "catalog must not invent observed Q");
});

test("live objects expose working entrypoints and axis accepts catalog seeds", async () => {
  for (const item of catalog.items.filter((candidate) => candidate.delivery_stage === "live")) {
    assert.ok(item.entrypoint, `${item.id} is marked live without an entrypoint`);
  }
  const ecosystemApp = await readFile(new URL("app.mjs", root), "utf8");
  const axisApp = await readFile(new URL("../labs/axis-cycle/app.mjs", root), "utf8");
  assert.match(ecosystemApp, /new URLSearchParams\(\{[\s\S]*object: item\.object/u);
  assert.match(axisApp, /function applyCatalogSeed\(\)/u);
  assert.match(axisApp, /parameters\.get\("object"\)/u);
});
