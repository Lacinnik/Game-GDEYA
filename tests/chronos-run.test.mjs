import test, {afterEach} from "node:test";
import assert from "node:assert/strict";
import {score} from "../public-web/public/labs/sc5-chronos/sc5-core.mjs";
import {engine, runner} from "./helpers/chronos-modules.mjs";
const {runAuthorialChronosForCycle: run, CHRONOS_STORAGE_KEY: KEY} = runner;
const cycle = "cycle-synthetic-001";
const row = (id, options = {}) => score({assessmentId: id, timestamp: "2026-10-31T12:00:00Z",
  cycleId: cycle, phase: "before", plate: "РЕСУРС", consent: true, responses: Array(15).fill(.5), ...options});
const pair = () => [row("a"), row("b", {timestamp: "2026-10-31T13:00:00Z", phase: "after", responses: Array(15).fill(.75)})];
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalAnalyze = engine.ChronosAI.prototype.analyzeSequence;
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
  engine.ChronosAI.prototype.analyzeSequence = originalAnalyze;
});
function storage(raw) {
  Object.defineProperty(globalThis, "localStorage", {configurable: true, value: {
    getItem(key) { assert.equal(key, KEY); return raw; },
    setItem() { assert.fail("analysis must not write data"); },
  }});
}
function dataset(records) { storage(JSON.stringify({schema: "SC5Dataset.v1", records})); }

test("real engine integration preserves numeric self-report provenance and explicit limits", async () => {
  const rows = pair(); dataset(rows);
  const result = await run(cycle);
  assert.equal(result.schema, "GDEYA.ChronosRun.v1");
  assert.equal(result.cycleId, cycle);
  assert.equal(result.eventCount, 2);
  assert.deepEqual(result.eventIds, ["a", "b"]);
  assert.equal(result.inputMode, "sc5-numeric-only");
  for (const field of ["semanticAnalysis", "prediction", "diagnosis", "accessDecision"]) assert.equal(result[field], false);
  assert.equal(result.researchOnly, true);
  assert.match(result.limitation, /Семантический анализ не выполнен/);
  assert.equal(result.analysis.loop.windowSize, 2);
  assert.deepEqual(result.analysis.loop.reasons, ["недостаточно истории"]);
  for (const [i, step] of result.analysis.recent.entries()) {
    const event = step.sourceEvent;
    assert.equal(event.userId, cycle);
    assert.equal(event.metadata.assessmentId, rows[i].assessmentId);
    assert.equal(event.metadata.phase, rows[i].phase);
    assert.equal(event.metadata.source, "SC5-self-report-unvalidated");
    assert.deepEqual(event.metrics, rows[i].factors);
    for (const key of ["note", "induction", "inversion", "objectLabel", "imageLabel", "azId", "bukaId", "txId", "pointType", "geometry"]) assert.equal(key in event, false);
  }
});

test("replay is identical after rerun, permutation, another cycle and different text", async () => {
  const rows = pair(); dataset(rows);
  const expected = await run(cycle);
  dataset([row("other-a", {cycleId: "cycle-synthetic-002"}), row("other-b", {cycleId: "cycle-synthetic-002"})]);
  await run("cycle-synthetic-002");
  dataset([...rows].reverse().map(r => ({...r, context: "Иной текст; не передавать", induction: "изменена", inversion: "изменена"})));
  assert.deepEqual(await run(cycle), expected);
  assert.deepEqual(await run(cycle), expected);
});

test("cycle filter isolates events; valid incomplete assessments never become zero", async () => {
  const rows = pair();
  const incomplete = row("partial", {responses: [null, ...Array(14).fill(.5)]});
  dataset([row("foreign", {cycleId: "cycle-synthetic-other"}), incomplete, ...rows]);
  assert.deepEqual((await run(cycle)).eventIds, ["a", "b"]);
  dataset([rows[0], incomplete]);
  await assert.rejects(() => run(cycle), /минимум два/);
  dataset([rows[0], row("foreign", {cycleId: "cycle-synthetic-other"})]);
  await assert.rejects(() => run(cycle), /минимум два/);
});

test("time zones are ordered by instant; equal timestamps use deterministic IDs", async () => {
  dataset([row("z", {timestamp: "2026-10-31T11:00:00Z"}), row("a", {timestamp: "2026-10-31T12:00:00+03:00"}), row("A", {timestamp: "2026-10-31T09:00:00Z"})]);
  const result = await run(cycle);
  assert.deepEqual(result.eventIds, ["A", "a", "z"]);
  assert.equal(result.analysis.latest.ts, "2026-10-31T11:00:00.000Z");
});

test("13 events report total count separately from 12-event trajectory window", async () => {
  dataset(Array.from({length: 13}, (_, i) => row(String(i).padStart(2, "0"))));
  const r = await run(cycle);
  assert.equal(r.eventCount, 13);
  assert.equal(r.analysis.count, 12);
  assert.equal(r.eventIds.length, 13);
  assert.equal(r.analysis.recent[0].sourceEvent.metadata.assessmentId, "01");
});

test("boundary profiles stay finite and bounded; probability-named scores are not a distribution", async () => {
  for (const plate of ["РЕСУРС", "ВЛАСТЬ", "ОТНОШЕНИЯ", "РЕЗУЛЬТАТ"]) {
    dataset([row("zero", {plate, responses: Array(15).fill(0)}), row("max", {plate, responses: Array(15).fill(1)})]);
    const {analysis} = await run(cycle);
    for (const s of analysis.recent) {
      for (const [key, value] of Object.entries(s.state)) {
        assert.ok(Number.isFinite(value), key);
        assert.ok(value >= (key === "delta" ? -1 : 0) && value <= 1, key);
      }
      const scores = [s.branchProbability, s.shiftProbability, s.continuationProbability];
      for (const value of scores) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      assert.notEqual(scores.reduce((a,b) => a+b, 0), 1);
      // Empty embeddings still generate these constants. They are NOT observations.
      assert.equal(s.state.coherence, .5);
      assert.equal(s.state.ambiguity, .664);
      assert.equal(s.state.tension, .15);
    }
  }
});

