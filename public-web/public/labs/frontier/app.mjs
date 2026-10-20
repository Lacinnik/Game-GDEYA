import { FRONTIER_TRACKS, frontierTrackByMode, frontierTrackByProduct } from "./catalog.mjs";
import { attachFrontierReceipt, buildFrontierBlueprint, buildFrontierReceipt, validateFrontierBlueprint } from "./protocol.mjs";
import { downloadJson, persistJournal, persistValue, readJournal } from "../local-journal.mjs";

const STORAGE_KEY = "architectonica.frontier.blueprints.v1";
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const state = { track: FRONTIER_TRACKS[0], active: null, entries: [], products: new Map(), storageHealthy: true };

function renderTracks() {
  $("#track-list").innerHTML = FRONTIER_TRACKS.map((track, index) => `<button type="button" role="tab" aria-selected="${track.id === state.track.id}" class="${track.id === state.track.id ? "active" : ""}" data-track="${track.mode}"><i>${String(index + 1).padStart(2, "0")}</i><span>${escapeHtml(track.category)}</span><b>${escapeHtml(track.title)}</b><small>${escapeHtml(track.code)}</small></button>`).join("");
  for (const button of document.querySelectorAll("[data-track]")) button.addEventListener("click", () => selectTrack(button.dataset.track));
}

function renderSpecific(track) {
  $("#specific-fields").innerHTML = track.questions.map((question, index) => `<label class="${index === 2 ? "wide" : ""}"><span>${escapeHtml(question.label)}</span><textarea name="specific_${escapeHtml(question.key)}" maxlength="2400" required placeholder="${escapeHtml(question.placeholder)}"></textarea></label>`).join("");
  $("#guardrails").innerHTML = `<b>СТОП‑ГРАНИЦЫ</b>${track.guardrails.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}`;
  $("#step-preview").innerHTML = track.steps.map((step, index) => `<article><i>${String(index + 1).padStart(2, "0")}</i><div><b>${escapeHtml(step.title)}</b><p>${escapeHtml(step.output)}</p></div></article>`).join("");
}

function seedProduct(track) {
  const product = state.products.get(track.id);
  if (!product) return;
  $("#blueprint-form [name=object]").value = product.object;
  $("#blueprint-form [name=reflected_image]").value = product.role;
  $("#blueprint-form [name=target_relation]").value = product.next_action;
  $("#blueprint-form [name=context]").value = `Цифровая экосистема · ${product.name}`;
  $("#blueprint-form [name=invariant]").value = "Сохранить исходный объект, авторство решения и различие между наблюдением и интерпретацией.";
}

function selectTrack(mode, preserveDashboard = false) {
  const track = frontierTrackByMode(mode);
  if (!track) return;
  state.track = track;
  const parameters = new URLSearchParams(location.search);
  parameters.set("mode", track.mode);
  history.replaceState(null, "", `${location.pathname}?${parameters}`);
  $("#track-code").textContent = track.code;
  $("#track-title").textContent = track.title;
  $("#track-purpose").textContent = track.purpose;
  $("#track-output").textContent = track.output;
  $("#track-source").textContent = `ИСХОДНАЯ СТАДИЯ: ${track.sourceStage.toUpperCase()} · РЕЖИМ: ${track.mode}`;
  renderSpecific(track);
  renderTracks();
  if (!preserveDashboard) {
    state.active = null;
    $("#dashboard").hidden = true;
    $("#blueprint-form").reset();
    seedProduct(track);
  }
}

function collectBlueprint(form) {
  const data = new FormData(form);
  return {
    mode: state.track.mode,
    object: data.get("object"), subjectManifestation: data.get("subject_manifestation"), reflectedImage: data.get("reflected_image"),
    targetRelation: data.get("target_relation"), context: data.get("context"), invariant: data.get("invariant"),
    scenarioTitle: data.get("scenario_title"), participant: data.get("participant"), duration: data.get("duration"),
    successSignal: data.get("success_signal"), stopCondition: data.get("stop_condition"),
    answers: Object.fromEntries(state.track.questions.map((question) => [question.key, data.get(`specific_${question.key}`)])),
    authorshipAck: data.has("authorship_ack"), boundaryAck: data.has("boundary_ack"), localAck: data.has("local_ack"),
  };
}

