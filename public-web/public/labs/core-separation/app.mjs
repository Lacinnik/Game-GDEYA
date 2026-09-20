import { CONTEXTS, LAWS, NODES, RESPONSES, SKELLU_PROMPTS, STATES } from "./catalog.mjs";
import { compileSeparationLanguage, createPassport, detectInvariant, integrateReturn, languageFromPassport, safeJournal, validateEpisode, validateOplus } from "./runtime.mjs";

import { readJournal, upsertPassport, mergeJournal, destroyJournal } from "./core/storage.mjs";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
const state = { contextId: "", episode: "", index: 0, answers: {}, interception: null, passport: null };

function reportError(error) {
  $("#storage-status").textContent = "Операция не завершена: " + error.message + " Сохраните исходный файл; не удаляйте прежний журнал.";
}
function guarded(action) { return async (...args) => { try { $("#storage-status").textContent = ""; await action(...args); } catch(error) { reportError(error); } }; }

function route(name) {
  $$('[data-panel]').forEach((panel) => { const active = panel.dataset.panel === name; panel.classList.toggle("active", active); panel.setAttribute("aria-hidden", String(!active)); });
  const order = ["episode", "distinguish", "oplus", "map", "return"];
  const current = order.indexOf(name);
  $$('[data-route]').forEach((button, index) => button.classList.toggle("active", index <= current));
  history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: Math.max(0, $(".phase-nav").offsetTop - 8), behavior: "smooth" });
}

function renderContexts() {
  $("#contexts").innerHTML = CONTEXTS.map((context) => `<button class="context-card ${state.contextId === context.id ? "selected" : ""}" data-context="${context.id}"><i>${context.id}</i><b>${context.name}</b><span>${context.description}</span></button>`).join("");
  $$('[data-context]').forEach((button) => button.addEventListener("click", () => { state.contextId = button.dataset.context; renderContexts(); validateEpisodeScreen(); }));
}
function validateEpisodeScreen() {
  state.episode = $("#episode").value.trim();
  const errors = validateEpisode(state);
  $("#start").disabled = errors.length > 0;
  $("#episode-hint").textContent = errors.length ? "Нужны выбранный контур и один конкретный эпизод минимум из пяти слов." : "Эпизод предъявлен · можно входить в семь различений.";
}

function currentNode() { return NODES.find((node) => node.contextId === state.contextId && node.lawId === LAWS[state.index].id); }
function renderNode() {
  const node = currentNode();
  $("#node-title").textContent = `${node.lawId} · ${node.law}`;
  $("#node-count").textContent = `${state.index + 1} / 7`;
  $("#node-id").textContent = node.id;
  $("#node-operator").textContent = node.operator;
  $("#node-question").textContent = node.question;
  $("#responses").innerHTML = RESPONSES.map((response) => `<button class="response ${state.answers[node.lawId] === response.code ? "selected" : ""}" data-response="${response.code}" style="--state-color:var(--state${response.state})"><i>${response.state}</i><b>${response.label}</b></button>`).join("");
  $$('[data-response]').forEach((button) => button.addEventListener("click", () => { state.answers[node.lawId] = button.dataset.response; renderNode(); }));
  $("#previous").disabled = state.index === 0;
  $("#next").disabled = !state.answers[node.lawId];
  $("#next").innerHTML = state.index === 6 ? "Собрать узел перехвата <span>→</span>" : "Следующий узел <span>→</span>";
  $("#skellu-prompt").textContent = state.answers[node.lawId] === "counterdependence" ? SKELLU_PROMPTS.counterdependence : SKELLU_PROMPTS[node.lawId] || SKELLU_PROMPTS.default;
}

