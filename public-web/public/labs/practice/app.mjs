import { PRACTICE_PROGRAMS, programById } from "./catalog.mjs";
import { attachPracticeReceipt, buildPracticePlan, buildPracticeReceipt, validatePracticePlan } from "./protocol.mjs?v=practice-20261020-r1";
import { downloadJson, persistJournal, persistValue, readJournal } from "../local-journal.mjs";

const STORAGE_KEY = "architectonica.practice.plans.v1";
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);
const state = { program:null, plans:[], activePlan:null, storageHealthy:true };

function initialProgram() { return programById(new URLSearchParams(location.search).get("mode")) ?? PRACTICE_PROGRAMS[0]; }

function renderPrograms() {
  $("#program-list").innerHTML = PRACTICE_PROGRAMS.map((program,index) => `<button type="button" role="tab" aria-selected="${program.id === state.program.id}" class="${program.id === state.program.id ? "active" : ""}" data-program="${program.id}"><i>${String(index+1).padStart(2,"0")}</i><b>${escapeHtml(program.title)}</b><span>${escapeHtml(program.code)}</span></button>`).join("");
  for (const button of document.querySelectorAll("[data-program]")) button.addEventListener("click", () => selectProgram(button.dataset.program));
}

function renderSequence(program) {
  $("#sequence-preview").innerHTML = program.units.map((unit,index) => `<article><i>${String(index+1).padStart(2,"0")}</i><div><b>${escapeHtml(unit.label)}${unit.optional ? " · опционально" : ""}</b><span>${escapeHtml(unit.window)}</span><p>${escapeHtml(unit.purpose)}</p></div></article>`).join("");
}

function selectProgram(id, preserveDashboard = false) {
  const program = programById(id); if (!program) return;
  state.program = program;
  const parameters = new URLSearchParams(location.search); parameters.set("mode",program.id); history.replaceState(null,"",`${location.pathname}?${parameters}`);
  $("#program-code").textContent = program.code; $("#program-title").textContent = program.title; $("#program-purpose").textContent = program.purpose; $("#program-source").textContent = program.sourceStatus;
  renderSequence(program); renderPrograms();
  if (!preserveDashboard) { state.activePlan = null; $("#dashboard").hidden = true; }
}

function collectPlan(form) {
  const data = new FormData(form);
  return { program:state.program.id, object:data.get("object"), subjectManifestation:data.get("subject_manifestation"), reflectedImage:data.get("reflected_image"), targetRelation:data.get("target_relation"), context:data.get("context"), invariant:data.get("invariant"), startDate:data.get("start_date"), evidencePolicy:data.get("evidence_policy"), firstAction:data.get("first_action"), completionSignal:data.get("completion_signal") };
}

function receiptFields(program) {
  $("#receipt-fields").innerHTML = program.receiptFields.map((field) => `<label><span>${escapeHtml(field.label)}</span><textarea data-receipt="${field.id}" maxlength="1800" required placeholder="${escapeHtml(field.prompt)}"></textarea></label>`).join("");
}

function renderDashboard(plan) {
  state.activePlan = plan; const program = programById(plan.program.id); const receiptByUnit = new Map(plan.receipts.map((receipt) => [receipt.unit_id,receipt]));
  $("#dashboard-title").textContent = `${plan.program.title} · ${plan.tensor.O}`;
  $("#progress-count").textContent = `${plan.progress.reported_units} / ${plan.progress.total_units}`;
  $("#progress-bar").style.width = `${plan.progress.ratio * 100}%`;
  $("#plan-summary").innerHTML = `<article><span>O</span><p>${escapeHtml(plan.tensor.O)}</p></article><article><span>R_g</span><p>${escapeHtml(plan.tensor.Rg)}</p></article><article><span>ИНВАРИАНТ</span><p>${escapeHtml(plan.invariant)}</p></article><article><span>ПЕРВЫЙ ШАГ</span><p>${escapeHtml(plan.first_action)}</p></article>`;
  $("#unit-grid").innerHTML = plan.units.map((unit,index) => { const receipt=receiptByUnit.get(unit.id); return `<button type="button" data-unit="${unit.id}" class="${receipt ? "reported" : ""}"><i>${String(index+1).padStart(2,"0")}</i><b>${escapeHtml(unit.label)}</b><span>${receipt ? escapeHtml(receipt.state) : "след не записан"}</span></button>`; }).join("");
  const selector = $("#receipt-form [name=unit_id]"); selector.innerHTML = plan.units.map((unit) => `<option value="${unit.id}">${escapeHtml(unit.label)}</option>`).join("");
  receiptFields(program);
  for (const button of document.querySelectorAll("[data-unit]")) button.addEventListener("click", () => { selector.value=button.dataset.unit; $("#receipt-form").scrollIntoView({behavior:"smooth",block:"start"}); });
  $("#dashboard").hidden = false;
}

