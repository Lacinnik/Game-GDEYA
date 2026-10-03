import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("vendored copies match vendor.lock.json", () => {
  const script = new URL("../scripts/vendor-sync.mjs", import.meta.url);
  assert.doesNotThrow(() => execFileSync(process.execPath, [script.pathname, "--check"], { stdio: "pipe" }));
});
