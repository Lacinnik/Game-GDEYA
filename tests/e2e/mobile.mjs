// Mobile smoke test of the built public site: run `npm run build` first (npm run test:mobile does both).
// Browsers: chromium and webkit by default; E2E_BROWSERS=chromium limits the run.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, webkit } from "playwright";

const siteRoot = resolve(fileURLToPath(new URL("../../dist-public/", import.meta.url)));
const BASE = "/Game-GDEYA/";
const contentTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8", ".md": "text/markdown; charset=utf-8",
};

function serveSite() {
  const server = createServer(async (request, response) => {
    try {
      const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");
      if (!pathname.startsWith(BASE)) throw new Error("Outside base");
      let relativePath = decodeURIComponent(pathname.slice(BASE.length));
      if (!relativePath || relativePath.endsWith("/")) relativePath += "index.html";
      const absolutePath = resolve(siteRoot, relativePath);
      if (!absolutePath.startsWith(`${siteRoot}${sep}`)) throw new Error("Outside root");
      if (!(await stat(absolutePath)).isFile()) throw new Error("Not a file");
      response.writeHead(200, { "Content-Type": contentTypes[extname(absolutePath)] ?? "application/octet-stream" });
      response.end(await readFile(absolutePath));
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done({
    url: (path = "") => `http://127.0.0.1:${server.address().port}${BASE}${path}`,
    close: () => new Promise((closed) => server.close(closed)),
  })));
}

async function assertFitsScreen(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `${label}: page scrolls horizontally by ${overflow}px`);
}

async function startGame(page, site) {
  await page.goto(site.url());
  await page.getByText("ВОЙТИ В ЖИВОЙ ЦИКЛ").click();
  await page.locator("textarea").nth(0).fill("Запустить проект");
  await page.locator("textarea").nth(1).fill("Сохранить ясность");
  await page.getByRole("button", { name: "РОДИТЬ ТОЧКУ" }).click();
}

const engines = { chromium, webkit };
const wanted = (process.env.E2E_BROWSERS ?? "chromium,webkit").split(",").map((name) => name.trim()).filter(Boolean);
const site = await serveSite();
try {
  for (const name of wanted) {
    const launchOptions = name === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};
    const browser = await engines[name].launch(launchOptions);
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await startGame(page, site);
    await page.waitForSelector(".modal");
    assert.match(await page.locator(".modal .kicker").innerText(), /1\/6/u);
    await assertFitsScreen(page, `${name} walkthrough`);
    while (await page.getByRole("button", { name: "ДАЛЕЕ" }).count()) await page.getByRole("button", { name: "ДАЛЕЕ" }).click();
    await page.getByRole("button", { name: "НАЧАТЬ" }).click();
    assert.equal(await page.locator(".modal").count(), 0, `${name}: walkthrough did not close`);
    await assertFitsScreen(page, `${name} game`);

    await startGame(page, site);
    await page.waitForTimeout(300);
    assert.equal(await page.locator(".modal").count(), 0, `${name}: walkthrough reappeared after completion`);

    for (const path of ["platform/", "labs/module/", "labs/voidocr/", "labs/meta-core/", "labs/core-separation/"]) {
      await page.goto(site.url(path));
      await page.waitForLoadState("load");
      await assertFitsScreen(page, `${name} ${path}`);
    }
    assert.deepEqual(errors, [], `${name}: page errors`);
    await browser.close();
    console.log(`✓ ${name} · iPhone 13`);
  }
} finally {
  await site.close();
}
