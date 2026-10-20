import { FACILITATION_PROGRAMS, programById } from "./catalog.mjs";
import { attachFacilitationNote, buildFacilitationNote, buildFacilitationPlan, validateFacilitationPlan } from "./protocol.mjs?v=facilitation-20261020-r1";
import { downloadJson, persistJournal, persistValue, readJournal } from "../local-journal.mjs";

const STORAGE_KEY = "architectonica.facilitation.plans.v1";
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[character]);
const state = { program:null, plans:[], activePlan:null, storageHealthy:true };

function initialProgram() { return programById(new URLSearchParams(location.search).get("mode")) ?? FACILITATION_PROGRAMS[0]; }

function renderPrograms() {
  $("#program-list").innerHTML = FACILITATION_PROGRAMS.map((program,index)=>`<button type="button" role="tab" aria-selected="${program.id===state.program.id}" class="${program.id===state.program.id?"active":""}" data-program="${program.id}"><i>${String(index+1).padStart(2,"0")}</i><b>${escapeHtml(program.title)}</b><span>${escapeHtml(program.code)}</span></button>`).join("");
  for (const button of document.querySelectorAll("[data-program]")) button.addEventListener("click",()=>selectProgram(button.dataset.program));
}

function renderPhases(program) {
  $("#phase-preview").innerHTML = program.phases.map((phase,index)=>`<article><i>${String(index+1).padStart(2,"0")}</i><div><b>${escapeHtml(phase.label)}</b><p>${escapeHtml(phase.focus)}</p><span>${escapeHtml(phase.output)}</span></div></article>`).join("");
}

function selectProgram(id,preserveDashboard=false) {
  const program=programById(id); if (!program) return;
  state.program=program;
  const parameters=new URLSearchParams(location.search); parameters.set("mode",program.id); history.replaceState(null,"",`${location.pathname}?${parameters}`);
  $("#program-code").textContent=program.code; $("#program-title").textContent=program.title; $("#program-purpose").textContent=program.purpose; $("#program-source").textContent=program.sourceStatus;
  renderPhases(program); renderPrograms();
  if (!preserveDashboard) { state.activePlan=null; $("#dashboard").hidden=true; }
}

function collectPlan(form) {
  const data=new FormData(form);
  return { program:state.program.id, object:data.get("object"), subjectManifestation:data.get("subject_manifestation"), reflectedImage:data.get("reflected_image"), targetRelation:data.get("target_relation"), context:data.get("context"), invariant:data.get("invariant"), title:data.get("title"), facilitatorRole:data.get("facilitator_role"), participantRoles:data.get("participant_roles"), startDate:data.get("start_date"), duration:data.get("duration"), observationBoundary:data.get("observation_boundary"), storagePolicy:data.get("storage_policy"), withdrawalPath:data.get("withdrawal_path"), voluntaryConsent:data.has("voluntary_consent"), sharedBoundaryAck:data.has("shared_boundary_ack"), noPeopleScoringAck:data.has("no_people_scoring_ack") };
}

function renderNoteFields(program) {
  $("#note-fields").innerHTML=program.noteFields.map((field)=>`<label><span>${escapeHtml(field.label)}</span><textarea data-note="${field.id}" maxlength="1800" required placeholder="${escapeHtml(field.prompt)}"></textarea></label>`).join("");
}

function renderDashboard(plan) {
  state.activePlan=plan; const program=programById(plan.program.id); const noteByPhase=new Map(plan.notes.map((note)=>[note.phase_id,note]));
  $("#dashboard-title").textContent=`${plan.charter.title} · ${plan.program.title}`;
  $("#progress-count").textContent=`${plan.progress.documented_phases} / ${plan.progress.total_phases}`;
  $("#progress-bar").style.width=`${plan.progress.ratio*100}%`;
  $("#plan-summary").innerHTML=`<article><span>O</span><p>${escapeHtml(plan.tensor.O)}</p></article><article><span>R_g</span><p>${escapeHtml(plan.tensor.Rg)}</p></article><article><span>РОЛИ</span><p>${escapeHtml(plan.charter.participant_roles)}</p></article><article><span>ИНВАРИАНТ</span><p>${escapeHtml(plan.invariant)}</p></article>`;
  $("#phase-grid").innerHTML=plan.phases.map((phase,index)=>{const note=noteByPhase.get(phase.id);return `<button type="button" data-phase="${phase.id}" class="${note?"documented":""}"><i>${String(index+1).padStart(2,"0")}</i><b>${escapeHtml(phase.label)}</b><span>${note?escapeHtml(note.evidence_status):"след не записан"}</span></button>`;}).join("");
  const selector=$("#note-form [name=phase_id]"); selector.innerHTML=plan.phases.map((phase)=>`<option value="${phase.id}">${escapeHtml(phase.label)}</option>`).join("");
  renderNoteFields(program);
  for (const button of document.querySelectorAll("[data-phase]")) button.addEventListener("click",()=>{selector.value=button.dataset.phase;$("#note-form").scrollIntoView({behavior:"smooth",block:"start"});});
  $("#dashboard").hidden=false;
}