function saveUpdatedPlan(plan) {
  const nextPlans = [plan,...state.plans.filter((candidate) => candidate.id !== plan.id)];
  if (!state.storageHealthy) return {ok:false,reason:"JOURNAL_INVALID"};
  const saved = persistValue(localStorage,STORAGE_KEY,nextPlans);
  if (saved.ok) state.plans = nextPlans;
  else state.storageHealthy = false;
  return saved;
}

function renderJournal() {
  $("#journal-count").textContent = state.storageHealthy ? String(state.plans.length) : "?";
  $("#journal-message").textContent = state.storageHealthy ? (state.plans.length ? "Планы хранятся только в этом браузере." : "Планов пока нет.") : "Журнал недоступен или повреждён; существующие данные не перезаписываются.";
  $("#journal-list").innerHTML = state.plans.slice(0,10).map((plan) => `<button type="button" data-plan="${plan.id}"><span>${escapeHtml(plan.program.title)} · ${plan.progress.reported_units}/${plan.progress.total_units}</span><b>${escapeHtml(plan.tensor.O)}</b><p>${escapeHtml(plan.first_action)}</p></button>`).join("");
  for (const button of document.querySelectorAll("[data-plan]")) button.addEventListener("click", () => { const plan=state.plans.find((candidate)=>candidate.id===button.dataset.plan); if (!plan) return; selectProgram(plan.program.id,true); renderDashboard(plan); $("#dashboard").scrollIntoView({behavior:"smooth",block:"start"}); });
}

function tacticsUrl(plan) { const parameters = new URLSearchParams({object:plan.tensor.O,target_relation:plan.tensor.Rg,context:plan.tensor.C,invariant:plan.invariant,next_action:plan.first_action}); return `../tactics/?${parameters}#workbench`; }

$("#plan-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#plan-error").textContent = "";
  try {
    const plan = buildPracticePlan(collectPlan(event.currentTarget)); state.activePlan = plan;
    const saved = state.storageHealthy ? persistJournal(localStorage,STORAGE_KEY,plan) : {ok:false};
    if (saved.ok) state.plans = [plan,...state.plans].slice(0,100); else $("#plan-error").textContent = "План собран, но локальный журнал недоступен. Скачайте JSON.";
    renderDashboard(plan); renderJournal(); $("#dashboard").scrollIntoView({behavior:"smooth",block:"start"});
  } catch (error) { $("#plan-error").textContent = `План не собран: ${error.message}. Заполните ось и контракт цикла.`; event.currentTarget.reportValidity(); }
});

$("#receipt-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#receipt-error").textContent = "";
  try {
    const data = new FormData(event.currentTarget); const entries = {};
    for (const field of document.querySelectorAll("[data-receipt]")) entries[field.dataset.receipt] = field.value;
    const receipt = buildPracticeReceipt(state.activePlan,{unitId:data.get("unit_id"),state:data.get("state"),entries,evidencePointer:data.get("evidence_pointer")});
    const plan = attachPracticeReceipt(state.activePlan,receipt); const saved = saveUpdatedPlan(plan); renderDashboard(plan); renderJournal(); event.currentTarget.reset();
    if (!saved.ok) $("#receipt-error").textContent = "Квитанция собрана в текущем экране, но локальная запись не подтверждена. Скачайте JSON.";
  } catch (error) { $("#receipt-error").textContent = `Квитанция не собрана: ${error.message}. Заполните все наблюдения.`; event.currentTarget.reportValidity(); }
});

$("#download").addEventListener("click", () => state.activePlan && downloadJson(`${state.activePlan.id}.json`,state.activePlan));
$("#to-tactics").addEventListener("click", () => { if (state.activePlan) location.href=tacticsUrl(state.activePlan); });
$("#new-plan").addEventListener("click", () => { state.activePlan=null; $("#dashboard").hidden=true; $("#plan-form").reset(); $("#plan-form [name=start_date]").value=new Date().toISOString().slice(0,10); $("#plan-form").scrollIntoView({behavior:"smooth"}); });

const journal = readJournal(localStorage,STORAGE_KEY);
state.storageHealthy = journal.ok && journal.entries.every(validatePracticePlan);
state.plans = state.storageHealthy ? journal.entries : [];
state.program = initialProgram(); selectProgram(state.program.id);
$("#plan-form [name=start_date]").value = new Date().toISOString().slice(0,10);
const seed = new URLSearchParams(location.search);
for (const [parameter,name] of [["object","object"],["target_relation","target_relation"],["context","context"],["invariant","invariant"]]) if (seed.get(parameter)) $(`#plan-form [name=${name}]`).value=seed.get(parameter);
renderJournal();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
