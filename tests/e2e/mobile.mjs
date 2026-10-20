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

    for (const path of ["platform/", "ecosystem/", "labs/module/", "labs/voidocr/", "labs/meta-core/", "labs/core-separation/", "labs/axis-cycle/", "labs/tactics/"]) {
      await page.goto(site.url(path));
      await page.waitForLoadState("load");
      await assertFitsScreen(page, `${name} ${path}`);
    }

    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desktopPage = await desktopContext.newPage();
    desktopPage.on("pageerror", (error) => errors.push(`desktop: ${error.message}`));
    await desktopPage.goto(site.url("ecosystem/"));
    await desktopPage.getByPlaceholder("Например: диагностика, агент, команда…").fill("онтологический");
    await desktopPage.getByRole("button", { name: "Цифровые оболочки" }).click();
    assert.match(await desktopPage.locator("#filter-result").innerText(), /Показано 1 из 56/u);
    await desktopPage.getByRole("button", { name: "Паспорт объекта" }).click();
    await desktopPage.getByRole("link", { name: "Передать в ось →" }).click();
    await desktopPage.waitForFunction(() => document.querySelector('[name="object"]')?.value.length > 0);
    assert.match(await desktopPage.locator('[name="object"]').inputValue(), /Программный интерфейс различения объектов/u);
    assert.equal(await desktopPage.locator('[name="context"]').inputValue(), "Цифровая экосистема · ИИ/API онтологический движок");
    await assertFitsScreen(desktopPage, `${name} ecosystem desktop handoff`);

    const tacticSeed = new URLSearchParams({ object: "Проверяемый объект тактики", context: "E2E · локальный контекст" });
    await desktopPage.goto(site.url(`labs/tactics/?${tacticSeed.toString()}#workbench`));
    await desktopPage.waitForFunction(() => document.querySelector('[name="object"]')?.value.length > 0);
    await desktopPage.locator('[name="target_relation"]').fill("Перевести объект в один шаг");
    await desktopPage.locator('[name="invariant"]').fill("Сохранить исходный объект");
    await desktopPage.locator('[name="metric_basis"]').fill("Есть 15 минут, один исполнитель и рабочий документ.");
    for (const [field, value] of [["noise", "0.25"], ["local_density", "0.75"], ["focus", "1"], ["scope", "0.25"], ["time_load", "0.5"], ["energy", "0.75"], ["environment", "m2"]]) {
      await desktopPage.locator(`[name="${field}"]`).selectOption(value);
    }
    await desktopPage.locator('[name="planned_minutes"]').fill("15");
    await desktopPage.locator('[name="micro_decision"]').fill("Собрать один абзац");
    await desktopPage.locator('[name="micro_vector"]').fill("К проверяемой формулировке");
    await desktopPage.locator('[name="action"]').fill("Написать и сохранить один абзац");
    await desktopPage.locator('[name="completion_signal"]').fill("Абзац существует в документе");
    await desktopPage.locator('[name="micro_collapse"]').fill("Закрыть редактор и сделать паузу");
    await desktopPage.getByRole("button", { name: "Собрать тактический паспорт →" }).click();
    await desktopPage.waitForSelector("#plan-stage:not([hidden])");
    assert.match(await desktopPage.locator("#plan-passport").innerText(), /Q = null/u);
    await desktopPage.locator('[name="action_result"]').fill("Абзац сохранён.");
    await desktopPage.locator('[name="elapsed_minutes"]').fill("12");
    await desktopPage.locator('[name="correction"]').fill("Убран второй сценарий.");
    await desktopPage.locator('[name="recognition"]').fill("Одного абзаца достаточно для проверки.");
    await desktopPage.locator('[name="synthesis"]').fill("Следующий цикл — после чтения участником.");
    await desktopPage.getByRole("button", { name: "Собрать квитанцию ↓" }).click();
    await desktopPage.waitForSelector("#receipt:not([hidden])");
    assert.match(await desktopPage.locator("#receipt").innerText(), /Q = null/u);
    await assertFitsScreen(desktopPage, `${name} tactics desktop cycle`);

    await desktopPage.locator("#materialize-plan").click();
    await desktopPage.waitForURL(/\/labs\/module\//u);
    assert.equal(await desktopPage.locator("#object").inputValue(), "Проверяемый объект тактики");
    assert.equal(await desktopPage.locator("#target-relation").inputValue(), "Перевести объект в один шаг");
    assert.equal(await desktopPage.locator("#context").inputValue(), "E2E · локальный контекст");
    assert.equal(await desktopPage.locator("#tactical-action").inputValue(), "Написать и сохранить один абзац");
    assert.match(await desktopPage.locator("#handoff-state").innerText(), /Принят тактический паспорт/u);
    await desktopPage.locator("#to-alphabet").click();
    await desktopPage.locator('[data-az="A1"]').click();
    await desktopPage.locator("#to-formula").click();
    await desktopPage.locator('[data-buka="B1"]').click();
    await desktopPage.locator('[data-tx="TX5"]').click();
    await desktopPage.locator("#induction").fill("Активирую ясное действие");
    await desktopPage.locator("#inversion").fill("Принимаю доступную форму");
    await desktopPage.locator("#geometry").selectOption("Euclid");
    await desktopPage.locator("#point").selectOption("Вход");
    await desktopPage.getByText("Сохраняет", { exact: true }).click();
    await desktopPage.locator("#compile").click();
    await desktopPage.waitForSelector('[data-stage="passport"].active');
    assert.match(await desktopPage.locator("#passport-output").innerText(), /Q · возврат\s+null/iu);
    await desktopPage.locator("#to-trace").click();
    await desktopPage.locator('[name="artifact_kind"]').selectOption("document");
    await desktopPage.locator('[name="return_kind"]').selectOption("partial");
    await desktopPage.locator('[name="artifact_statement"]').fill("Создан один рабочий абзац");
    await desktopPage.locator('[name="completion_marker"]').fill("Абзац сохранён в документе");
    await desktopPage.locator('[name="evidence_pointer"]').fill("docs/working-note.md#paragraph-1");
    await desktopPage.locator('[name="external_trace"]').fill("Один участник оставил уточнение");
    await desktopPage.locator('[name="integration_decision"]').fill("Сохранить форму и уточнить термин");
    await desktopPage.getByRole("button", { name: "Собрать квитанцию следа ↓" }).click();
    await desktopPage.waitForSelector("#trace-receipt:not([hidden])");
    assert.match(await desktopPage.locator("#trace-receipt").innerText(), /verified=false/u);
    assert.match(await desktopPage.locator("#trace-receipt").innerText(), /Q\s+null/u);
    await assertFitsScreen(desktopPage, `${name} materialization desktop cycle`);
    await desktopContext.close();
    assert.deepEqual(errors, [], `${name}: page errors`);
    await browser.close();
    console.log(`✓ ${name} · iPhone 13`);
  }
} finally {
  await site.close();
}
