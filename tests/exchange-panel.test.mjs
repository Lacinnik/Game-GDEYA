import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SCHEMA, JOURNAL_SCHEMA, normalizeFile, isEnvelope } from "../public-web/public/labs/exchange-panel.mjs";

const product = { schema: "architectonica.module-passport/1.0.0", id: "passport-12345678", object: "Build a bridge" };

test("exchange panel wraps product-native records without changing their payload", () => {
  const [envelope] = normalizeFile(product, "gdeya-module");
  assert.equal(envelope.schema, SCHEMA);
  assert.equal(envelope.payload, product);
  assert.equal(envelope.source.product, "gdeya-module");
  assert.equal(envelope.source.record_schema, product.schema);
  assert.equal(envelope.verified, false);
  assert.equal(isEnvelope(envelope), true);
});

test("exchange panel imports exchange journals and existing GDEYA exports", () => {
  const envelope = normalizeFile(product, "gdeya-module")[0];
  assert.equal(normalizeFile({ schema: JOURNAL_SCHEMA, entries: [envelope] }, "gdeya-module")[0], envelope);
  assert.equal(normalizeFile({ schema: "gdeya.sep7x7.export.v1", passports: [product] }, "gdeya-sep7x7")[0].payload, product);
  const metaReceipt = { schema: "architectonica.meta-receipt/1.0.0", handoffId: "handoff-12345678", report: {} };
  const [metaEnvelope] = normalizeFile({ schema: "architectonica.meta-receipt-journal/1.0.0", entries: [metaReceipt] });
  assert.equal(metaEnvelope.source.record_id, metaReceipt.handoffId);
  assert.equal(isEnvelope(metaEnvelope), true);
  assert.throws(() => normalizeFile({ schema: JOURNAL_SCHEMA, entries: [{ bad: true }] }, "gdeya-module"));
});

test("all product studios load the shared offline exchange panel", async () => {
  const root = new URL("../public-web/public/", import.meta.url);
  const labs = ["axis-cycle", "certification", "core-license", "core-separation", "creator-gate", "diagnostics", "facilitation", "frontier", "guide", "meta-core", "module", "practice", "rhythm", "tactics", "voidocr"];
  const html = await Promise.all(labs.map((lab) => readFile(new URL(`labs/${lab}/index.html`, root), "utf8")));
  const worker = await readFile(new URL("sw.js", root), "utf8");
  const contract = await readFile(new URL("labs/EXCHANGE.md", root), "utf8");
  assert.ok(html.every((source) => source.includes("exchange-panel.mjs")));
  assert.match(worker, /labs\/exchange-panel\.mjs/u);
  assert.match(worker, /labs\/EXCHANGE\.md/u);
  assert.match(contract, /56 объектов/u);
  assert.match(contract, /verified.*false/u);
});
