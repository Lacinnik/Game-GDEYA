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

    for (const path of ["platform/", "ecosystem/", "product-line/", "labs/module/", "labs/voidocr/", "labs/meta-core/", "labs/core-separation/", "labs/axis-cycle/", "labs/tactics/", "labs/core-license/", "labs/creator-gate/", "labs/diagnostics/?mode=business", "labs/practice/?mode=session", "labs/facilitation/?mode=workshop", "labs/guide/?mode=oracle", "labs/rhythm/?mode=switcher", "labs/frontier/?mode=ontology", "labs/certification/"]) {
      await page.goto(site.url(path));
      await page.waitForLoadState("load");
      await assertFitsScreen(page, `${name} ${path}`);
    }

    // SC-5 research lab: same-cycle baseline / follow-up, persistent browser history.
    const sc5Cycle = "cycle-e2e-research-001";
    const sc5Base = `labs/sc5-chronos/?cycleId=${sc5Cycle}&phase=before`;
    await page.goto(site.url(sc5Base));
    await page.waitForSelector("#items .question");
    assert.equal(await page.locator("#items .question").count(), 15, `${name}: SC-5 indicators`);
    await page.locator("#consent").check();
    for (const question of await page.locator("#items .question").all()) await question.locator("button").nth(2).click();
    await page.locator("#save").click();
    assert.match(await page.locator("#count").innerText(), /1/u);
    await page.reload();
    assert.match(await page.locator("#count").innerText(), /1/u);
    await page.goto(site.url(`labs/sc5-chronos/?cycleId=${sc5Cycle}&phase=after`));
    await page.locator("#consent").check();
    for (const question of await page.locator("#items .question").all()) await question.locator("button").nth(3).click();
    await page.locator("#save").click();
    assert.match(await page.locator("#history").innerText(), /Парное изменение/u);
    assert.match(await page.locator("#history").innerText(), /alpha 0\.250/u);
    await assertFitsScreen(page, `${name} SC-5 lab`);
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

    await desktopPage.goto(site.url("labs/core-license/"));
    const licenseValues = {
      object:"Архитектура решений", target_relation:"Передать ограниченный контур", context:"Пилот команды", invariant:"Сохранить ядро",
      organization:"Тестовая организация", responsible_party:"Владелец пилота", application:"Один рабочий процесс", allowed_use:"Внутренний пилот",
      excluded_use:"Публичная перепродажа", implementation_boundary:"Автор проектирует, команда исполняет", evidence_plan:"Артефакты и внешнее наблюдение",
    };
    for (const [field,value] of Object.entries(licenseValues)) await desktopPage.locator(`[name="${field}"]`).fill(value);
    await desktopPage.getByText("ГДЕЯ", { exact:true }).click();
    await desktopPage.getByRole("button", { name:"Собрать досье готовности →" }).click();
    await desktopPage.waitForSelector("#result:not([hidden])");
    assert.match(await desktopPage.locator("#result-state").innerText(), /0\/5/u);
    assert.match(await desktopPage.locator("#result-output").innerText(), /verified=false · Q=null/u);
    await assertFitsScreen(desktopPage, `${name} core license desktop`);

    await desktopPage.goto(site.url("labs/creator-gate/"));
    const requestValues = {
      object:"Закрытый корпус", subject_manifestation:"Собран рабочий артефакт", reflected_image:"Вижу связь смысла и структуры", target_relation:"Запросить рассмотрение",
      context:"Личная исследовательская работа", invariant:"Не присваивать роль", purpose:"Сверить один фрагмент", prior_trace:"Один паспорт",
      contribution:"Подготовить отчёт", requested_material:"Один фрагмент", boundaries:"Без персональных данных", sponsor_reference:"нет",
    };
    for (const [field,value] of Object.entries(requestValues)) await desktopPage.locator(`[name="${field}"]`).fill(value);
    await desktopPage.locator('[name="role"]').selectOption("research");
    for (const label of await desktopPage.locator(".acknowledgements label").all()) await label.click();
    await desktopPage.getByRole("button", { name:"Собрать запрос →" }).click();
    await desktopPage.waitForSelector("#result:not([hidden])");
    assert.match(await desktopPage.locator("#result").innerText(), /ACCESS GRANTED = FALSE/u);
    assert.match(await desktopPage.locator("#result").innerText(), /Решение не присвоено/u);
    await assertFitsScreen(desktopPage, `${name} creator gate desktop`);

    await desktopPage.goto(site.url("labs/diagnostics/?mode=business"));
    const diagnosticValues = {
      object:"Пилот диагностического маршрута", subject_manifestation:"Собран один рабочий протокол", reflected_image:"Виден разрыв между потоком и результатом",
      target_relation:"Найти один проверяемый следующий ход", context:"Один проект, последние две недели", invariant:"Не выдавать самоотчёт за диагноз",
      observation_window:"Последние две недели", evidence_pointer:"docs/pilot.md", next_action:"Проверить минимальный сектор на одной встрече",
    };
    for (const [field,value] of Object.entries(diagnosticValues)) await desktopPage.locator(`[name="${field}"]`).fill(value);
    for (const field of await desktopPage.locator("[data-answer]").all()) await field.selectOption("0.5");
    await desktopPage.getByRole("button", { name:"Собрать диагностический паспорт →" }).click();
    await desktopPage.waitForSelector("#result:not([hidden])");
    assert.match(await desktopPage.locator("#result").innerText(), /diagnosis=false/u);
    assert.match(await desktopPage.locator("#result").innerText(), /Q=null/u);
    await assertFitsScreen(desktopPage, `${name} diagnostics desktop`);
    await desktopPage.getByRole("button", { name:"Передать в Тактику →" }).click();
    await desktopPage.waitForURL(/\/labs\/tactics\/\?/u);
    assert.equal(await desktopPage.locator('[name="object"]').inputValue(), diagnosticValues.object);
    assert.equal(await desktopPage.locator('[name="invariant"]').inputValue(), diagnosticValues.invariant);

    await desktopPage.goto(site.url("labs/practice/?mode=session"));
    const practiceValues = {
      object:"Пилот практического цикла", subject_manifestation:"Существует один рабочий черновик", reflected_image:"Черновик воспринимается как незавершённый",
      target_relation:"Провести объект к одному внешнему следу", context:"Один проект и девяносто минут", invariant:"Не подменять объект оценкой человека",
      start_date:"2026-10-20", evidence_policy:"Локальный документ и ссылка на артефакт", first_action:"За двадцать минут собрать один абзац", completion_signal:"Шесть отдельных квитанций",
    };
    for (const [field,value] of Object.entries(practiceValues)) await desktopPage.locator(`#plan-form [name="${field}"]`).fill(value);
    await desktopPage.getByRole("button", {name:"Собрать план цикла →"}).click();
    await desktopPage.waitForSelector("#dashboard:not([hidden])");
    assert.match(await desktopPage.locator("#progress-count").innerText(),/0 \/ 6/u);
    for (const field of await desktopPage.locator("[data-receipt]").all()) await field.fill("Зафиксирован один наблюдаемый след.");
    await desktopPage.locator('#receipt-form [name="evidence_pointer"]').fill("docs/session.md#step-1");
    await desktopPage.getByRole("button", {name:"Сохранить квитанцию ↓"}).click();
    assert.match(await desktopPage.locator("#progress-count").innerText(),/1 \/ 6/u);
    assert.match(await desktopPage.locator("#dashboard").innerText(),/outcome_confirmed=false/u);
    await assertFitsScreen(desktopPage,`${name} practice studio desktop`);
    await desktopPage.getByRole("button", {name:"Передать первый шаг в Тактику →"}).click();
    await desktopPage.waitForURL(/\/labs\/tactics\/\?/u);
    assert.equal(await desktopPage.locator('[name="object"]').inputValue(),practiceValues.object);
    assert.equal(await desktopPage.locator('[name="invariant"]').inputValue(),practiceValues.invariant);

    await desktopPage.goto(site.url("labs/facilitation/?mode=workshop"));
    const facilitationValues = {
      object:"Редакционный цикл команды", subject_manifestation:"Существуют два черновика и один протокол", reflected_image:"Команда называет процесс несогласованным",
      target_relation:"Собрать одну предъявимую версию", context:"Три рабочие роли и одна встреча", invariant:"Сохранить авторство каждого вклада",
      title:"Мастерская редакционного решения", facilitator_role:"Удерживает процесс и не решает за группу", participant_roles:"Автор, редактор, продюсер",
      start_date:"2026-10-20", duration:"90 минут", observation_boundary:"Только общая речь, действия и рабочие артефакты", storage_policy:"Локально; экспорт по отдельному решению группы", withdrawal_path:"Стоп-сигнал и право исправить или отозвать вклад",
    };
    for (const [field,value] of Object.entries(facilitationValues)) await desktopPage.locator(`#plan-form [name="${field}"]`).fill(value);
    for (const field of ["voluntary_consent","shared_boundary_ack","no_people_scoring_ack"]) await desktopPage.locator(`#plan-form [name="${field}"]`).check();
    await desktopPage.getByRole("button",{name:"Собрать фасилитационный план →"}).click();
    await desktopPage.waitForSelector("#dashboard:not([hidden])");
    assert.match(await desktopPage.locator("#progress-count").innerText(),/0 \/ 6/u);
    await desktopPage.locator('#note-form [name="role_scope"]').fill("Группа целиком");
    await desktopPage.locator('#note-form [name="evidence_pointer"]').fill("protocol.md#charter");
    for (const field of await desktopPage.locator("[data-note]").all()) await field.fill("Запись отделена от оценки человека и допускает корректировку.");
    await desktopPage.locator('#note-form [name="participant_reviewed"]').check();
    await desktopPage.getByRole("button",{name:"Сохранить квитанцию ↓"}).click();
    assert.match(await desktopPage.locator("#progress-count").innerText(),/1 \/ 6/u);
    assert.match(await desktopPage.locator("#dashboard").innerText(),/people_scored=false/u);
    await assertFitsScreen(desktopPage,`${name} facilitation studio desktop`);
    await desktopPage.getByRole("button",{name:"Передать объект в Практику →"}).click();
    await desktopPage.waitForURL(/\/labs\/practice\/\?/u);
    assert.equal(await desktopPage.locator('[name="object"]').inputValue(),facilitationValues.object);
    assert.equal(await desktopPage.locator('[name="invariant"]').inputValue(),facilitationValues.invariant);

    await desktopPage.goto(site.url("labs/guide/?mode=oracle"));
    const guideValues = {
      object:"Вопрос цифрового прохода", subject_manifestation:"Записан один наблюдаемый факт", reflected_image:"Вопрос выглядит как развилка",
      target_relation:"Получить один проверяемый следующий ход", context:"Личная работа, двадцать минут", invariant:"Не выдавать отражение за истину",
      opening_question:"Что я пока смешиваю в этом вопросе?", first_action:"Записать две стороны разрыва",
      evidence_policy:"Локальная запись и рабочий документ", human_handoff:"Остановиться при необходимости профессиональной оценки",
    };
    for (const [field,value] of Object.entries(guideValues)) await desktopPage.locator(`#session-form [name="${field}"]`).fill(value);
    await desktopPage.locator('#session-form [name="request_type"]').selectOption("clarity");
    await desktopPage.locator('#session-form [name="lens"]').selectOption("TX4");
    for (const field of ["authorship_ack","no_prediction_ack","local_storage_ack"]) await desktopPage.locator(`#session-form [name="${field}"]`).check();
    await desktopPage.getByRole("button",{name:"Запустить цифровой проход →"}).click();
    await desktopPage.waitForSelector("#dashboard:not([hidden])");
    assert.match(await desktopPage.locator("#progress-count").innerText(),/0 \/ 5/u);
    const guideReceipt = {
      authored_response:"Я различил объект и ожидаемый исход", observed_trace:"Существуют две отдельные формулировки",
      interpretation:"Гипотеза: различение снизит неопределённость", next_action:"Переписать вопрос одним предложением",
      evidence_pointer:"notes/question.md",
    };
    for (const [field,value] of Object.entries(guideReceipt)) await desktopPage.locator(`#receipt-form [name="${field}"]`).fill(value);
    await desktopPage.locator('#receipt-form [name="evidence_status"]').selectOption("hypothesis");
    await desktopPage.getByRole("button",{name:"Сохранить квитанцию ↓"}).click();
    assert.match(await desktopPage.locator("#progress-count").innerText(),/1 \/ 5/u);
    assert.match(await desktopPage.locator("#dashboard").innerText(),/assistant_authority=false/u);
    await assertFitsScreen(desktopPage,`${name} digital guide desktop`);
    await desktopPage.getByRole("button",{name:"Передать в Практику →"}).click();
    await desktopPage.waitForURL(/\/labs\/practice\/\?/u);
    assert.equal(await desktopPage.locator('[name="object"]').inputValue(),guideValues.object);
    assert.equal(await desktopPage.locator('[name="invariant"]').inputValue(),guideValues.invariant);

    await desktopPage.goto(site.url("labs/rhythm/?mode=switcher"));
    const rhythmValues = {
      object:"Переход от исследования к сборке", subject_manifestation:"Существует рабочая заметка и пустой макет", reflected_image:"Исследование кажется незавершённым",
      target_relation:"Явно начать сборку прототипа", context:"Один автор и один рабочий блок", invariant:"Сохранить исходные наблюдения",
      start_date:"2026-10-20", time_budget:"Один блок до двадцати минут", evidence_policy:"Локальная запись и ссылка на макет",
      stop_condition:"Остановиться при потере объекта или необходимости профильной оценки",
    };
    for (const [field,value] of Object.entries(rhythmValues)) await desktopPage.locator(`#plan-form [name="${field}"]`).fill(value);
    await desktopPage.locator('#plan-form [name="intent"]').selectOption("change");
    for (const field of ["authorship_ack","non_medical_ack","local_schedule_ack"]) await desktopPage.locator(`#plan-form [name="${field}"]`).check();
    await desktopPage.getByRole("button",{name:"Собрать ритм →"}).click();
    await desktopPage.waitForSelector("#dashboard:not([hidden])");
    assert.match(await desktopPage.locator("#progress-count").innerText(),/0 \/ 4/u);
    const rhythmCheckin = {
      observed_trace:"Закрыт документ исследования и открыт макет", interpretation:"Маркер помог различить два контекста",
      next_action:"Собрать первый блок макета", evidence_pointer:"prototype/index.html",
    };
    for (const [field,value] of Object.entries(rhythmCheckin)) await desktopPage.locator(`#checkin-form [name="${field}"]`).fill(value);
    await desktopPage.locator('#checkin-form [name="completion_state"]').selectOption("done");
    await desktopPage.locator('#checkin-form [name="evidence_status"]').selectOption("observed");
    await desktopPage.getByRole("button",{name:"Сохранить квитанцию ↓"}).click();
    assert.match(await desktopPage.locator("#progress-count").innerText(),/1 \/ 4/u);
    assert.match(await desktopPage.locator("#done-count").innerText(),/выполнено 1/u);
    assert.match(await desktopPage.locator("#dashboard").innerText(),/automated_notification=false/u);
    await assertFitsScreen(desktopPage,`${name} rhythm studio desktop`);
    await desktopPage.getByRole("button",{name:"Передать в Проводник →"}).click();
    await desktopPage.waitForURL(/\/labs\/guide\/\?/u);
    assert.equal(await desktopPage.locator('[name="object"]').inputValue(),rhythmValues.object);
    assert.equal(await desktopPage.locator('[name="invariant"]').inputValue(),rhythmValues.invariant);

    await desktopPage.goto(site.url("labs/frontier/?mode=ontology"));
    await desktopPage.waitForFunction(() => document.querySelector('[name="specific_entities"]'));
    const frontierValues = {
      object:"Версионированный контракт O–S–I–R_g–C–Q", subject_manifestation:"Существуют три паспорта действующих продуктов", reflected_image:"Схема кажется общей для всех вертикалей",
      target_relation:"Проверить совместимость трёх паспортов", context:"Локальный прототип без внешнего API", invariant:"Не подменять объект категорией и не заполнять неизвестное нулём",
      scenario_title:"Три паспорта → одна схема → отчёт ошибок", participant:"Автор схемы и разработчик интеграции", duration:"90 минут",
      success_signal:"Три маппинга проходят валидацию либо возвращают явные несовместимости", stop_condition:"Остановиться при потере исходного объекта или неявном преобразовании",
      specific_entities:"Object, subject trace, reflected image, target relation, context and nullable Q",
      specific_relations:"Every relation names its target g and evidence status",
      specific_examples:"Тактика, Материализация и Цифровой проводник",
    };
    for (const [field,value] of Object.entries(frontierValues)) await desktopPage.locator(`#blueprint-form [name="${field}"]`).fill(value);
    for (const field of ["authorship_ack","boundary_ack","local_ack"]) await desktopPage.locator(`#blueprint-form [name="${field}"]`).check();
    await desktopPage.getByRole("button",{name:"Собрать прототип →"}).click();
    await desktopPage.waitForSelector("#dashboard:not([hidden])");
    assert.match(await desktopPage.locator("#progress-count").innerText(),/0 \/ 4/u);
    const frontierReceipt = { observed_trace:"Три паспорта преобразованы, один вернул несовместимое имя поля", interpretation:"Схеме нужен явный адаптер версии", evidence_pointer:"schemas/report.json", next_action:"Добавить версию адаптера без изменения O" };
    for (const [field,value] of Object.entries(frontierReceipt)) await desktopPage.locator(`#receipt-form [name="${field}"]`).fill(value);
    await desktopPage.locator('#receipt-form [name="completion_state"]').selectOption("done");
    await desktopPage.locator('#receipt-form [name="evidence_status"]').selectOption("observed");
    await desktopPage.getByRole("button",{name:"Сохранить квитанцию ↓"}).click();
    assert.match(await desktopPage.locator("#progress-count").innerText(),/1 \/ 4/u);
    assert.match(await desktopPage.locator("#dashboard").innerText(),/prototype_validated=false/u);
    await assertFitsScreen(desktopPage,`${name} frontier foundry desktop`);
    await desktopPage.getByRole("button",{name:"Передать дальше →"}).click();
    await desktopPage.waitForURL(/\/labs\/guide\/\?/u);
    assert.equal(await desktopPage.locator('[name="object"]').inputValue(),frontierValues.object);
    assert.equal(await desktopPage.locator('[name="invariant"]').inputValue(),frontierValues.invariant);

    await desktopPage.goto(site.url("labs/certification/"));
    const certificationValues = {
      candidate_name:"Кандидат E2E", candidate_role:"Ведущий практики", requested_scope:"Одна групповая практика ГДЕЯ", method_scope:"ГДЕЯ и РЕЗОН",
      prerequisite_trace:"Три учебных протокола", supervision_plan:"Три кейса под наблюдением", object:"Подготовка досье ведущего",
      subject_manifestation:"Кандидат завершил учебный цикл", reflected_image:"Подготовка кажется достаточной для проверки", target_relation:"Собрать проверяемый пакет",
      context:"Учебная группа и локальные записи", invariant:"Не присваивать решение участника", canon_reference:"draft/canon-v0.1", competency_version:"draft-0.1", ethics_reference:"draft/ethics-v0.1",
    };
    for (const [field,value] of Object.entries(certificationValues)) await desktopPage.locator(`#dossier-form [name="${field}"]`).fill(value);
    for (const field of ["authorship_ack","consent_ack","boundary_ack","authorization_ack"]) await desktopPage.locator(`#dossier-form [name="${field}"]`).check();
    await desktopPage.getByRole("button",{name:"Собрать досье готовности →"}).click();
    await desktopPage.waitForSelector("#dashboard:not([hidden])");
    assert.match(await desktopPage.locator("#case-count").innerText(),/0 \/ 3/u);
    assert.match(await desktopPage.locator("#dashboard").innerText(),/certificate_issued=false/u);
    assert.equal(await desktopPage.locator('#package-form button[type="submit"]').isEnabled(),false);

    const certificationReview = {
      reviewer_name:"Заявленный супервизор E2E", reviewer_role:"Заявленная роль супервизора", review_date:"2026-10-20",
      review_note:"Рекомендация относится только к технической передаче пакета.",
    };
    for (const [field,value] of Object.entries(certificationReview)) await desktopPage.locator(`#review-form [name="${field}"]`).fill(value);
    for (const competency of ["object-authorship","evidence-separation","consent-withdrawal","process-boundary","evidence-escalation"]) {
      await desktopPage.locator(`#review-form [name="status-${competency}"]`).selectOption("observed");
      await desktopPage.locator(`#review-form [name="basis-${competency}"]`).fill(`Синтетическое основание ${competency}`);
    }
    await desktopPage.locator('#review-form [name="recommendation"]').selectOption("ready-for-authorized-review");
    await desktopPage.getByRole("button",{name:"Сохранить разбор ↓"}).click();
    assert.match(await desktopPage.locator("#review-error").innerText(),/до трёх технически подходящих кейсов/u);
    assert.equal(await desktopPage.locator("#review-list article").count(),0);

    for (let index = 1; index <= 3; index += 1) {
      const certificationCase = {
        case_title:`Супервизируемый кейс ${index}`, practice_date:"2026-10-20", object:"Один проектный переход", participant_scope:"Добровольный участник без персональных данных",
        observed_trace:"Участник сам сформулировал объект и следующий шаг", candidate_reflection:"Ведущий удержал процесс", consent_trace:`consent/case-${index}.md`,
        supervisor_reference:"supervision/review.md", evidence_pointer:`evidence/case-${index}.json`,
      };
      for (const [field,value] of Object.entries(certificationCase)) await desktopPage.locator(`#case-form [name="${field}"]`).fill(value);
      await desktopPage.locator('#case-form [name="participant_consent"]').check();
      await desktopPage.getByRole("button",{name:"Сохранить кейс ↓"}).click();
    }
    assert.match(await desktopPage.locator("#case-count").innerText(),/3 \/ 3/u);
    assert.match(await desktopPage.locator("#dashboard").innerText(),/result=false/u);
    assert.equal(await desktopPage.locator('#package-form button[type="submit"]').isEnabled(),false);

    await desktopPage.locator('#review-form [name="status-process-boundary"]').selectOption("needs-review");
    await desktopPage.getByRole("button",{name:"Сохранить разбор ↓"}).click();
    assert.match(await desktopPage.locator("#review-error").innerText(),/все пять компетенций/u);
    await desktopPage.locator('#review-form [name="status-process-boundary"]').selectOption("observed");
    await desktopPage.getByRole("button",{name:"Сохранить разбор ↓"}).click();
    assert.equal(await desktopPage.locator("#review-list article").count(),1);
    assert.match(await desktopPage.locator("#package-gate").innerText(),/подлинность и утверждённость студия не проверяет/u);
    assert.equal(await desktopPage.locator('#package-form button[type="submit"]').isEnabled(),true);

    const certificationPackage = {
      canon_reference:"fake://canon", competency_reference:"fake://competencies", ethics_reference:"fake://ethics",
      access_policy_reference:"fake://access", legal_review_reference:"fake://legal", requested_decision:"Синтетический запрос на человеческое рассмотрение",
    };
    for (const [field,value] of Object.entries(certificationPackage)) await desktopPage.locator(`#package-form [name="${field}"]`).fill(value);
    await desktopPage.getByRole("button",{name:"Собрать пакет рассмотрения →"}).click();
    assert.match(await desktopPage.locator("#package-result").innerText(),/ТЕХНИЧЕСКИ СОБРАН · СВЕДЕНИЯ НЕ ВЕРИФИЦИРОВАНЫ/u);
    assert.match(await desktopPage.locator("#package-result").innerText(),/reviewer_authority_verified=false/u);
    assert.match(await desktopPage.locator("#package-result").innerText(),/canon_approved=false/u);
    await assertFitsScreen(desktopPage,`${name} certification readiness desktop`);
    await desktopContext.close();
    assert.deepEqual(errors, [], `${name}: page errors`);
    await browser.close();
    console.log(`✓ ${name} · iPhone 13`);
  }
} finally {
  await site.close();
}
