import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ONBOARDING_KEY, ONBOARDING_STEPS, markOnboardingSeen, shouldShowOnboarding } from "../app/onboarding.mjs";

const store = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };

test("walkthrough shows once and stays dismissed", () => {
  const storage = store();
  assert.equal(shouldShowOnboarding(storage), true);
  markOnboardingSeen(storage);
  assert.equal(storage.getItem(ONBOARDING_KEY), "seen");
  assert.equal(shouldShowOnboarding(storage), false);
});

test("blocked storage never traps the player in the walkthrough", () => {
  const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.equal(shouldShowOnboarding(blocked), false);
  assert.doesNotThrow(() => markOnboardingSeen(blocked));
});

test("walkthrough covers the four beats and keeps Q simulated", () => {
  const text = ONBOARDING_STEPS.map((step) => `${step.kicker} ${step.text}`).join(" ");
  for (const beat of ["Наблюдение", "Конфигурация", "Формула", "Отклик поля"]) assert.match(text, new RegExp(beat));
  assert.match(text, /Qsim не является наблюдаемым Q/);
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /shouldShowOnboarding\(globalThis\.localStorage\)\)setTour\(0\)/);
});
