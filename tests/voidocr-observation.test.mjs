import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OBSERVATION_STATES, DELTAS, isCompleteObservation } from "../public-web/public/labs/voidocr/observation.mjs";

const observation = { pre: "ясность", post: "напряжение", delta: DELTAS[0], stability: 1 };

test("VoidOCR accepts unchanged and reverse-direction observations without rewriting them", () => {
  for (const [pre, post] of [["напряжение", "напряжение"], ["ясность", "напряжение"], ["ясность", "ясность"], ["напряжение", "ясность"]]) {
    const value = { ...observation, pre, post }, encoded = JSON.stringify(value);
    assert.equal(isCompleteObservation(value), true);
    assert.equal(JSON.stringify(value), encoded);
  }
});

test("all available states can be reported unchanged, including stability zero", () => {
  for (const state of OBSERVATION_STATES) assert.equal(isCompleteObservation({ ...observation, pre: state, post: state, stability: 0 }), true);
});

test("missing observations and invalid stability do not pass the completion gate", () => {
  for (const patch of [{pre:null},{post:""},{post:"invented"},{delta:null},{delta:{...DELTAS[0],quadrant:"wrong"}},...[null,undefined,-1,4,1.5,"2",NaN].map(stability=>({stability}))]) {
    assert.equal(isCompleteObservation({...observation,...patch}), false);
  }
});

test("the versioned observation runtime is available to the published offline shell", async () => {
  const root = new URL("../public-web/public/", import.meta.url);
  const [html, app, sw] = await Promise.all([readFile(new URL("labs/voidocr/index.html",root),"utf8"),readFile(new URL("labs/voidocr/app.js",root),"utf8"),readFile(new URL("sw.js",root),"utf8")]);
  const version = html.match(/app\.js\?v=([^"\s]+)/)?.[1];
  assert.ok(version);
  assert.ok(app.includes(`observation.mjs?v=${version}`));
  for (const name of ["app.js", "observation.mjs"]) assert.ok(sw.includes(`./labs/voidocr/${name}?v=${version}`));
});
