import { readJournal, persistJournal, downloadJson } from "../local-journal.mjs";
import { AZ, BUKI, TAGS, TRANSMISSIONS } from "./catalog.mjs";
import {
  buildPassport,
  canOpenMaterializationReceipt,
  canOpenPassport,
  createMaterializationReceipt,
  validateDraft,
  wordCount,
} from "./runtime.mjs?v=materialization-20261020-r1";

const STORAGE_KEY = "architectonica.module.passports.v1";
const catalog = { az: AZ, buki: BUKI, transmissions: TRANSMISSIONS };
const state = {
  object: "", targetRelation: "", context: "", invariant: "", tacticalAction: "", sourceTacticId: "",
  azId: "", bukaId: "", txId: "", induction: "", inversion: "", geometry: "", point: "", axis: "",
  passport: null, receipt: null, tag: "all", search: "",
};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]);

function saveEntry(entry) {
  let result;
  try { result = persistJournal(localStorage, STORAGE_KEY, entry); } catch { result = { ok: false }; }
  $("#storage-error").textContent = result.ok ? "" : "Запись не сохранена. Повреждённый или недоступный журнал не перезаписан.";
  updateJournal();
  return result.ok;
}

function journalTitle(entry, index) {
  if (canOpenMaterializationReceipt(entry)) return `След · ${entry.artifact.statement}`;
  if (canOpenPassport(entry)) return entry.object || entry.intent;
  return `Запись ${index + 1}`;
}

function updateJournal() {
  let result;
  try { result = readJournal(localStorage, STORAGE_KEY); } catch { result = { ok: false }; }
  $("#journal-count").textContent = result.ok ? String(result.entries.length) : "недоступен";
  const list = $("#journal-list");
  list.replaceChildren();
  $("#journal-message").textContent = !result.ok ? "Журнал недоступен или повреждён. Записи не изменены."
    : result.entries.length ? "Паспорта и квитанции хранятся только в этом браузере."
    : "Сохранённых записей пока нет.";
  if (!result.ok) return;
  result.entries.forEach((entry, index) => {
    const passport = canOpenPassport(entry);
    const receipt = canOpenMaterializationReceipt(entry);
    const row = document.createElement("article");
    row.className = "journal-entry";
    const title = document.createElement("h3");
    title.textContent = journalTitle(entry, index);
    const meta = document.createElement("p");
    const date = typeof entry?.createdAt === "string" ? new Date(entry.createdAt) : null;
    const stamp = date && Number.isFinite(date.getTime()) ? `${date.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК · ` : "";
    meta.textContent = passport ? `${stamp}${entry.formula.notation}`
      : receipt ? `${stamp}${entry.externalReturn.kind} · Q=null · не верифицировано`
        : "Формат записи не поддерживается для просмотра. Исходный JSON доступен без преобразования.";
    const actions = document.createElement("div");
    actions.className = "actions";
    if (passport || receipt) {
      const open = document.createElement("button");
      open.type = "button";
      open.textContent = passport ? "Открыть паспорт" : "Открыть след";
      open.addEventListener("click", () => {
        if (passport) { state.passport = entry; renderPassport(entry); setStage("passport"); }
        else { state.receipt = entry; renderReceipt(entry); setStage("trace"); }
      });
      actions.append(open);
    }
    const download = document.createElement("button");
    download.type = "button";
    download.textContent = "Скачать JSON";
    download.addEventListener("click", () => downloadJson(`module-journal-record-${index + 1}.json`, entry));
    actions.append(download);
    row.append(title, meta, actions);
    list.append(row);
  });
}

function setStage(name) {
  const order = ["axis", "alphabet", "formula", "passport", "trace"];
  const current = order.indexOf(name);
  $$('[data-stage]').forEach((section) => {
    const active = section.dataset.stage === name;
    section.classList.toggle("active", active);
    section.setAttribute("aria-hidden", String(!active));
  });
  $$('[data-go]').forEach((button, index) => button.classList.toggle("active", index <= current));
  history.replaceState(null, "", name === "alphabet" ? "#alphabet" : name === "formula" ? "#az-buki" : `#${name}`);
  window.scrollTo({ top: Math.max(0, $(".workbench").offsetTop - 18), behavior: "smooth" });
}

