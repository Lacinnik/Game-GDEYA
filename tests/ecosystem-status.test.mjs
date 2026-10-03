import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateStatus } from "../scripts/ecosystem-status.mjs";

test("ecosystem.status.json follows the shared schema", async () => {
  const document = JSON.parse(await readFile(new URL("../ecosystem.status.json", import.meta.url), "utf8"));
  assert.deepEqual(validateStatus(document), []);
});

test("status validation rejects invented statuses and missing sources", () => {
  const errors = validateStatus({
    schema: "lacinnik.ecosystem-status/1.0.0",
    repository: "Lacinnik/Game-GDEYA",
    role: "test",
    products: [{ id: "x", name: "X", status: "perfect" }],
  });
  assert.ok(errors.some((error) => error.includes("status")));
  assert.ok(errors.some((error) => error.includes("source")));
});
