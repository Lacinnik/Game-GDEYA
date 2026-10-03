#!/usr/bin/env node
// Keeps files copied from sibling repositories byte-identical to a pinned upstream commit.
//
//   node scripts/vendor-sync.mjs --check            verify local copies against vendor.lock.json (offline)
//   node scripts/vendor-sync.mjs --drift            report copies that differ from upstream main
//   node scripts/vendor-sync.mjs --update [repo]    re-pin to upstream main and rewrite the copies
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const lockUrl = new URL("vendor.lock.json", root);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fetchBytes(repo, ref, path) {
  const url = `https://raw.githubusercontent.com/${repo}/${ref}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function headCommit(repo, branch) {
  const output = execFileSync("git", ["ls-remote", `https://github.com/${repo}.git`, `refs/heads/${branch}`], { encoding: "utf8" });
  const commit = output.split(/\s/)[0];
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`${repo}@${branch}: branch not found`);
  return commit;
}

async function check(lock) {
  const failures = [];
  for (const source of lock.sources) {
    for (const file of source.files) {
      let actual;
      try {
        actual = sha256(await readFile(new URL(file.to, root)));
      } catch {
        actual = "missing";
      }
      if (actual !== file.sha256) failures.push(`${file.to}: expected ${file.sha256}, got ${actual}`);
    }
  }
  return failures;
}

async function drift(lock) {
  const outdated = [];
  for (const source of lock.sources) {
    for (const file of source.files) {
      const upstream = sha256(await fetchBytes(source.repo, source.branch, file.from));
      if (upstream !== file.sha256) outdated.push(`${file.to} ← ${source.repo}/${file.from}`);
    }
  }
  return outdated;
}

async function writeProvenance(lock) {
  // The Meta Core lab publishes its own provenance page; keep it in step with the lock.
  for (const source of lock.sources) {
    const provenance = source.provenance;
    if (!provenance) continue;
    const url = new URL(provenance.path, root);
    const current = JSON.parse(await readFile(url, "utf8"));
    const prefix = provenance.path.replace(/[^/]+$/, "");
    current.commit = source.commit;
    current.files = Object.fromEntries(
      source.files.filter((file) => file.to.startsWith(prefix)).map((file) => [file.to.slice(prefix.length), file.sha256]),
    );
    await writeFile(url, `${JSON.stringify(current, null, 2)}\n`);
  }
}

async function update(lock, only) {
  for (const source of lock.sources) {
    if (only && source.repo !== only) continue;
    source.commit = headCommit(source.repo, source.branch);
    for (const file of source.files) {
      const bytes = await fetchBytes(source.repo, source.commit, file.from);
      await writeFile(new URL(file.to, root), bytes);
      file.sha256 = sha256(bytes);
    }
    console.log(`${source.repo} pinned at ${source.commit}`);
  }
  await writeFile(lockUrl, `${JSON.stringify(lock, null, 2)}\n`);
  await writeProvenance(lock);
}

const [mode = "--check", argument] = process.argv.slice(2);
const lock = JSON.parse(await readFile(lockUrl, "utf8"));

if (mode === "--check") {
  const failures = await check(lock);
  if (failures.length) {
    console.error(`Vendored files differ from vendor.lock.json:\n${failures.join("\n")}`);
    process.exit(1);
  }
  console.log("Vendored files match vendor.lock.json.");
} else if (mode === "--drift") {
  const outdated = await drift(lock);
  if (outdated.length) {
    console.error(`Upstream changed; run "npm run vendor:update":\n${outdated.join("\n")}`);
    process.exit(1);
  }
  console.log("Vendored files match upstream main.");
} else if (mode === "--update") {
  await update(lock, argument);
} else {
  console.error(`Unknown mode ${mode}`);
  process.exit(64);
}