function answerState(lawId) { return RESPONSES.find((response) => response.code === state.answers[lawId]); }
function interceptionForAnswers() {
  const ranked = LAWS.map((law) => ({ law, response: answerState(law.id) })).sort((a, b) => a.response.state - b.response.state);
  const lowest = ranked[0];
  return { lawId: lowest.law.id, law: lowest.law.name, state: lowest.response.state, stateName: STATES[lowest.response.state].name, stateDescription: STATES[lowest.response.state].description };
}
function renderInterception() {
  state.interception = interceptionForAnswers();
  $("#interception").innerHTML = `<b>Узел перехвата · ${state.interception.lawId} ${escapeHtml(state.interception.law)}</b><br>${state.interception.stateName} · ${escapeHtml(state.interception.stateDescription)}<br><small>Это рабочая гипотеза выбранного эпизода, не оценка личности.</small>`;
  renderLanguagePreview(true);
}
function languageDraft(subjectConfirmed = false) {
  const context = CONTEXTS.find((item) => item.id === state.contextId);
  return compileSeparationLanguage({ context, episode: state.episode, interception: state.interception || interceptionForAnswers(), action: $("#action").value, criterion: $("#criterion").value, subjectConfirmed });
}
function renderLanguage(prefix, language) {
  $(`#${prefix}-statement`).textContent = language.layers.publicStatement;
  $(`#${prefix}-formula`).textContent = language.formula;
  $(`#${prefix}-selection`).textContent = `${language.selection.az.id} · ${language.selection.az.title}  ×  ${language.selection.buka.id} · ${language.selection.buka.symbol} ${language.selection.buka.title}  →  ${language.selection.transmission.id} · ${language.selection.transmission.symbol} ${language.selection.transmission.title}`;
}
function renderLanguagePreview(resetConfirmation = false) {
  if (resetConfirmation) $("#language-confirmed").checked = false;
  renderLanguage("language-preview", languageDraft($("#language-confirmed").checked));
}
function validateGate() {
  const draft = { action: $("#action").value, criterion: $("#criterion").value, owned: $("#owned").checked, consentFree: $("#consent-free").checked, languageConfirmed: $("#language-confirmed").checked };
  const errors = validateOplus(draft);
  $("#conduct").disabled = errors.length > 0;
  const labels = { ACTION_INCOMPLETE: "сформулируй действие", ACTION_NOT_SINGLE: "оставь один шаг", CRITERION_INCOMPLETE: "добавь критерий", ACTION_NOT_OWNED: "подтверди свою исполнимость", ACTION_REQUIRES_CONSENT: "отдели шаг от согласия Другого", LANGUAGE_UNCONFIRMED: "подтверди Слово Субъекта" };
  $("#gate-hint").textContent = errors.length ? `Gate закрыт: ${errors.map((error) => labels[error]).join(" · ")}.` : "Gate открыт · шаг принадлежит субъекту и допускает наблюдаемый возврат.";
}

function compile() {
  const passport = createPassport({ contextId: state.contextId, episode: state.episode, answers: state.answers, action: $("#action").value, criterion: $("#criterion").value, languageConfirmed: $("#language-confirmed").checked });
  upsertPassport(passport); state.passport = passport; renderMap(); route("map");
}
function passportRows(passport) {
  return [["Контур", passport.context.name], ["O · эпизод", passport.object], ["S · след действия", passport.subjectTrace], ["I · отражение", passport.language?.coordinates?.I || passport.reflectedImage], ["R_g · цель", passport.targetRelation], ["Узел перехвата", `${passport.interception.lawId} · ${passport.interception.law} · ${passport.interception.stateName}`], ["Один ⊕-шаг", passport.oplus.action], ["Критерий", passport.oplus.criterion], ["Q · фактический возврат", passport.q == null ? "null · ещё не наблюдался" : String(passport.q)], ["Доказательность", passport.evidenceStatus]];
}
function renderMap() {
  const journal = readJournal();
  const latest = state.passport || journal[0];
  if (!latest) return route("episode");
  state.passport = latest;
  const language = languageFromPassport(latest);
  renderLanguage("language-result", language);
  $("#language-result-status").textContent = language.boundary.subjectConfirmed ? "ПОДТВЕРЖДЕНО СУБЪЕКТОМ" : "LEGACY · ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ";
  $("#passport").innerHTML = passportRows(latest).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  const latestByNode = new Map();
  for (const passport of [...journal].reverse()) for (const answer of passport.answers) latestByNode.set(answer.nodeId, answer);
  const header = `<div class="axis">КОНТУР × ЗАКОН</div>${LAWS.map((law) => `<div class="axis">${law.id}<br>${escapeHtml(law.name)}</div>`).join("")}`;
  const rows = CONTEXTS.map((context) => `<div class="axis">${context.id}<br>${context.name}</div>${LAWS.map((law) => { const answer = latestByNode.get(`SEP(${law.id},${context.id})`); return answer ? `<div class="cell visited" style="--state-color:var(--state${answer.state})"><span>${law.id}/${context.id}</span><b>${answer.state}</b><span>${answer.stateName}</span></div>` : `<div class="cell"><span>${law.id}/${context.id}</span><b>·</b><span>не пройден</span></div>`; }).join("")}`).join("");
  $("#matrix").innerHTML = header + rows;
  const invariant = detectInvariant(journal);
  $("#invariant").innerHTML = invariant ? `<b>Повторяющийся инвариант · ${escapeHtml(invariant.law)}</b><br>Один узел перехвата повторился минимум в трёх контурах. Статус: гипотеза до отдельной проверки.` : `<b>Инвариант ещё не предъявлен.</b><br>Для обнаружения повторения нужны минимум три разных жизненных контура.`;
  $("#verdict").textContent = latest.return ? "INTEGRATED" : "CONDUCT";
}

