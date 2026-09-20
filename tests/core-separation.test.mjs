import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CONTEXTS, LAWS, NODES, RESPONSES } from "../public-web/public/labs/core-separation/catalog.mjs";
import { createPassport, detectInvariant, integrateReturn, validateOplus } from "../public-web/public/labs/core-separation/runtime.mjs";
import { canTransition, transition } from "../public-web/public/labs/core-separation/core/state-machine.mjs";
import { responseState, scoreContour } from "../public-web/public/labs/core-separation/core/scorer.mjs";
import { safeJournal } from "../public-web/public/labs/core-separation/core/storage.mjs";
import { compileProductLanguage, compileTzarLanguage, LANGUAGE_AZ, LANGUAGE_BUKI, LANGUAGE_TRANSMISSIONS, MODEL_ID, MODEL_VERSION } from "../public-web/public/labs/tzar-language-001.mjs";

const answers = Object.fromEntries(LAWS.map((law, index) => [law.id, RESPONSES[index].code]));
const languageEvaluation = JSON.parse(await readFile(new URL("../public-web/public/labs/tzar-language-evaluation.json", import.meta.url), "utf8"));

test("SEP-7×7 exposes 49 unique law-context coordinates", () => {
  assert.equal(LAWS.length, 7); assert.equal(CONTEXTS.length, 7); assert.equal(NODES.length, 49);
  assert.equal(new Set(NODES.map((node) => node.id)).size, 49);
  assert.ok(NODES.every((node) => node.question.includes(node.context)));
});

test("counterdependence remains distinction, never autonomy", () => {
  const answer = RESPONSES.find((item) => item.code === "counterdependence");
  assert.equal(answer.state, 2); assert.ok(answer.state < 4);
});

test("⊕ gate requires one subject-owned consent-free action", () => {
  assert.deepEqual(validateOplus({ action: "Сообщить решение без доказательства", criterion: "Решение действует после ответа", owned: true, consentFree: true, languageConfirmed: true }), []);
  assert.ok(validateOplus({ action: "Попросить его сначала измениться", criterion: "Он согласится", owned: false, consentFree: false }).length >= 3);
  assert.ok(validateOplus({ action: "Сообщить решение без доказательства", criterion: "Решение действует после ответа", owned: true, consentFree: true, languageConfirmed: false }).includes("LANGUAGE_UNCONFIRMED"));
});

test("TZAR-LANGUAGE-001 exposes the complete singular corpus", () => {
  assert.equal(MODEL_ID, "TZAR-LANGUAGE-001");
  assert.equal(MODEL_VERSION, "0.2.0-candidate");
  assert.equal(LANGUAGE_AZ.length, 49);
  assert.equal(LANGUAGE_BUKI.length, 24);
  assert.equal(LANGUAGE_TRANSMISSIONS.length, 7);
});

test("product profiles fail closed without O and accept only observed binary Q", () => {
  const profile = { id:"test-product", voice:"subject", object_input:"эпизод", target_relation:"проверить ход", context:"тест" };
  assert.equal(compileProductLanguage(profile).status, "HOLD-INPUT");
  const candidate = compileProductLanguage(profile, { O:"Наблюдаемый эпизод", S:"Совершить один ход", I:"Рабочий образ", subjectConfirmed:true });
  assert.equal(candidate.tensor.Q, null);
  assert.equal(candidate.boundary.subjectConfirmed, true);
  assert.throws(() => compileProductLanguage(profile, { O:"Эпизод", S:"Ход", I:"Образ", Q:.75 }), /Q_MUST_BE_OBSERVED_BINARY/u);
});

test("TZAR-LANGUAGE-001 keeps the same control selections as the Ego profile", () => {
  for (const fixture of languageEvaluation.cases) {
    const result = compileTzarLanguage(fixture.input);
    assert.equal(result.selection.az.id, fixture.expected.az, `${fixture.id}: Аз`);
    assert.equal(result.selection.buka.id, fixture.expected.buka, `${fixture.id}: Бука`);
    assert.equal(result.selection.transmission.id, fixture.expected.transmission, `${fixture.id}: Передача`);
  }
});

