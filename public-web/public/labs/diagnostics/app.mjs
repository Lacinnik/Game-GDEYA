import { DIAGNOSTIC_MODES, modeById } from "./catalog.mjs";
import { buildDiagnosticPassport } from "./protocol.mjs?v=diagnostics-20261020-r1";
import { downloadJson, persistJournal, readJournal } from "../local-journal.mjs";

const STORAGE_KEY = "architectonica.diagnostics.journal.v1";
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);
const state = { mode:null, passport:null };

function initialMode() { return modeById(new URLSearchParams(location.search).get("mode")) ?? DIAGNOSTIC_MODES[0]; }

function renderModes() {
  $("#mode-list").innerHTML = DIAGNOSTIC_MODES.map((mode,index) => `<button type="button" role="tab" aria-selected="${mode.id === state.mode.id}" class="${mode.id === state.mode.id ? "active" : ""}" data-mode="${mode.id}"><i>${String(index + 1).padStart(2,"0")}</i><b>${escapeHtml(mode.title)}</b><span>${escapeHtml(mode.code)}</span></button>`).join("");
  for (const button of document.querySelectorAll("[data-mode]")) button.addEventListener("click", () => selectMode(button.dataset.mode));
}

function scaleMarkup(mode) {
  return mode.sections.map((section) => `<fieldset class="question-section"><legend>${escapeHtml(section.label)}</legend>${section.questions.map((question,index) => `<label class="question"><span><i>${String(index + 1).padStart(2,"0")}</i>${escapeHtml(question.text)}</span><select data-answer="${question.id}" required aria-label="${escapeHtml(question.text)}"><option value="">—</option><option value="0">0</option><option value="0.25">0.25</option><option value="0.5">0.5</option><option value="0.75">0.75</option><option value="1">1</option></select></label>`).join("")}</fieldset>`).join("");
}

function pathMarkup(mode) {
  return `<div class="path-grid">${mode.path.map((step,index) => `<label class="path-step"><i>${String(index + 1).padStart(2,"0")}</i><b>${escapeHtml(step.label)}</b><span>${escapeHtml(step.prompt)}</span><textarea data-answer="${step.id}" maxlength="1800" required></textarea></label>`).join("")}</div>`;
}

function selectMode(id) {
  const mode = modeById(id); if (!mode) return;
  state.mode = mode; state.passport = null;
  const parameters = new URLSearchParams(location.search); parameters.set("mode",mode.id); history.replaceState(null,"",`${location.pathname}?${parameters}`);
  $("#mode-code").textContent = mode.code; $("#mode-title").textContent = mode.title; $("#mode-purpose").textContent = mode.purpose; $("#mode-source").textContent = mode.sourceStatus;
  $("#scale-legend").hidden = Boolean(mode.path); $("#instrument").innerHTML = mode.path ? pathMarkup(mode) : scaleMarkup(mode);
  $("#result").hidden = true; renderModes();
}

function collect(form) {
  const data = new FormData(form); const answers = {};
  for (const field of document.querySelectorAll("[data-answer]")) answers[field.dataset.answer] = field.value;
  return { mode:state.mode.id, object:data.get("object"), subjectManifestation:data.get("subject_manifestation"), reflectedImage:data.get("reflected_image"), targetRelation:data.get("target_relation"), context:data.get("context"), invariant:data.get("invariant"), observationWindow:data.get("observation_window"), evidencePointer:data.get("evidence_pointer"), nextAction:data.get("next_action"), answers };
}

function scaleResult(instrument) {
  return `<div class="score-grid">${instrument.sections.map((section) => `<article><header><b>${escapeHtml(section.label)}</b><span>${section.score.toFixed(2)}</span></header><div><i style="width:${section.score * 100}%"></i></div><small>self-reported · equal weight</small></article>`).join("")}</div><div class="route-hypothesis"><span>ГИПОТЕЗА МАРШРУТА</span><p>Начать проверку: ${instrument.routing_hypothesis.lowest_sections.map((section) => `${escapeHtml(section.label)} · ${section.score.toFixed(2)}`).join("; ")}.</p><small>${escapeHtml(instrument.routing_hypothesis.interpretation)}</small></div>`;
}

function pathResult(instrument) {
  return `<div class="path-result">${instrument.steps.map((step,index) => `<article><i>${String(index + 1).padStart(2,"0")}</i><div><b>${escapeHtml(step.label)}</b><p>${escapeHtml(step.statement)}</p></div></article>`).join("")}</div><div class="route-hypothesis"><span>ГРАНИЦА</span><p>${escapeHtml(instrument.routing_hypothesis.interpretation)}</p></div>`;
}

function renderResult(passport) {
  $("#result-title").textContent = `${passport.mode.title} · паспорт собран`;
  $("#result-output").innerHTML = `<div class="tensor-summary"><article><span>O</span><p>${escapeHtml(passport.tensor.O)}</p></article><article><span>R_g</span><p>${escapeHtml(passport.tensor.Rg)}</p></article><article><span>C</span><p>${escapeHtml(passport.tensor.C)}</p></article><article><span>СЛЕДУЮЩИЙ ШАГ</span><p>${escapeHtml(passport.next_action.statement)}</p></article></div>${passport.instrument.method === "equal-weight-visible-average" ? scaleResult(passport.instrument) : pathResult(passport.instrument)}<p class="evidence-line">self-reported-unverified · verified=false · diagnosis=false · Q=null</p>`;
  $("#result").hidden = false; $("#result").scrollIntoView({behavior:"smooth",block:"start"});
}

function renderJournal() {
  const journal = readJournal(localStorage,STORAGE_KEY);
  if (!journal.ok) { $("#journal-message").textContent = "Журнал недоступен или повреждён; существующие данные не перезаписываются."; $("#journal-count").textContent = "?"; return; }
  $("#journal-count").textContent = String(journal.entries.length); $("#journal-message").textContent = journal.entries.length ? "Последние локальные паспорта." : "Записей пока нет.";
  $("#journal-list").innerHTML = journal.entries.slice(0,8).map((passport) => `<article><span>${escapeHtml(passport.mode?.title)} · Q NULL</span><b>${escapeHtml(passport.tensor?.O)}</b><p>${escapeHtml(passport.next_action?.statement)}</p></article>`).join("");
}

function tacticsUrl(passport) {
  const parameters = new URLSearchParams({object:passport.tensor.O,target_relation:passport.tensor.Rg,context:passport.tensor.C,invariant:passport.invariant,next_action:passport.next_action.statement});
  return `../tactics/?${parameters}#workbench`;
}

$("#diagnostic-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#form-error").textContent = "";
  try { state.passport = buildDiagnosticPassport(collect(event.currentTarget)); const saved = persistJournal(localStorage,STORAGE_KEY,state.passport); renderResult(state.passport); renderJournal(); if (!saved.ok) $("#form-error").textContent = "Паспорт собран, но локальный журнал недоступен. Скачайте JSON."; }
  catch (error) { $("#form-error").textContent = `Паспорт не собран: ${error.message}. Заполните ось, все наблюдения и следующий шаг.`; event.currentTarget.reportValidity(); }
});
$("#download").addEventListener("click", () => state.passport && downloadJson(`${state.passport.id}.json`,state.passport));
$("#to-tactics").addEventListener("click", () => { if (state.passport) location.href = tacticsUrl(state.passport); });
$("#new-passport").addEventListener("click", () => { state.passport = null; $("#diagnostic-form").reset(); $("#result").hidden = true; $("#diagnostic-form").scrollIntoView({behavior:"smooth"}); });

state.mode = initialMode(); selectMode(state.mode.id); renderJournal();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
