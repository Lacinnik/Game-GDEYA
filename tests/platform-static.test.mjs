import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../public-web/public/platform/", import.meta.url);
const registry = JSON.parse(await readFile(new URL("products.registry.json", root), "utf8"));
const languageRegistry = JSON.parse(await readFile(new URL("tzar-language.profiles.json", root), "utf8"));
const byId = new Map(registry.entities.map((entity) => [entity.id, entity]));
const languageById = new Map(languageRegistry.profiles.map((profile) => [profile.id, profile]));

test("Platform 2.0 registers 22 unique entities across two complete 10/10 laboratories", () => {
  assert.equal(registry.schema_version, "2.0");
  assert.equal(registry.entities.length, 22);
  assert.equal(byId.size, 22);
  assert.deepEqual(registry.hypothesis.branches.map((branch) => branch.entity_ids.length), [10, 10]);
  for (const branch of registry.hypothesis.branches) {
    for (const id of branch.entity_ids) assert.ok(byId.has(id), `${branch.id} references missing entity ${id}`);
  }
});

test("TZAR-LANGUAGE-001 assigns one evidence-bounded profile to all 22 entities", () => {
  assert.equal(languageRegistry.model.id, "TZAR-LANGUAGE-001");
  assert.equal(languageRegistry.model.version, "0.2.0-candidate");
  assert.equal(languageRegistry.profiles.length, registry.entities.length);
  assert.equal(languageById.size, registry.entities.length);
  for (const entity of registry.entities) {
    const profile = languageById.get(entity.id);
    assert.ok(profile, `missing language profile for ${entity.id}`);
    assert.equal(profile.q_policy, "null-until-observed-return");
    assert.ok(profile.object_input && profile.subject_trace && profile.reflected_image && profile.target_relation && profile.context);
  }
  assert.match(languageRegistry.model.technical_boundary, /не обученная большая нейросеть/u);
});

test("published verticals expose their accepted versions and public entrypoints", () => {
  assert.equal(byId.get("product-platform").version, "2.0");
  assert.equal(byId.get("meta-core-v2").status, "prototype");
  assert.match(byId.get("meta-core-v2").version, /integration 0\.1 candidate/u);
  assert.match(byId.get("meta-core-v2").entrypoints[0].url, /\/labs\/meta-core\/$/u);
  assert.equal(byId.get("module").version, "1.0.0 stable");
  assert.equal(byId.get("voidocr").version, "1.0.0 stable");
  assert.equal(byId.get("voidocr").status, "live");
  assert.equal(byId.get("collective-meta-core").version, "1.0.0 stable");
  assert.equal(byId.get("collective-meta-core").status, "published");
  assert.equal(byId.get("seven-transmissions").version, "1.0.0 stable");
  assert.match(byId.get("module").entrypoints[0].url, /\/labs\/module\/$/u);
  assert.match(byId.get("voidocr").entrypoints[0].url, /\/labs\/voidocr\/$/u);
  assert.ok(byId.get("gdeya").entrypoints.some((entrypoint) => /\/labs\/core-separation\/$/u.test(entrypoint.url)));
  assert.match(byId.get("collective-meta-core").entrypoints[0].url, /\/field-check\/$/u);
  assert.match(byId.get("seven-transmissions").entrypoints[0].url, /\/transmissions\/$/u);
});

test("QENGINE remains an author-reviewed non-canonical candidate", () => {
  const qengine = byId.get("tzar-qengine");
  assert.equal(qengine.status, "prototype");
  assert.equal(qengine.status_label, "candidate · author-reviewed");
  assert.match(qengine.version, /runtime 0\.1\.0-rc\.1/u);
  assert.match(qengine.version, /corpus 0\.2\.0/u);
  assert.match(qengine.contract, /не canonical/u);
});