test("Q remains null until an observed return", () => {
  const passport = createPassport({ contextId: "C1", episode: "Я отменяю решение после реакции родителя", answers, action: "Сообщить принятое решение спокойно", criterion: "Решение действует после ответа", languageConfirmed: true, now: "2026-08-09T10:00:00.000Z" });
  assert.equal(passport.q, null); assert.equal(passport.evidenceStatus, "hypothesis");
  assert.equal(passport.language.modelId, "TZAR-LANGUAGE-001");
  assert.equal(passport.language.formula, "Слово × Σ Сумма резонансов → ⌒ Мост");
  assert.equal(passport.language.boundary.subjectConfirmed, true);
  assert.equal(passport.language.coordinates.Q, null);
  assert.match(passport.language.layers.publicStatement, /Мой субъектный след S/u);
  const integrated = integrateReturn(passport, { otherReacted: true, actionPreserved: true, relationPreserved: true, newForm: "Разговор завершён", tension: "Напряжение снизилось" }, "2026-08-10T10:00:00.000Z");
  assert.equal(integrated.q, 1); assert.equal(integrated.evidenceStatus, "observed");
  assert.equal(integrated.language.coordinates.Q, 1);
  assert.match(integrated.language.layers.publicStatement, /Возврат наблюдён/u);
  assert.match(integrated.language.layers.publicStatement, /Новая форма — «Разговор завершён»/u);
});

test("an invariant needs the same interception across three distinct contexts", () => {
  const sample = (contextId) => ({ schema: "gdeya.sep7x7.passport.v1", context: { id: contextId }, interception: { lawId: "L3" } });
  assert.equal(detectInvariant([sample("C1"), sample("C2")]), null);
  assert.deepEqual(detectInvariant([sample("C1"), sample("C2"), sample("C3")]).contexts.sort(), ["C1", "C2", "C3"]);
});

test("static shell is local-first and names the interpretation boundary", async () => {
  const root = new URL("../public-web/public/labs/core-separation/", import.meta.url);
  const [html, app] = await Promise.all([readFile(new URL("index.html", root), "utf8"), readFile(new URL("app.mjs", root), "utf8")]);
  assert.match(html, /ГРАНИЦА ИНТЕРПРЕТАЦИИ/u); assert.match(html, /SEP-7×7/u); assert.match(html, /Q<\/code> остаётся <code>null/u);
  assert.match(html, /TZAR-LANGUAGE-001/u); assert.match(html, /language-confirmed/u);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|analytics|gtag/iu);
});

test("canonical nodes.ru.json contains the same 49 coordinate ids", async () => {
  const json = JSON.parse(await readFile(new URL("../public-web/public/labs/core-separation/data/nodes.ru.json", import.meta.url), "utf8"));
  assert.equal(json.length, 49);
  assert.deepEqual(json.map((node) => node.id).sort(), NODES.map((node) => node.id).sort());
  assert.ok(json.every((node) => node.question.length >= 40));
});

test("state machine allows gate reformulation and conduct but blocks skipping", () => {
  assert.equal(canTransition("GATE", "REFORMULATE"), true);
  assert.equal(transition("GATE", "CONDUCT"), "CONDUCT");
  assert.throws(() => transition("EPISODE", "CONDUCT"), /INVALID_TRANSITION/u);
});

test("scorer deterministically covers all seven states", () => {
  assert.deepEqual(RESPONSES.map((response) => responseState(response.code)), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(scoreContour(answers).map((item) => item.state), [0, 1, 2, 3, 4, 5, 6]);
});

test("storage rejects objects outside the SEP passport schema", () => {
  assert.throws(() => safeJournal([{ schema: "other" }, { schema: "gdeya.sep7x7.passport.v1" }]));
});

test("manifest and local Service Worker expose an offline standalone shell", async () => {
  const root = new URL("../public-web/public/labs/core-separation/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
  const worker = await readFile(new URL("sw.js", root), "utf8");
  assert.equal(manifest.display, "standalone");
  assert.match(worker, /data\/nodes\.ru\.json/u);
  assert.match(worker, /core\/passport\.mjs/u);
  assert.match(worker, /tzar-language-001\.mjs/u);
});
