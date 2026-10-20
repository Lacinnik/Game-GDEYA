import { CERTIFICATION_STAGES, DRAFT_COMPETENCIES } from "./catalog.mjs";
import {
  attachAuthorizationPackage,
  attachSupervisedCase,
  attachSupervisionReview,
  buildAuthorizationPackage,
  buildCertificationDossier,
  buildSupervisedCase,
  buildSupervisionReview,
  validateCertificationDossier,
} from "./protocol.mjs?v=certification-20261020-r1";
import { downloadJson, persistJournal, persistValue, readJournal } from "../local-journal.mjs";

const STORAGE_KEY = "architectonica.certification.dossiers.v1";
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);
const state = { dossiers: [], active: null, storageHealthy: true };

function formValue(form, name) { return new FormData(form).get(name); }

function renderStages() {
  $("#stage-grid").innerHTML = CERTIFICATION_STAGES.map((stage) => `<article><i>${stage.code}</i><h3>${escapeHtml(stage.title)}</h3><p>${escapeHtml(stage.purpose)}</p><b>${stage.id === "authorization" ? "ВНЕШНЕЕ РЕШЕНИЕ" : "ДОКАЗАТЕЛЬНЫЙ СЛЕД"}</b></article>`).join("");
  $("#competence-grid").innerHTML = DRAFT_COMPETENCIES.map((item) => `<fieldset data-competency="${item.id}"><legend>${escapeHtml(item.title)}</legend><label><span>Статус наблюдения</span><select name="status-${item.id}"><option value="not-yet-observed">не наблюдалось</option><option value="observed">наблюдалось</option><option value="needs-review">нужен разбор</option></select></label><label><span>Основание</span><textarea name="basis-${item.id}" required placeholder="${escapeHtml(item.criterion)}"></textarea></label></fieldset>`).join("");
}

function collectDossier(form) {
  const data = new FormData(form);
  return {
    candidateName:data.get("candidate_name"), candidateRole:data.get("candidate_role"), requestedScope:data.get("requested_scope"), methodScope:data.get("method_scope"), prerequisiteTrace:data.get("prerequisite_trace"), supervisionPlan:data.get("supervision_plan"),
    object:data.get("object"), subjectManifestation:data.get("subject_manifestation"), reflectedImage:data.get("reflected_image"), targetRelation:data.get("target_relation"), context:data.get("context"), invariant:data.get("invariant"),
    canonReference:data.get("canon_reference"), competencyVersion:data.get("competency_version"), ethicsReference:data.get("ethics_reference"),
    authorshipAck:data.get("authorship_ack") === "on", consentAck:data.get("consent_ack") === "on", boundaryAck:data.get("boundary_ack") === "on", authorizationAck:data.get("authorization_ack") === "on",
  };
}

function saveActive(dossier) {
  state.active = dossier;
  const next = [dossier, ...state.dossiers.filter((item) => item.id !== dossier.id)].slice(0, 100);
  if (!state.storageHealthy) return { ok:false };
  const saved = persistValue(localStorage, STORAGE_KEY, next);
  if (saved.ok) state.dossiers = next;
  else state.storageHealthy = false;
  return saved;
}

function renderJournal() {
  $("#journal-message").textContent = state.storageHealthy ? (state.dossiers.length ? "Локальные записи доступны только в этом браузере." : "Досье пока нет.") : "Журнал повреждён или недоступен; существующие данные не перезаписываются.";
  $("#journal-list").innerHTML = state.dossiers.slice(0, 9).map((dossier) => `<button type="button" data-dossier="${dossier.id}"><span>${dossier.progress.eligible_cases}/${dossier.progress.required_cases} кейса · ${escapeHtml(dossier.progress.status)}</span><b>${escapeHtml(dossier.candidate.declared_name)}</b><p>${escapeHtml(dossier.requested_scope)}</p></button>`).join("");
  for (const button of document.querySelectorAll("[data-dossier]")) button.addEventListener("click", () => { const dossier = state.dossiers.find((item) => item.id === button.dataset.dossier); if (dossier) { renderDashboard(dossier); $("#dashboard").scrollIntoView({ behavior:"smooth" }); } });
}

function renderDashboard(dossier) {
  state.active = dossier;
  $("#dashboard-title").textContent = `${dossier.candidate.declared_name} · ${dossier.requested_scope}`;
  $("#case-count").textContent = `${dossier.progress.eligible_cases} / ${dossier.progress.required_cases}`;
  $("#dossier-summary").innerHTML = [
    ["O · ОБЪЕКТ", dossier.tensor.O], ["R_g · ОТНОШЕНИЕ", dossier.tensor.Rg], ["ИНВАРИАНТ", dossier.invariant],
    ["ОБЛАСТЬ", dossier.requested_scope], ["МЕТОДЫ", dossier.method_scope], ["СТАТУС", dossier.progress.status],
  ].map(([label,value]) => `<article><span>${label}</span><p>${escapeHtml(value)}</p></article>`).join("");
  $("#case-list").innerHTML = dossier.cases.map((entry,index) => `<article><i>${String(dossier.cases.length-index).padStart(2,"0")}</i><div><b>${escapeHtml(entry.case_title)}</b><p>${escapeHtml(entry.observed_trace)}</p></div><small>${entry.evidence_status} · incident=${entry.incident_state} · result=false</small></article>`).join("");
  $("#review-list").innerHTML = dossier.reviews.map((review,index) => `<article><i>${String(dossier.reviews.length-index).padStart(2,"0")}</i><div><b>${escapeHtml(review.reviewer.declared_name)}</b><p>${escapeHtml(review.review_note)}</p></div><small>${review.recommendation} · identity_verified=false</small></article>`).join("");
  $("#package-gate").textContent = dossier.progress.supervised_practice_complete && dossier.progress.supervision_recommends_review ? "Шлюзы практики и супервизии пройдены. Укажите пять утверждённых источников для пакета." : `Нужно ${dossier.progress.required_cases} подходящих кейса и рекомендация супервизии. Сейчас: ${dossier.progress.eligible_cases}/${dossier.progress.required_cases}.`;
  const latestPackage = dossier.authorization_packages[0];
  $("#package-result").hidden = !latestPackage;
  if (latestPackage) $("#package-result").innerHTML = `<b>ПАКЕТ ГОТОВ К АВТОРИЗОВАННОМУ РАССМОТРЕНИЮ</b><br>${escapeHtml(latestPackage.id)}<br>decision=null · certificate_issued=false · access_granted=false · role_assigned=false · Q=null`;
  $("#dashboard").hidden = false;
}

