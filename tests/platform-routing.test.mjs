import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../public-web/public/platform/", import.meta.url);
const source = await readFile(new URL("app.js", root), "utf8");
const registry = JSON.parse(await readFile(new URL("products.registry.json", root), "utf8"));
const profiles = JSON.parse(await readFile(new URL("tzar-language.profiles.json", root), "utf8"));

async function openPlatform(hash) {
  const listeners = new Map();
  const errors = [];
  const app = { innerHTML: "", focus() {}, querySelectorAll: () => [], querySelector: () => null };
  const overlay = { addEventListener() {} };
  const location = { hash };
  const document = {
    title: "",
    querySelector: selector => selector === "#app" ? app : overlay,
    querySelectorAll: () => [], addEventListener() {},
  };
  vm.runInNewContext(source, {
    document, location, navigator: {},
    window: { addEventListener: (name, fn) => listeners.set(name, fn), scrollTo() {} },
    requestAnimationFrame: fn => fn(),
    console: { error: error => errors.push(error) },
    fetch: async url => ({ ok: true, json: async () => url.includes("products.registry") ? registry : profiles }),
  });
  // Wait for initialization's fetch and JSON promises to finish.
  await new Promise(resolve => setImmediate(resolve));
  return { app, document, errors, navigate(next) { location.hash = next; listeners.get("hashchange")(); } };
}

test("malformed product links show not-found at startup and recover through navigation", async () => {
  for (const id of ["%", "%GG", "%E0%A4%A", "%FF"]) {
    const page = await openPlatform(`#/product/${id}`);
    assert.match(page.app.innerHTML, /404 · КОНТУР НЕ НАЙДЕН/u);
    assert.doesNotMatch(page.app.innerHTML, /РЕЕСТР НЕДОСТУПЕН/u);
    assert.equal(page.errors.length, 0);
    page.navigate("#/map");
    assert.match(page.document.title, /Карта системы/u);
    page.navigate("#/product/%");
    assert.match(page.document.title, /Контур не найден/u);
    page.navigate("#/product/gdeya");
    assert.match(page.app.innerHTML, /dossier-hero/u);
  }
});

test("all registered dossiers and encoded IDs remain reachable; unknown IDs show not-found", async () => {
  const page = await openPlatform("#/home");
  for (const entity of registry.entities) {
    page.navigate(`#/product/${encodeURIComponent(entity.id)}`);
    assert.equal(page.document.title, `${entity.name} — Архитектоника`);
    assert.match(page.app.innerHTML, /dossier-hero/u);
  }
  page.navigate("#/product/%67deya");
  assert.equal(page.document.title, `${registry.entities.find(item => item.id === "gdeya").name} — Архитектоника`);
  page.navigate("#/product/not-registered");
  assert.match(page.app.innerHTML, /404 · КОНТУР НЕ НАЙДЕН/u);
});