function renderReturn() {
  if (!state.passport) return;
  $$('input[name="preserved"]').forEach(input => { input.checked = false; });
  ["#other-reacted", "#relation-preserved"].forEach(id => { $(id).checked = false; });
  ["#new-form", "#tension"].forEach(id => { $(id).value = ""; });
  validateReturn();
  $("#return-target").innerHTML = `<b>${escapeHtml(state.passport.oplus.action)}</b><br>Критерий: ${escapeHtml(state.passport.oplus.criterion)}<br>Текущий Q: ${state.passport.q == null ? "null" : state.passport.q}`;
}
function validateReturn() { $("#integrate").disabled = !document.querySelector('input[name="preserved"]:checked'); }
function integrate() {
  if (!state.passport || !document.querySelector('input[name="preserved"]:checked')) throw new Error("Возврат не заполнен.");
  const preserved = document.querySelector('input[name="preserved"]:checked').value === "true";
  const passport = integrateReturn(state.passport, { otherReacted: $("#other-reacted").checked, actionPreserved: preserved, relationPreserved: $("#relation-preserved").checked, newForm: $("#new-form").value, tension: $("#tension").value });
  upsertPassport(passport); state.passport = passport; renderMap(); route("map");
}
function resetCycle() {
  Object.assign(state, { contextId: "", episode: "", index: 0, answers: {}, interception: null, passport: null });
  $("#episode").value = ""; $("#action").value = ""; $("#criterion").value = ""; $("#owned").checked = false; $("#consent-free").checked = false;
  $("#language-confirmed").checked = false;
  renderContexts(); validateEpisodeScreen(); route("episode");
}
function exportJournal() {
  const blob = new Blob([JSON.stringify({ schema: "gdeya.sep7x7.export.v1", exportedAt: new Date().toISOString(), passports: readJournal() }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "gdeya-sep7x7-map.json"; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importJournal(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Файл больше 5 МБ.");
  const payload = JSON.parse(await file.text());
  if (!Array.isArray(payload) && payload?.schema !== "gdeya.sep7x7.export.v1") throw new Error("Неизвестная схема экспорта.");
  const passports = safeJournal(Array.isArray(payload) ? payload : payload.passports);
  if (!passports.length) throw new Error("Пустой пакет.");
  const journal = mergeJournal(passports);
  state.passport = journal[0]; renderMap(); route("map");
  $("#storage-status").textContent = "Импорт проверен и объединён с локальной картой. Импорт не удостоверяет наблюдения или личность автора.";
}

$("#episode").addEventListener("input", validateEpisodeScreen);
$("#start").addEventListener("click", () => { state.index = 0; renderNode(); route("distinguish"); });
$("#previous").addEventListener("click", () => { if (state.index > 0) { state.index -= 1; renderNode(); } });
$("#next").addEventListener("click", () => { if (state.index < 6) { state.index += 1; renderNode(); } else { renderInterception(); validateGate(); route("oplus"); } });
["#action", "#criterion"].forEach((selector) => $(selector).addEventListener("input", () => { renderLanguagePreview(true); validateGate(); }));
["#owned", "#consent-free"].forEach((selector) => $(selector).addEventListener("change", validateGate));
$("#language-confirmed").addEventListener("change", () => { renderLanguagePreview(false); validateGate(); });
$("#conduct").addEventListener("click", guarded(compile));
$("#go-return").addEventListener("click", () => { renderReturn(); route("return"); });
$("#new-context").addEventListener("click", resetCycle);
$("#export").addEventListener("click", guarded(exportJournal));
$("#import").addEventListener("change", guarded(async (event) => { try { if (event.target.files[0]) await importJournal(event.target.files[0]); } finally { event.target.value = ""; } }));
$("#destroy").addEventListener("click", guarded(() => { if (confirm("Уничтожить всю локальную карту SEP-7×7 в этом браузере?")) { destroyJournal(); resetCycle(); } }));
$$('input[name="preserved"]').forEach((input) => input.addEventListener("change", validateReturn));
$("#integrate").addEventListener("click", guarded(integrate));
$$('[data-route]').forEach((button) => button.addEventListener("click", guarded(() => { const target = button.dataset.route; if (target === "episode" || (target === "map" && readJournal().length) || (target === "return" && state.passport)) { if (target === "map") renderMap(); if (target === "return") renderReturn(); route(target); } })));

renderContexts(); validateEpisodeScreen();
try { const journal = readJournal(); if (location.hash === "#map" && journal.length) { state.passport = journal[0]; renderMap(); route("map"); } } catch(error) { reportError(error); }
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