function syncText() {
  state.object = $("#object").value.trim();
  state.targetRelation = $("#target-relation").value.trim();
  state.context = $("#context").value.trim();
  state.invariant = $("#invariant").value.trim();
  state.tacticalAction = $("#tactical-action").value.trim();
  state.induction = $("#induction").value.trim();
  state.inversion = $("#inversion").value.trim();
  state.geometry = $("#geometry").value;
  state.point = $("#point").value;
}

function validateAxis() {
  syncText();
  const ready = wordCount(state.object) >= 3 && wordCount(state.targetRelation) >= 2 && wordCount(state.context) >= 2
    && wordCount(state.invariant) >= 2 && wordCount(state.tacticalAction) >= 2;
  $("#to-alphabet").disabled = !ready;
  $("#axis-hint").textContent = ready
    ? "O, Rg, C, инвариант и тактический шаг предъявлены раздельно."
    : "Нужны объект, целевое отношение, контекст, инвариант и один тактический шаг.";
}

function validateFormula() {
  state.passport = null;
  state.receipt = null;
  syncText();
  const errors = validateDraft(state, catalog);
  $("#compile").disabled = errors.length > 0;
  const labels = {
    OBJECT_INCOMPLETE: "объект", TARGET_RELATION_INCOMPLETE: "целевое отношение", CONTEXT_INCOMPLETE: "контекст",
    INVARIANT_INCOMPLETE: "инвариант", TACTICAL_ACTION_INCOMPLETE: "тактический шаг", AZ_REQUIRED: "Аз",
    BUKA_REQUIRED: "Бука", TRANSMISSION_REQUIRED: "Передача", INDUCTION_INCOMPLETE: "индукция",
    INVERSION_INCOMPLETE: "инверсия", GEOMETRY_REQUIRED: "геометрия", POINT_REQUIRED: "тип точки", AXIS_REQUIRED: "проверка оси",
  };
  $("#formula-hint").textContent = errors.length ? `Не завершено: ${errors.map((code) => labels[code]).filter(Boolean).join(" · ")}` : "Формула полна · паспорт готов к сборке";
}

function renderFilters() {
  const entries = [["all", "все"], ...Object.entries(TAGS)];
  $("#tag-filters").innerHTML = entries.map(([id, label]) => `<button type="button" data-tag="${id}" class="${state.tag === id ? "active" : ""}">${label}</button>`).join("");
  $$('[data-tag]').forEach((button) => button.addEventListener("click", () => { state.tag = button.dataset.tag; renderFilters(); renderAz(); }));
}

function renderAz() {
  const query = state.search.toLocaleLowerCase("ru");
  const items = AZ.filter((item) => (state.tag === "all" || item.tag === state.tag) && (!query || item.title.toLocaleLowerCase("ru").includes(query) || String(item.number).includes(query)));
  $("#az-grid").innerHTML = items.map((item) => `<button type="button" data-az="${item.id}" class="catalog-card ${state.azId === item.id ? "selected" : ""}"><i>${String(item.number).padStart(2, "0")}</i><b>${escapeHtml(item.title)}</b><span>${TAGS[item.tag]}</span></button>`).join("") || '<p class="empty">Совпадений нет.</p>';
  $$('[data-az]').forEach((button) => button.addEventListener("click", () => { state.azId = button.dataset.az; renderAz(); updateFormula(); validateFormula(); $("#to-formula").disabled = false; }));
  const selected = AZ.find((item) => item.id === state.azId);
  $("#az-selection").textContent = selected ? `${selected.id} · ${selected.title} · ${TAGS[selected.tag]}` : "Аз не выбран";
}

function renderBuki() {
  $("#buka-grid").innerHTML = BUKI.map((item) => `<button type="button" data-buka="${item.id}" class="catalog-card buka-card ${state.bukaId === item.id ? "selected" : ""}"><i>${String(item.number).padStart(2, "0")}</i><strong>${escapeHtml(item.symbol)}</strong><b>${escapeHtml(item.title)}</b><span>${TAGS[item.tag]}</span></button>`).join("");
  $$('[data-buka]').forEach((button) => button.addEventListener("click", () => { state.bukaId = button.dataset.buka; renderBuki(); updateFormula(); validateFormula(); }));
}

