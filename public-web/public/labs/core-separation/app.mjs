import { CONTEXTS, LAWS, NODES, RESPONSES, SKELLU_PROMPTS, STATES } from "./catalog.mjs";
import { STORAGE_KEY, createPassport, detectInvariant, integrateReturn, safeJournal, validateEpisode, validateOplus } from "./runtime.mjs";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
const state = { contextId: "", episode: "", index: 0, answers: {}, passport: null };

function readJournal() {
  try { return safeJournal(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch { return []; }
}
function writeJournal(journal) { localStorage.setItem(STORAGE_KEY, JSON.stringify(safeJournal(journal).slice(0, 70))); }
function upsertPassport(passport) { writeJournal([passport, ...readJournal().filter((item) => item.id !== passport.id)]); }

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
function renderInterception() {
  const ranked = LAWS.map((law) => ({ law, response: answerState(law.id) })).sort((a, b) => a.response.state - b.response.state);
  const lowest = ranked[0];
  $("#interception").innerHTML = `<b>Узел перехвата · ${lowest.law.id} ${escapeHtml(lowest.law.name)}</b><br>${STATES[lowest.response.state].name} · ${escapeHtml(STATES[lowest.response.state].description)}<br><small>Это рабочая гипотеза выбранного эпизода, не оценка личности.</small>`;
}
function validateGate() {
  const draft = { action: $("#action").value, criterion: $("#criterion").value, owned: $("#owned").checked, consentFree: $("#consent-free").checked };
  const errors = validateOplus(draft);
  $("#conduct").disabled = errors.length > 0;
  const labels = { ACTION_INCOMPLETE: "сформулируй действие", ACTION_NOT_SINGLE: "оставь один шаг", CRITERION_INCOMPLETE: "добавь критерий", ACTION_NOT_OWNED: "подтверди свою исполнимость", ACTION_REQUIRES_CONSENT: "отдели шаг от согласия Другого" };
  $("#gate-hint").textContent = errors.length ? `Gate закрыт: ${errors.map((error) => labels[error]).join(" · ")}.` : "Gate открыт · шаг принадлежит субъекту и допускает наблюдаемый возврат.";
}

function compile() {
  state.passport = createPassport({ contextId: state.contextId, episode: state.episode, answers: state.answers, action: $("#action").value, criterion: $("#criterion").value });
  upsertPassport(state.passport); renderMap(); route("map");
}
function passportRows(passport) {
  return [["Контур", passport.context.name], ["O · эпизод", passport.object], ["S · след действия", passport.subjectTrace], ["R_g · цель", passport.targetRelation], ["Узел перехвата", `${passport.interception.lawId} · ${passport.interception.law} · ${passport.interception.stateName}`], ["Один ⊕-шаг", passport.oplus.action], ["Критерий", passport.oplus.criterion], ["Q · фактический возврат", passport.q == null ? "null · ещё не наблюдался" : String(passport.q)], ["Доказательность", passport.evidenceStatus]];
}
function renderMap() {
  const journal = readJournal();
  const latest = state.passport || journal[0];
  if (!latest) return route("episode");
  state.passport = latest;
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
  $("#return-target").innerHTML = `<b>${escapeHtml(state.passport.oplus.action)}</b><br>Критерий: ${escapeHtml(state.passport.oplus.criterion)}<br>Текущий Q: ${state.passport.q == null ? "null" : state.passport.q}`;
}
function validateReturn() { $("#integrate").disabled = !document.querySelector('input[name="preserved"]:checked'); }
function integrate() {
  const preserved = document.querySelector('input[name="preserved"]:checked').value === "true";
  state.passport = integrateReturn(state.passport, { otherReacted: $("#other-reacted").checked, actionPreserved: preserved, relationPreserved: $("#relation-preserved").checked, newForm: $("#new-form").value, tension: $("#tension").value });
  upsertPassport(state.passport); renderMap(); route("map");
}
function resetCycle() {
  Object.assign(state, { contextId: "", episode: "", index: 0, answers: {}, passport: null });
  $("#episode").value = ""; $("#action").value = ""; $("#criterion").value = ""; $("#owned").checked = false; $("#consent-free").checked = false;
  renderContexts(); validateEpisodeScreen(); route("episode");
}
function exportJournal() {
  const blob = new Blob([JSON.stringify({ schema: "gdeya.sep7x7.export.v1", exportedAt: new Date().toISOString(), passports: readJournal() }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "gdeya-sep7x7-map.json"; link.click(); URL.revokeObjectURL(url);
}
async function importJournal(file) {
  try { const payload = JSON.parse(await file.text()); const passports = safeJournal(payload.passports ?? payload); if (!passports.length) throw new Error("EMPTY"); writeJournal(passports); state.passport = passports[0]; renderMap(); } catch { alert("Файл не соответствует схеме SEP-7×7."); }
}

$("#episode").addEventListener("input", validateEpisodeScreen);
$("#start").addEventListener("click", () => { state.index = 0; renderNode(); route("distinguish"); });
$("#previous").addEventListener("click", () => { if (state.index > 0) { state.index -= 1; renderNode(); } });
$("#next").addEventListener("click", () => { if (state.index < 6) { state.index += 1; renderNode(); } else { renderInterception(); validateGate(); route("oplus"); } });
["#action", "#criterion"].forEach((selector) => $(selector).addEventListener("input", validateGate));
["#owned", "#consent-free"].forEach((selector) => $(selector).addEventListener("change", validateGate));
$("#conduct").addEventListener("click", compile);
$("#go-return").addEventListener("click", () => { renderReturn(); route("return"); });
$("#new-context").addEventListener("click", resetCycle);
$("#export").addEventListener("click", exportJournal);
$("#import").addEventListener("change", (event) => { if (event.target.files[0]) importJournal(event.target.files[0]); });
$("#destroy").addEventListener("click", () => { if (confirm("Уничтожить всю локальную карту SEP-7×7 в этом браузере?")) { localStorage.removeItem(STORAGE_KEY); resetCycle(); } });
$$('input[name="preserved"]').forEach((input) => input.addEventListener("change", validateReturn));
$("#integrate").addEventListener("click", integrate);
$$('[data-route]').forEach((button) => button.addEventListener("click", () => { const target = button.dataset.route; if (target === "episode" || (target === "map" && readJournal().length) || (target === "return" && state.passport)) { if (target === "map") renderMap(); if (target === "return") renderReturn(); route(target); } }));

renderContexts(); validateEpisodeScreen();
if (location.hash === "#map" && readJournal().length) { state.passport = readJournal()[0]; renderMap(); route("map"); }
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