test("missing semantics cannot measure meaning even with real text in storage", async () => {
  dataset(pair()); const empty = await run(cycle);
  dataset(pair().map(r => ({...r, context: "Смысл изменился полностью", note: "Наблюдение", induction: "Да", inversion: "Нет"})));
  assert.deepEqual(await run(cycle), empty);
});

const corruptions = {
  "missing primary answers": r => { delete r.responses; },
  "short answers": r => { r.responses.pop(); },
  "out-of-scale answer": r => { r.responses[0] = .6; },
  "missing factor": r => { delete r.factors.Q; },
  "tampered aggregate": r => { r.factors.alpha = .9; },
  "factor string": r => { r.factors.alpha = "0.5"; },
  "out-of-range aggregate": r => { r.factors.T = 2; },
  "null aggregate": r => { r.factors.T = null; },
  "unconsented record": r => { r.consent = false; },
  "truthy consent is not consent": r => { r.consent = "true"; },
  "unsupported schema": r => { r.schema = "simulation"; },
  "unsupported version": r => { r.version = "unknown"; },
  "simulation provenance": r => { r.method = "simulation"; },
  "not research": r => { r.researchOnly = false; },
  "empty ID": r => { r.assessmentId = "  "; },
  "oversize ID": r => { r.assessmentId = "a".repeat(121); },
  "invalid timestamp": r => { r.timestamp = "invalid"; },
  "locale timestamp": r => { r.timestamp = "10/31/2026"; },
  "impossible day": r => { r.timestamp = "2026-02-30T12:00:00Z"; },
  "invalid plate": r => { r.plate = "other"; },
  "invalid phase": r => { r.phase = "unlinked"; },
  "non-string cycle": r => { r.cycleId = 123456789; },
  "false completeness": r => { r.complete = false; },
  "missing response with claimed completeness": r => { r.responses[0] = null; },
  "inconsistent missing fields": r => { r.missing = ["Q"]; },
};
for (const [label, change] of Object.entries(corruptions)) test(`reject before engine: ${label}`, async () => {
  const rows = pair(); const bad = row("bad"); change(bad); dataset([...rows, bad]);
  let called = false;
  engine.ChronosAI.prototype.analyzeSequence = async () => { called = true; throw Error("must not run"); };
  await assert.rejects(() => run(cycle), /Неверный формат истории/);
  assert.equal(called, false, "invalid records must not be silently filtered out");
});

test("duplicate IDs rejected globally, even in another cycle", async () => {
  dataset([...pair(), row("a", {cycleId: "cycle-synthetic-other"})]);
  await assert.rejects(() => run(cycle), /уникальность ID/);
});

test("non-finite JSON number is rejected rather than normalized to zero", async () => {
  storage(JSON.stringify({schema: "SC5Dataset.v1", records: pair()}).replace('"alpha":0.5', '"alpha":1e999'));
  await assert.rejects(() => run(cycle), /Неверный формат истории/);
});

test("the maximum supported 1000-event dataset is processed without losing provenance", async () => {
  dataset(Array.from({length: 1000}, (_, i) => row(`event-${String(i).padStart(4,"0")}`)));
  const result = await run(cycle);
  assert.equal(result.eventCount, 1000);
  assert.equal(result.eventIds[999], "event-0999");
  assert.equal(result.analysis.count, 12);
});

test("reordered factor keys have the same meaning", async () => {
  const rows = pair(); dataset(rows); const expected = await run(cycle);
  dataset(rows.map(r => ({...r, factors: Object.fromEntries(Object.entries(r.factors).reverse())})));
  assert.deepEqual(await run(cycle), expected);
});

test("storage and dataset failures are explicit, sanitized, and recover on retry", async () => {
  for (const raw of [null, "", "private malformed text", "null", "[]", "{}", '{"schema":"SC5Dataset.v1","records":{}}', "x".repeat(1_000_001)]) {
    storage(raw); await assert.rejects(() => run(cycle), /истори/);
  }
  dataset(Array.from({length: 1001}, (_, i) => row(`id-${i}`)));
  await assert.rejects(() => run(cycle), /формат истории/);
  Object.defineProperty(globalThis, "localStorage", {configurable: true, get() { throw Error("private failure"); }});
  await assert.rejects(() => run(cycle), /чтение хранилища запрещено/);
  dataset(pair()); assert.equal((await run(cycle)).eventCount, 2);
});

test("invalid cycle IDs are rejected before reading storage", async () => {
  Object.defineProperty(globalThis, "localStorage", {configurable: true, get() { return assert.fail("must not read"); }});
  for (const id of ["", "cycle-short", "<script>", "cycle-"+"a".repeat(95)]) await assert.rejects(() => run(id), /идентификатор/);
});

test("engine rejection never produces a report or exposes raw errors; retry uses a fresh engine", async () => {
  dataset(pair());
  engine.ChronosAI.prototype.analyzeSequence = async () => { throw Error("sensitive internal error"); };
  await assert.rejects(() => run(cycle), {message: "Не удалось выполнить Chronos AI; результат не сформирован"});
  engine.ChronosAI.prototype.analyzeSequence = originalAnalyze;
  assert.equal((await run(cycle)).eventCount, 2);
});