$("#dossier-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#dossier-error").textContent = "";
  try {
    const dossier = buildCertificationDossier(collectDossier(event.currentTarget));
    const saved = state.storageHealthy ? persistJournal(localStorage, STORAGE_KEY, dossier) : { ok:false };
    if (saved.ok) state.dossiers = [dossier, ...state.dossiers].slice(0, 100); else $("#dossier-error").textContent = "Досье собрано, но журнал недоступен. Скачайте JSON после открытия панели.";
    renderDashboard(dossier); renderJournal(); $("#dashboard").scrollIntoView({ behavior:"smooth", block:"start" });
  } catch (error) { $("#dossier-error").textContent = `Досье не собрано: ${error.message}.`; event.currentTarget.reportValidity(); }
});

$("#case-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#case-error").textContent = "";
  try {
    const form = event.currentTarget;
    const entry = buildSupervisedCase(state.active, {
      caseTitle:formValue(form,"case_title"), practiceDate:formValue(form,"practice_date"), object:formValue(form,"object"), participantScope:formValue(form,"participant_scope"),
      observedTrace:formValue(form,"observed_trace"), candidateReflection:formValue(form,"candidate_reflection"), consentTrace:formValue(form,"consent_trace"), supervisorReference:formValue(form,"supervisor_reference"),
      evidencePointer:formValue(form,"evidence_pointer"), evidenceStatus:formValue(form,"evidence_status"), incidentState:formValue(form,"incident_state"), participantConsent:formValue(form,"participant_consent") === "on",
    });
    const dossier = attachSupervisedCase(state.active, entry); const saved = saveActive(dossier); renderDashboard(dossier); renderJournal(); form.reset(); form.querySelector('[name="practice_date"]').value = new Date().toISOString().slice(0,10);
    if (!saved.ok) $("#case-error").textContent = "Кейс собран, но локальная запись не подтверждена. Скачайте JSON.";
  } catch (error) { $("#case-error").textContent = `Кейс не сохранён: ${error.message}.`; event.currentTarget.reportValidity(); }
});

$("#review-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#review-error").textContent = "";
  try {
    const form = event.currentTarget; const assessments = {};
    for (const item of DRAFT_COMPETENCIES) assessments[item.id] = { status:formValue(form,`status-${item.id}`), basis:formValue(form,`basis-${item.id}`) };
    const review = buildSupervisionReview(state.active, { reviewerName:formValue(form,"reviewer_name"), reviewerRole:formValue(form,"reviewer_role"), reviewDate:formValue(form,"review_date"), recommendation:formValue(form,"recommendation"), reviewNote:formValue(form,"review_note"), assessments });
    const dossier = attachSupervisionReview(state.active, review); const saved = saveActive(dossier); renderDashboard(dossier); renderJournal();
    if (!saved.ok) $("#review-error").textContent = "Разбор собран, но локальная запись не подтверждена. Скачайте JSON.";
  } catch (error) { $("#review-error").textContent = `Разбор не сохранён: ${error.message}.`; event.currentTarget.reportValidity(); }
});

$("#package-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#package-error").textContent = "";
  try {
    const form = event.currentTarget;
    const reviewPackage = buildAuthorizationPackage(state.active, { canonReference:formValue(form,"canon_reference"), competencyReference:formValue(form,"competency_reference"), ethicsReference:formValue(form,"ethics_reference"), accessPolicyReference:formValue(form,"access_policy_reference"), legalReviewReference:formValue(form,"legal_review_reference"), requestedDecision:formValue(form,"requested_decision") });
    const dossier = attachAuthorizationPackage(state.active, reviewPackage); const saved = saveActive(dossier); renderDashboard(dossier); renderJournal();
    if (!saved.ok) $("#package-error").textContent = "Пакет собран, но локальная запись не подтверждена. Скачайте JSON.";
  } catch (error) { $("#package-error").textContent = error.message === "READINESS_GATES_INCOMPLETE" ? "Пакет пока нельзя собрать: завершите три подходящих кейса и получите рекомендацию супервизии." : `Пакет не собран: ${error.message}.`; event.currentTarget.reportValidity(); }
});

$("#download").addEventListener("click", () => state.active && downloadJson(`${state.active.id}.json`, state.active));
$("#new-dossier").addEventListener("click", () => { state.active = null; $("#dashboard").hidden = true; $("#dossier-form").reset(); $("#dossier-form [name=competency_version]").value = "draft-0.1"; $("#dossier-form").scrollIntoView({ behavior:"smooth" }); });

renderStages();
const journal = readJournal(localStorage, STORAGE_KEY);
state.storageHealthy = journal.ok && journal.entries.every(validateCertificationDossier);
state.dossiers = state.storageHealthy ? journal.entries : [];
const today = new Date().toISOString().slice(0,10);
$("#case-form [name=practice_date]").value = today;
$("#review-form [name=review_date]").value = today;
renderJournal();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