function saveUpdatedPlan(plan) {
  const nextPlans=[plan,...state.plans.filter((candidate)=>candidate.id!==plan.id)];
  if (!state.storageHealthy) return {ok:false,reason:"JOURNAL_INVALID"};
  const saved=persistValue(localStorage,STORAGE_KEY,nextPlans);
  if (saved.ok) state.plans=nextPlans; else state.storageHealthy=false;
  return saved;
}

function renderJournal() {
  $("#journal-count").textContent=state.storageHealthy?String(state.plans.length):"?";
  $("#journal-message").textContent=state.storageHealthy?(state.plans.length?"Досье хранятся только в этом браузере.":"Досье пока нет."):"Журнал недоступен или повреждён; существующие данные не перезаписываются.";
  $("#journal-list").innerHTML=state.plans.slice(0,10).map((plan)=>`<button type="button" data-plan="${plan.id}"><span>${escapeHtml(plan.program.title)} · ${plan.progress.documented_phases}/${plan.progress.total_phases}</span><b>${escapeHtml(plan.charter.title)}</b><p>${escapeHtml(plan.tensor.O)}</p></button>`).join("");
  for (const button of document.querySelectorAll("[data-plan]")) button.addEventListener("click",()=>{const plan=state.plans.find((candidate)=>candidate.id===button.dataset.plan);if(!plan)return;selectProgram(plan.program.id,true);renderDashboard(plan);$("#dashboard").scrollIntoView({behavior:"smooth",block:"start"});});
}

function handoffUrl(path,plan,action="") {
  const parameters=new URLSearchParams({object:plan.tensor.O,target_relation:plan.tensor.Rg,context:plan.tensor.C,invariant:plan.invariant});
  if (action) parameters.set("next_action",action);
  return `${path}?${parameters}${path.includes("tactics")?"#workbench":""}`;
}

$("#plan-form").addEventListener("submit",(event)=>{
  event.preventDefault(); $("#plan-error").textContent="";
  try {
    const plan=buildFacilitationPlan(collectPlan(event.currentTarget));
    const saved=state.storageHealthy?persistJournal(localStorage,STORAGE_KEY,plan):{ok:false};
    if(saved.ok)state.plans=[plan,...state.plans].slice(0,100);else $("#plan-error").textContent="План собран, но локальный журнал недоступен. Скачайте JSON.";
    renderDashboard(plan);renderJournal();$("#dashboard").scrollIntoView({behavior:"smooth",block:"start"});
  } catch(error) { $("#plan-error").textContent=`План не собран: ${error.message}. Заполните ось, хартию и три согласия.`;event.currentTarget.reportValidity(); }
});

$("#note-form").addEventListener("submit",(event)=>{
  event.preventDefault(); $("#note-error").textContent="";
  try {
    const data=new FormData(event.currentTarget);const entries={};
    for(const field of document.querySelectorAll("[data-note]"))entries[field.dataset.note]=field.value;
    const note=buildFacilitationNote(state.activePlan,{phaseId:data.get("phase_id"),evidenceStatus:data.get("evidence_status"),roleScope:data.get("role_scope"),entries,evidencePointer:data.get("evidence_pointer"),participantReviewed:data.has("participant_reviewed")});
    const plan=attachFacilitationNote(state.activePlan,note);const saved=saveUpdatedPlan(plan);renderDashboard(plan);renderJournal();event.currentTarget.reset();
    if(!saved.ok)$("#note-error").textContent="Квитанция собрана в текущем экране, но локальная запись не подтверждена. Скачайте JSON.";
  } catch(error) { $("#note-error").textContent=`Квитанция не собрана: ${error.message}. Заполните наблюдение и его основание.`;event.currentTarget.reportValidity(); }
});

$("#download").addEventListener("click",()=>state.activePlan&&downloadJson(`${state.activePlan.id}.json`,state.activePlan));
$("#to-practice").addEventListener("click",()=>{if(state.activePlan)location.href=handoffUrl("../practice/",state.activePlan);});
$("#to-tactics").addEventListener("click",()=>{if(state.activePlan){const action=state.activePlan.notes[0]?.entries?.next_action??"Провести первый проверяющий ход фасилитационного плана";location.href=handoffUrl("../tactics/",state.activePlan,action);}});
$("#new-plan").addEventListener("click",()=>{state.activePlan=null;$("#dashboard").hidden=true;$("#plan-form").reset();$("#plan-form [name=start_date]").value=new Date().toISOString().slice(0,10);$("#plan-form").scrollIntoView({behavior:"smooth"});});

const journal=readJournal(localStorage,STORAGE_KEY);
state.storageHealthy=journal.ok&&journal.entries.every(validateFacilitationPlan);
state.plans=state.storageHealthy?journal.entries:[];
state.program=initialProgram();selectProgram(state.program.id);
$("#plan-form [name=start_date]").value=new Date().toISOString().slice(0,10);
const seed=new URLSearchParams(location.search);
for(const [parameter,name] of [["object","object"],["target_relation","target_relation"],["context","context"],["invariant","invariant"]])if(seed.get(parameter))$(`#plan-form [name=${name}]`).value=seed.get(parameter);
renderJournal();
if("serviceWorker" in navigator)navigator.serviceWorker.register("../../sw.js").catch(()=>{});
