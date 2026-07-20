import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AZ, BUKI, TRANSMISSIONS } from "../public-web/public/labs/module/catalog.mjs";
import { MODULE_SCHEMA, buildPassport, validateDraft } from "../public-web/public/labs/module/runtime.mjs";

const root = new URL("../public-web/public/labs/module/", import.meta.url);
const complete = { intent:"Провести идею в действие", invariant:"Сохранить авторскую ось", azId:"A1", bukaId:"B1", txId:"TX5", induction:"Активирую ясное действие", inversion:"Принимаю готовую форму", axis:"preserved" };

test("MODULE carries the complete 49 × 24 × 7 corpus", () => {
  assert.equal(AZ.length, 49); assert.equal(BUKI.length, 24); assert.equal(TRANSMISSIONS.length, 7);
  assert.equal(new Set(AZ.map(item => item.id)).size, 49); assert.equal(new Set(BUKI.map(item => item.id)).size, 24); assert.equal(new Set(TRANSMISSIONS.map(item => item.id)).size, 7);
});

test("MODULE validates explicit user-authored inputs", () => {
  assert.deepEqual(validateDraft(complete, {az:AZ,buki:BUKI,transmissions:TRANSMISSIONS}), []);
  assert.ok(validateDraft({...complete, axis:""}, {az:AZ,buki:BUKI,transmissions:TRANSMISSIONS}).includes("AXIS_REQUIRED"));
});

test("MODULE produces a deterministic local passport", () => {
  const passport = buildPassport(complete, {az:AZ,buki:BUKI,transmissions:TRANSMISSIONS}, {now:()=>"2026-07-20T00:00:00.000Z",uuid:()=>"test-module"});
  assert.equal(passport.schema, MODULE_SCHEMA); assert.equal(passport.id, "test-module"); assert.equal(passport.outcome, "conduct"); assert.match(passport.formula.notation, /Азъ × ⊕/); assert.equal(passport.storage, "local-browser-only");
});

test("MODULE release has no external runtime dependency", async () => {
  const [html, app, css] = await Promise.all([readFile(new URL("index.html",root),"utf8"),readFile(new URL("app.mjs",root),"utf8"),readFile(new URL("styles.css",root),"utf8")]);
  assert.match(html, /49<\/b> Азов/); assert.match(html, /24<\/b> Буки/); assert.match(html, /7<\/b> Передач/); assert.doesNotMatch(html, /https?:\/\//); assert.match(app, /localStorage\.setItem/); assert.match(css, /-webkit-appearance:none/);
});
