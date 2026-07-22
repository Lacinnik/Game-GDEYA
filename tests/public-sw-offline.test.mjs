import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

function createWorkerHarness(source, workerUrl) {
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
    fetch: async () => { throw new Error("offline"); },
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
    async navigate(path) {
      let response;
      const request = { method: "GET", mode: "navigate", url: new URL(path, workerUrl).href };
      listeners.get("fetch")({
        request,
        respondWith(value) { response = Promise.resolve(value); },
        waitUntil() {},
      });
      return response;
    },
  };
}

test("public Service Worker restores Platform 2.0 and VoidOCR while offline", async () => {
  const source = await readFile(new URL("../public-web/public/sw.js", import.meta.url), "utf8");
  const worker = createWorkerHarness(source, "https://example.test/Game-GDEYA/sw.js");
  await worker.install();

  const voidResponse = await worker.navigate("./labs/voidocr/?offline=1");
  assert.equal(voidResponse.status, 200);
  assert.match(await voidResponse.text(), /labs\/voidocr\/index\.html$/u);

  const platformResponse = await worker.navigate("./platform/?offline=1");
  assert.equal(platformResponse.status, 200);
  assert.match(await platformResponse.text(), /platform\/index\.html$/u);
});
