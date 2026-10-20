import { RHYTHM_INTENTS, RHYTHM_PROGRAMS, rhythmProgramById } from "./catalog.mjs";
import { attachRhythmCheckin, buildRhythmCheckin, buildRhythmPlan, validateRhythmPlan } from "./protocol.mjs?v=rhythm-20261020-r1";
import { downloadJson, persistJournal, persistValue, readJournal } from "../local-journal.mjs";

const STORAGE_KEY = "architectonica.rhythm.plans.v1";
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
const state = { program: null, plans: [], activePlan: null, storageHealthy: true };

function initialProgram() {
  return rhythmProgramById(new URLSearchParams(location.search).get("mode")) ?? RHYTHM_PROGRAMS[0];
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function renderPrograms() {
  $("#program-list").innerHTML = RHYTHM_PROGRAMS.map((program, index) => `<button type="button" role="tab" aria-selected="${program.id === state.program.id}" class="${program.id === state.program.id ? "active" : ""}" data-program="${program.id}"><i>${String(index + 1).padStart(2, "0")}</i><b>${escapeHtml(program.title)}</b><span>${escapeHtml(program.code)}</span></button>`).join("");
  for (const button of document.querySelectorAll("[data-program]")) button.addEventListener("click", () => selectProgram(button.dataset.program));
}

function renderSteps(program) {
  $("#step-preview").innerHTML = program.steps.map((item, index) => `<article><i>${String(index + 1).padStart(2, "0")}</i><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.prompt)}</p><span>ДЕНЬ +${item.dayOffset} · ${escapeHtml(item.output)}</span></div></article>`).join("");
}

function selectProgram(id, preserveDashboard = false) {
  const program = rhythmProgramById(id);
  if (!program) return;
  state.program = program;
  const parameters = new URLSearchParams(location.search);
  parameters.set("mode", program.id);
  history.replaceState(null, "", `${location.pathname}?${parameters}`);
  $("#program-code").textContent = program.code;
  $("#program-title").textContent = program.title;
  $("#program-purpose").textContent = program.purpose;
  $("#program-source").textContent = program.sourceStatus;
  renderSteps(program);
  renderPrograms();
  if (!preserveDashboard) {
    state.activePlan = null;
    $("#dashboard").hidden = true;
  }
}

function collectPlan(form) {
  const data = new FormData(form);
  return {
    program: state.program.id,
    intent: data.get("intent"),
    object: data.get("object"),
    subjectManifestation: data.get("subject_manifestation"),
    reflectedImage: data.get("reflected_image"),
    targetRelation: data.get("target_relation"),
    context: data.get("context"),
    invariant: data.get("invariant"),
    startDate: data.get("start_date"),
    timeBudget: data.get("time_budget"),
    evidencePolicy: data.get("evidence_policy"),
    stopCondition: data.get("stop_condition"),
    authorshipAck: data.has("authorship_ack"),
    nonMedicalAck: data.has("non_medical_ack"),
    localScheduleAck: data.has("local_schedule_ack"),
  };
}

function renderDashboard(plan) {
  state.activePlan = plan;
  const byStep = new Map(plan.checkins.map((entry) => [entry.step_id, entry]));
  $("#dashboard-title").textContent = `${plan.program.title} · ${plan.tensor.O}`;
  $("#progress-count").textContent = `${plan.progress.documented_steps} / ${plan.progress.total_steps}`;
  $("#done-count").textContent = `выполнено ${plan.progress.completed_steps}`;
  $("#progress-bar").style.width = `${plan.progress.ratio * 100}%`;
  $("#plan-summary").innerHTML = `<article><span>НАМЕРЕНИЕ</span><p>${escapeHtml(plan.intent.label)}</p></article><article><span>СТАРТ</span><p>${escapeHtml(formatDate(plan.start_date))}</p></article><article><span>ИНВАРИАНТ</span><p>${escapeHtml(plan.invariant)}</p></article><article><span>СТОП</span><p>${escapeHtml(plan.stop_condition)}</p></article>`;
  $("#timeline").innerHTML = plan.steps.map((step, index) => {
    const checkin = byStep.get(step.id);
    return `<button type="button" data-step="${step.id}" class="${checkin ? `documented ${checkin.completion_state}` : ""}"><i>${String(index + 1).padStart(2, "0")}</i><time>${escapeHtml(formatDate(step.due_date))}</time><b>${escapeHtml(step.title)}</b><p>${escapeHtml(step.output)}</p><span>${checkin ? `${escapeHtml(checkin.completion_state)} · ${escapeHtml(checkin.evidence_status)}` : "след не записан"}</span></button>`;
  }).join("");
  const selector = $("#checkin-form [name=step_id]");
  selector.innerHTML = plan.steps.map((step) => `<option value="${step.id}">${escapeHtml(formatDate(step.due_date))} · ${escapeHtml(step.title)}</option>`).join("");
  for (const button of document.querySelectorAll("[data-step]")) button.addEventListener("click", () => {
    selector.value = button.dataset.step;
    $("#checkin-form").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#dashboard").hidden = false;
}

function saveUpdatedPlan(plan) {
  const next = [plan, ...state.plans.filter((candidate) => candidate.id !== plan.id)];
  if (!state.storageHealthy) return { ok: false };
  const saved = persistValue(localStorage, STORAGE_KEY, next);
  if (saved.ok) state.plans = next;
  else state.storageHealthy = false;
  return saved;
}

function renderJournal() {
  $("#journal-count").textContent = state.storageHealthy ? String(state.plans.length) : "?";
  $("#journal-message").textContent = state.storageHealthy ? (state.plans.length ? "Планы хранятся только в этом браузере." : "Ритмов пока нет.") : "Журнал недоступен или повреждён; данные не перезаписываются.";
  $("#journal-list").innerHTML = state.plans.slice(0, 10).map((plan) => `<button type="button" data-plan="${plan.id}"><span>${escapeHtml(plan.program.title)} · ${plan.progress.documented_steps}/${plan.progress.total_steps}</span><b>${escapeHtml(plan.tensor.O)}</b><p>${escapeHtml(plan.intent.label)} · ${escapeHtml(plan.start_date)}</p></button>`).join("");
  for (const button of document.querySelectorAll("[data-plan]")) button.addEventListener("click", () => {
    const plan = state.plans.find((candidate) => candidate.id === button.dataset.plan);
    if (!plan) return;
    selectProgram(plan.program.id, true);
    renderDashboard(plan);
    $("#dashboard").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function handoffUrl(path, plan) {
  const parameters = new URLSearchParams({ object: plan.tensor.O, target_relation: plan.tensor.Rg, context: plan.tensor.C, invariant: plan.invariant });
  return `${path}?${parameters}`;
}

$("#plan-form").addEventListener("submit", (event) => {
  event.preventDefault();
  $("#plan-error").textContent = "";
  try {
    const plan = buildRhythmPlan(collectPlan(event.currentTarget));
    const saved = state.storageHealthy ? persistJournal(localStorage, STORAGE_KEY, plan) : { ok: false };
    if (saved.ok) state.plans = [plan, ...state.plans].slice(0, 100);
    else $("#plan-error").textContent = "План собран, но журнал недоступен. Скачайте JSON.";
    renderDashboard(plan);
    renderJournal();
    $("#dashboard").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    $("#plan-error").textContent = `План не собран: ${error.message}. Заполните ось, время и три границы.`;
    event.currentTarget.reportValidity();
  }
});

$("#checkin-form").addEventListener("submit", (event) => {
  event.preventDefault();
  $("#checkin-error").textContent = "";
  try {
    const data = new FormData(event.currentTarget);
    const checkin = buildRhythmCheckin(state.activePlan, {
      stepId: data.get("step_id"),
      completionState: data.get("completion_state"),
      evidenceStatus: data.get("evidence_status"),
      observedTrace: data.get("observed_trace"),
      interpretation: data.get("interpretation"),
      nextAction: data.get("next_action"),
      evidencePointer: data.get("evidence_pointer"),
    });
    const plan = attachRhythmCheckin(state.activePlan, checkin);
    const saved = saveUpdatedPlan(plan);
    renderDashboard(plan);
    renderJournal();
    event.currentTarget.reset();
    if (!saved.ok) $("#checkin-error").textContent = "Квитанция собрана, но локальная запись не подтверждена. Скачайте JSON.";
  } catch (error) {
    $("#checkin-error").textContent = `Квитанция не собрана: ${error.message}. Запишите след, интерпретацию и следующий ход.`;
    event.currentTarget.reportValidity();
  }
});

$("#download").addEventListener("click", () => state.activePlan && downloadJson(`${state.activePlan.id}.json`, state.activePlan));
$("#to-guide").addEventListener("click", () => { if (state.activePlan) location.href = handoffUrl("../guide/", state.activePlan); });
$("#to-practice").addEventListener("click", () => { if (state.activePlan) location.href = handoffUrl("../practice/", state.activePlan); });
$("#new-plan").addEventListener("click", () => {
  state.activePlan = null;
  $("#dashboard").hidden = true;
  $("#plan-form").reset();
  $("#plan-form [name=start_date]").value = new Date().toISOString().slice(0, 10);
  $("#plan-form").scrollIntoView({ behavior: "smooth" });
});

$("#intent").innerHTML = RHYTHM_INTENTS.map((intent) => `<option value="${intent.id}">${escapeHtml(intent.label)} · ${escapeHtml(intent.description)}</option>`).join("");
$("#plan-form [name=start_date]").value = new Date().toISOString().slice(0, 10);
const journal = readJournal(localStorage, STORAGE_KEY);
state.storageHealthy = journal.ok && journal.entries.every(validateRhythmPlan);
state.plans = state.storageHealthy ? journal.entries : [];
state.program = initialProgram();
selectProgram(state.program.id);
const seed = new URLSearchParams(location.search);
for (const [parameter, name] of [["object", "object"], ["target_relation", "target_relation"], ["context", "context"], ["invariant", "invariant"]]) {
  if (seed.get(parameter)) $(`#plan-form [name=${name}]`).value = seed.get(parameter);
}
renderJournal();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