function renderDashboard(blueprint) {
  state.active = blueprint;
  const byStep = new Map(blueprint.receipts.map((receipt) => [receipt.step_id, receipt]));
  $("#dashboard-title").textContent = `${blueprint.track.title} · ${blueprint.tensor.O}`;
  $("#progress-count").textContent = `${blueprint.progress.documented_steps} / ${blueprint.progress.total_steps}`;
  $("#done-count").textContent = `выполнено ${blueprint.progress.completed_steps}`;
  $("#progress-bar").style.width = `${blueprint.progress.ratio * 100}%`;
  $("#blueprint-summary").innerHTML = `<article><span>СЦЕНАРИЙ</span><p>${escapeHtml(blueprint.first_scenario.title)}</p></article><article><span>УЧАСТНИК</span><p>${escapeHtml(blueprint.first_scenario.participant)}</p></article><article><span>ПРИЗНАК</span><p>${escapeHtml(blueprint.first_scenario.success_signal)}</p></article><article><span>ИНВАРИАНТ</span><p>${escapeHtml(blueprint.invariant)}</p></article>`;
  $("#timeline").innerHTML = blueprint.steps.map((step) => { const receipt = byStep.get(step.id); return `<button type="button" data-step="${step.id}" class="${receipt ? `documented ${receipt.completion_state}` : ""}"><i>${String(step.order).padStart(2, "0")}</i><b>${escapeHtml(step.title)}</b><p>${escapeHtml(step.output)}</p><span>${receipt ? `${escapeHtml(receipt.completion_state)} · ${escapeHtml(receipt.evidence_status)}` : "след не записан"}</span></button>`; }).join("");
  const selector = $("#receipt-form [name=step_id]");
  selector.innerHTML = blueprint.steps.map((step) => `<option value="${step.id}">${step.order}. ${escapeHtml(step.title)}</option>`).join("");
  for (const button of document.querySelectorAll("[data-step]")) button.addEventListener("click", () => { selector.value = button.dataset.step; $("#receipt-form").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#dashboard").hidden = false;
}

function saveUpdated(blueprint) {
  const next = [blueprint, ...state.entries.filter((entry) => entry.id !== blueprint.id)].slice(0, 100);
  if (!state.storageHealthy) return { ok: false };
  const saved = persistValue(localStorage, STORAGE_KEY, next);
  if (saved.ok) state.entries = next; else state.storageHealthy = false;
  return saved;
}

function renderJournal() {
  $("#journal-count").textContent = state.storageHealthy ? String(state.entries.length) : "?";
  $("#journal-message").textContent = state.storageHealthy ? (state.entries.length ? "Чертежи хранятся только в этом браузере." : "Сохранённых прототипов пока нет.") : "Журнал повреждён или недоступен; он не перезаписывается.";
  $("#journal-list").innerHTML = state.entries.slice(0, 12).map((entry) => `<button type="button" data-entry="${entry.id}"><span>${escapeHtml(entry.track.code)} · ${entry.progress.documented_steps}/${entry.progress.total_steps}</span><b>${escapeHtml(entry.track.title)}</b><p>${escapeHtml(entry.tensor.O)}</p></button>`).join("");
  for (const button of document.querySelectorAll("[data-entry]")) button.addEventListener("click", () => { const entry = state.entries.find((candidate) => candidate.id === button.dataset.entry); if (!entry) return; selectTrack(entry.track.mode, true); renderDashboard(entry); $("#dashboard").scrollIntoView({ behavior: "smooth" }); });
}

function handoffFor(blueprint) {
  const paths = { module: "../tactics/", program: "../practice/", corporate: "../facilitation/", digital: "../guide/", diagnostic: "../diagnostics/" };
  const parameters = new URLSearchParams({ object: blueprint.tensor.O, target_relation: blueprint.tensor.Rg, context: blueprint.tensor.C, invariant: blueprint.invariant });
  return `${paths[blueprint.track.category] ?? "../axis-cycle/"}?${parameters}`;
}

$("#blueprint-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#blueprint-error").textContent = "";
  try {
    const blueprint = buildFrontierBlueprint(collectBlueprint(event.currentTarget));
    const saved = state.storageHealthy ? persistJournal(localStorage, STORAGE_KEY, blueprint) : { ok: false };
    if (saved.ok) state.entries = [blueprint, ...state.entries].slice(0, 100); else $("#blueprint-error").textContent = "Прототип собран, но журнал недоступен. Скачайте JSON.";
    renderDashboard(blueprint); renderJournal(); $("#dashboard").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { $("#blueprint-error").textContent = `Прототип не собран: ${error.message}. Заполните объект, предметные поля и границы.`; event.currentTarget.reportValidity(); }
});

$("#receipt-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#receipt-error").textContent = "";
  try {
    const data = new FormData(event.currentTarget);
    const receipt = buildFrontierReceipt(state.active, { stepId: data.get("step_id"), completionState: data.get("completion_state"), evidenceStatus: data.get("evidence_status"), observedTrace: data.get("observed_trace"), interpretation: data.get("interpretation"), evidencePointer: data.get("evidence_pointer"), nextAction: data.get("next_action"), participantReviewed: data.has("participant_reviewed") });
    const blueprint = attachFrontierReceipt(state.active, receipt);
    const saved = saveUpdated(blueprint); renderDashboard(blueprint); renderJournal(); event.currentTarget.reset();
    if (!saved.ok) $("#receipt-error").textContent = "Квитанция собрана, но локальная запись не подтверждена. Скачайте JSON.";
  } catch (error) { $("#receipt-error").textContent = `Квитанция не собрана: ${error.message}.`; event.currentTarget.reportValidity(); }
});

$("#download").addEventListener("click", () => state.active && downloadJson(`${state.active.id}.json`, state.active));
$("#handoff").addEventListener("click", () => { if (state.active) location.href = handoffFor(state.active); });
$("#new-blueprint").addEventListener("click", () => { state.active = null; $("#dashboard").hidden = true; $("#blueprint-form").reset(); seedProduct(state.track); $("#blueprint-form").scrollIntoView({ behavior: "smooth" }); });

async function init() {
  try { const response = await fetch("../../ecosystem/catalog.json"); const catalog = await response.json(); state.products = new Map(catalog.items.map((item) => [item.id, item])); } catch { state.products = new Map(); }
  const journal = readJournal(localStorage, STORAGE_KEY);
  state.storageHealthy = journal.ok && journal.entries.every(validateFrontierBlueprint);
  state.entries = state.storageHealthy ? journal.entries : [];
  const parameters = new URLSearchParams(location.search);
  const requested = frontierTrackByMode(parameters.get("mode")) ?? frontierTrackByProduct(parameters.get("product"));
  selectTrack((requested ?? FRONTIER_TRACKS[0]).mode);
  renderJournal();
}

init();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});

