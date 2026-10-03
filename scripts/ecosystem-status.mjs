#!/usr/bin/env node
// Validates ecosystem.status.json — the shared product-status summary every repository carries.
//
//   node scripts/ecosystem-status.mjs           validate this repository's file
//   node scripts/ecosystem-status.mjs --all     also fetch and validate every repository's file from main
import { readFile } from "node:fs/promises";

export const SCHEMA = "lacinnik.ecosystem-status/1.0.0";
export const STATUSES = ["canonical", "stable", "candidate", "prototype", "embedded", "not-accepted", "planned", "unstated"];
export const REPOSITORIES = ["Lacinnik/architectonica-az-buki", "Lacinnik/-tensor-architectonics", "Lacinnik/reason-", "Lacinnik/Game-GDEYA"];

export function validateStatus(document) {
  const errors = [];
  if (document?.schema !== SCHEMA) errors.push(`schema must be ${SCHEMA}`);
  if (!REPOSITORIES.includes(document?.repository)) errors.push(`unknown repository ${document?.repository}`);
  if (typeof document?.role !== "string" || !document.role.trim()) errors.push("role is required");
  if (!Array.isArray(document?.products) || !document.products.length) errors.push("products must be a non-empty array");
  const ids = new Set();
  for (const [index, product] of (document?.products ?? []).entries()) {
    const at = `products[${index}]`;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(product?.id ?? "")) errors.push(`${at}.id must be kebab-case`);
    if (ids.has(product?.id)) errors.push(`${at}.id ${product.id} is duplicated`);
    ids.add(product?.id);
    if (typeof product?.name !== "string" || !product.name.trim()) errors.push(`${at}.name is required`);
    if (!STATUSES.includes(product?.status)) errors.push(`${at}.status must be one of ${STATUSES.join(", ")}`);
    if (product?.url !== undefined && !/^https:\/\//.test(product.url)) errors.push(`${at}.url must be https`);
    if (typeof product?.source !== "string" || !product.source) errors.push(`${at}.source must name the document that states the status`);
  }
  return errors;
}

async function remote(repository) {
  const response = await fetch(`https://raw.githubusercontent.com/${repository}/main/ecosystem.status.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const documents = [["local", JSON.parse(await readFile(new URL("../ecosystem.status.json", import.meta.url), "utf8"))]];
  if (process.argv.includes("--all")) {
    for (const repository of REPOSITORIES) {
      try {
        documents.push([repository, await remote(repository)]);
      } catch (error) {
        documents.push([repository, { error: error.message }]);
      }
    }
  }
  let failed = false;
  for (const [label, document] of documents) {
    const errors = document.error ? [document.error] : validateStatus(document);
    console.log(`${errors.length ? "✗" : "✓"} ${label}${errors.length ? `\n  ${errors.join("\n  ")}` : ""}`);
    failed ||= errors.length > 0;
  }
  process.exit(failed ? 1 : 0);
}
