import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

function createWorkerHarness(source, workerUrl, fetchResource = async () => { throw new Error("offline"); }) {
  const listeners = new Map();
  const stores = new Map();
  const normalize = input => new URL(typeof input === "string" ? input : input.url, workerUrl).href;

  class MemoryCache {
    constructor() { this.entries = new Map(); }
    async addAll(inputs) {
      for (const input of inputs) {
        const url = normalize(input);
        this.entries.set(url, new Response(`cached:${url}`));
      }
    }
    async match(input) { return this.entries.get(normalize(input)); }
    async put(input, response) { this.entries.set(normalize(input), response); }
  }

  const cacheStorage = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new MemoryCache());
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(input) {
      for (const cache of stores.values()) {
        const response = await cache.match(input);
        if (response) return response;
      }
      return undefined;
    },
  };

  const self = {
    location: { origin: new URL(workerUrl).origin },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener(type, listener) { listeners.set(type, listener); },
  };

  vm.runInNewContext(source, {
    self,
    caches: cacheStorage,
    fetch: fetchResource,
    URL,
    Response,
    console,
  });

  return {
    async install() {
      let completion;
      listeners.get("install")({ waitUntil(value) { completion = Promise.resolve(value); } });
      await completion;
    },
    async navigate(path, mode = "navigate") {
      let response;
      const request = { method: "GET", mode, url: new URL(path, workerUrl).href };
      listeners.get("fetch")({
        request,
        respondWith(value) { response = Promise.resolve(value); },
        waitUntil() {},
      });
      return response;
    },
  };
}

test("Service Worker refreshes code online and retains the same version offline", async () => {
  const source = await readFile(new URL("../public-web/public/sw.js", import.meta.url), "utf8");
  let online = true;
  const worker = createWorkerHarness(source, "https://example.test/Game-GDEYA/sw.js", async () => {
    if (!online) throw new Error("offline");
    return new Response("current-module-version");
  });
  await worker.install();
  const path = "./labs/meta-core/handoff.mjs";
  assert.equal(await (await worker.navigate(path, "cors")).text(), "current-module-version");
  online = false;
  assert.equal(await (await worker.navigate(path, "cors")).text(), "current-module-version");
});

test("public Service Worker restores Platform 2.1, the ecosystem, labs and the live axis while offline", async () => {
  const source = await readFile(new URL("../public-web/public/sw.js", import.meta.url), "utf8");
  const worker = createWorkerHarness(source, "https://example.test/Game-GDEYA/sw.js");
  await worker.install();

  const voidResponse = await worker.navigate("./labs/voidocr/?offline=1");
  assert.equal(voidResponse.status, 200);
  assert.match(await voidResponse.text(), /labs\/voidocr\/index\.html$/u);

  const platformResponse = await worker.navigate("./platform/?offline=1");
  assert.equal(platformResponse.status, 200);
  assert.match(await platformResponse.text(), /platform\/index\.html$/u);

  const sepResponse = await worker.navigate("./labs/core-separation/?offline=1");
  assert.equal(sepResponse.status, 200);
  assert.match(await sepResponse.text(), /labs\/core-separation\/index\.html$/u);

  const moduleResponse = await worker.navigate("./labs/module/?offline=1");
  assert.equal(moduleResponse.status, 200);
  assert.match(await moduleResponse.text(), /labs\/module\/index\.html$/u);
  const metaResponse = await worker.navigate("./labs/meta-core/?offline=1");
  assert.equal(metaResponse.status, 200);
  assert.match(await metaResponse.text(), /labs\/meta-core\/index\.html$/u);
  const axisResponse = await worker.navigate("./labs/axis-cycle/?offline=1");
  assert.equal(axisResponse.status, 200);
  assert.match(await axisResponse.text(), /labs\/axis-cycle\/index\.html$/u);

  const ecosystemResponse = await worker.navigate("./ecosystem/?offline=1");
  assert.equal(ecosystemResponse.status, 200);
  assert.match(await ecosystemResponse.text(), /ecosystem\/index\.html$/u);

  const tacticsResponse = await worker.navigate("./labs/tactics/?offline=1");
  assert.equal(tacticsResponse.status, 200);
  assert.match(await tacticsResponse.text(), /labs\/tactics\/index\.html$/u);

  const lineResponse = await worker.navigate("./product-line/?offline=1");
  assert.equal(lineResponse.status, 200);
  assert.match(await lineResponse.text(), /product-line\/index\.html$/u);

  const licenseResponse = await worker.navigate("./labs/core-license/?offline=1");
  assert.equal(licenseResponse.status, 200);
  assert.match(await licenseResponse.text(), /labs\/core-license\/index\.html$/u);

  const creatorResponse = await worker.navigate("./labs/creator-gate/?offline=1");
  assert.equal(creatorResponse.status, 200);
  assert.match(await creatorResponse.text(), /labs\/creator-gate\/index\.html$/u);

  const diagnosticsResponse = await worker.navigate("./labs/diagnostics/?mode=business&offline=1");
  assert.equal(diagnosticsResponse.status, 200);
  assert.match(await diagnosticsResponse.text(), /labs\/diagnostics\/index\.html$/u);
});