function renderTransmissions() {
  $("#tx-grid").innerHTML = TRANSMISSIONS.map((item) => `<button type="button" data-tx="${item.id}" class="tx-card ${state.txId === item.id ? "selected" : ""}"><i>${String(item.number).padStart(2, "0")}</i><strong>${item.symbol}</strong><span><b>${item.title}</b><small>${item.description}</small></span></button>`).join("");
  $$('[data-tx]').forEach((button) => button.addEventListener("click", () => { state.txId = button.dataset.tx; renderTransmissions(); updateFormula(); validateFormula(); }));
}

function updateFormula() {
  const az = AZ.find((item) => item.id === state.azId);
  const buka = BUKI.find((item) => item.id === state.bukaId);
  const tx = TRANSMISSIONS.find((item) => item.id === state.txId);
  $("#formula-preview").innerHTML = `<span>${escapeHtml(az?.title || "Аз")}</span><i>×</i><span>${escapeHtml(buka ? `${buka.symbol} ${buka.title}` : "Бука")}</span><i>→</i><span>${escapeHtml(tx?.title || "Передача")}</span>`;
}

function renderPassport(passport) {
  const labels = { conduct: "CONDUCT", review: "REVIEW", hold: "HOLD" };
  $("#result-state").textContent = labels[passport.outcome];
  $("#result-state").dataset.outcome = passport.outcome;
  $("#result-title").textContent = passport.outcome === "conduct" ? "Формула может быть выпущена в след." : passport.outcome === "review" ? "Формула требует дополнительного различения." : "Проведение остановлено заявленным разрывом.";
  const rows = [
    ["ID паспорта", passport.id], ["Источник тактики", passport.sourceTacticId || "прямой вход"],
    ["O · объект", passport.object || passport.intent], ["R_g · отношение", passport.targetRelation || "не было в формате 1.1"],
    ["C · контекст", passport.context || "не было в формате 1.1"], ["I · образ", passport.inversion],
    ["Выбранная формула", passport.formula.notation], ["Геометрия / точка", passport.geometry ? `${passport.geometry} · ${passport.point}` : "не было в формате 1.1"],
    ["Слово Субъекта", passport.language.layers.publicStatement], ["Истинный запрос · кандидат", passport.language.layers.trueRequest],
    ["Инвариант", passport.invariant], ["Индукция", passport.induction], ["Инверсия", passport.inversion],
    ["I₉ · следующий ход", passport.tacticalAction || passport.nextAction], ["Q · возврат", "null · не верифицирован"],
    ["Хранение", "локально в этом браузере"],
  ];
  $("#passport-output").innerHTML = rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  $("#to-trace").hidden = passport.outcome !== "conduct" || passport.schema.endsWith("/1.1.0");
}

function compile() {
  syncText();
  validateFormula();
  if (validateDraft(state, catalog).length) return;
  const passport = buildPassport(state, catalog);
  state.passport = passport;
  saveEntry(passport);
  renderPassport(passport);
  setStage("passport");
}

function renderReceipt(receipt) {
  const labels = { none: "ОТКЛИКА ПОКА НЕТ", partial: "ЧАСТИЧНЫЙ ОТКЛИК", direct: "ПРЯМОЙ ОТКЛИК", contradiction: "ПРОТИВОРЕЧАЩИЙ ОТКЛИК" };
  $("#trace-state").textContent = labels[receipt.externalReturn.kind];
  const rows = [
    ["O · объект", receipt.object], ["Артефакт", receipt.artifact.statement], ["Тип", receipt.artifact.kind],
    ["Критерий завершения", receipt.artifact.completionMarker], ["Указатель следа", receipt.artifact.evidencePointer],
    ["Внешний возврат", receipt.externalReturn.trace], ["Решение интеграции", receipt.externalReturn.integrationDecision],
    ["Доказательность", "self-reported · verified=false"], ["Q", "null"],
  ];
  $("#trace-output").innerHTML = rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  $("#trace-receipt").hidden = false;
}

function reset() {
  Object.assign(state, {
    object: "", targetRelation: "", context: "", invariant: "", tacticalAction: "", sourceTacticId: "",
    azId: "", bukaId: "", txId: "", induction: "", inversion: "", geometry: "", point: "", axis: "",
    passport: null, receipt: null, tag: "all", search: "",
  });
  $$('textarea,input[type="search"]').forEach((input) => { input.value = ""; });
  $$('select').forEach((input) => { input.value = ""; });
  $$('input[type="radio"]').forEach((input) => { input.checked = false; });
  $("#to-formula").disabled = true;
  $("#storage-error").textContent = "";
  $("#trace-receipt").hidden = true;
  renderFilters(); renderAz(); renderBuki(); renderTransmissions(); updateFormula(); validateAxis(); validateFormula(); setStage("axis");
}

function applyTacticalSeed() {
  const parameters = new URLSearchParams(location.search);
  const mapping = {
    object: ["#object", 500], target_relation: ["#target-relation", 1200], context: ["#context", 1200],
    invariant: ["#invariant", 1200], next_action: ["#tactical-action", 1200],
  };
  for (const [parameter, [selector, max]] of Object.entries(mapping)) {
    const value = parameters.get(parameter)?.trim().slice(0, max);
    if (value) $(selector).value = value;
  }
  state.sourceTacticId = parameters.get("source_tactic")?.trim().slice(0, 100) || "";
  if (state.sourceTacticId) $("#handoff-state").textContent = `Принят тактический паспорт · ${state.sourceTacticId}`;
}

for (const selector of ["#object", "#target-relation", "#context", "#invariant", "#tactical-action"]) {
  $(selector).addEventListener("input", () => { state.passport = null; validateAxis(); validateFormula(); });
}
for (const selector of ["#induction", "#inversion", "#geometry", "#point"]) $(selector).addEventListener("input", validateFormula);
$$('input[name="axis"]').forEach((input) => input.addEventListener("change", () => { state.axis = input.value; validateFormula(); }));
$("#az-search").addEventListener("input", (event) => { state.search = event.target.value; renderAz(); });
$("#to-alphabet").addEventListener("click", () => setStage("alphabet"));
$("#to-formula").addEventListener("click", () => setStage("formula"));
$("#compile").addEventListener("click", compile);
$("#new-cycle").addEventListener("click", reset);
$("#export").addEventListener("click", () => state.passport && downloadJson(`module-${state.passport.id}.json`, state.passport));
$("#to-trace").addEventListener("click", () => state.passport?.outcome === "conduct" && setStage("trace"));
$("#trace-form").addEventListener("submit", (event) => {
  event.preventDefault();
  $("#trace-error").textContent = "";
  try {
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const receipt = createMaterializationReceipt(state.passport, {
      artifactKind: data.artifact_kind, artifactStatement: data.artifact_statement, completionMarker: data.completion_marker,
      evidencePointer: data.evidence_pointer, returnKind: data.return_kind, externalTrace: data.external_trace,
      integrationDecision: data.integration_decision,
    });
    state.receipt = receipt;
    saveEntry(receipt);
    renderReceipt(receipt);
    $("#trace-receipt").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    $("#trace-error").textContent = `След не собран: ${error.message}. Нужны артефакт, указатель, внешний возврат и решение интеграции.`;
    event.currentTarget.reportValidity();
  }
});
$("#export-receipt").addEventListener("click", () => state.receipt && downloadJson(`materialization-${state.receipt.id}.json`, state.receipt));
$$('[data-go]').forEach((button) => button.addEventListener("click", () => {
  const target = button.dataset.go;
  if (target === "axis" || target === "alphabet" || (target === "formula" && state.azId)
    || (target === "passport" && state.passport) || (target === "trace" && state.passport?.outcome === "conduct")) setStage(target);
}));

applyTacticalSeed();
renderFilters(); renderAz(); renderBuki(); renderTransmissions(); updateFormula(); updateJournal(); validateAxis(); validateFormula();
window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY || event.key === null) updateJournal(); });
if (location.hash === "#alphabet") setStage("alphabet");
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
