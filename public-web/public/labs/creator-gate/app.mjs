import { buildCreatorAccessRequest } from "./protocol.mjs?v=product-line-20261020-r1";
import { downloadJson, persistJournal } from "../local-journal.mjs";

const STORAGE_KEY = "architectonica.creator-gate.journal.v1";
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);
let request = null;

function collect(form) {
  const data = new FormData(form);
  return {
    object:data.get("object"), subjectManifestation:data.get("subject_manifestation"), reflectedImage:data.get("reflected_image"),
    targetRelation:data.get("target_relation"), context:data.get("context"), invariant:data.get("invariant"), role:data.get("role"),
    purpose:data.get("purpose"), priorTrace:data.get("prior_trace"), contribution:data.get("contribution"), requestedMaterial:data.get("requested_material"),
    boundaries:data.get("boundaries"), sponsorReference:data.get("sponsor_reference"), consent:data.get("consent") === "on",
    confidentiality:data.get("confidentiality") === "on", nonAssignment:data.get("non_assignment") === "on",
  };
}

function render(value) {
  const rows = [
    ["O · объект", value.tensor.O], ["S · проявление", value.tensor.S], ["I · образ", value.tensor.I], ["R_g · отношение", value.tensor.Rg],
    ["C · контекст", value.tensor.C], ["Инвариант", value.invariant], ["Запрошенный контур", `${value.requested_contour.label} · ${value.requested_contour.function}`],
    ["Цель", value.purpose], ["Предыдущий след", value.prior_trace], ["Вклад", value.contribution], ["Запрашиваемый материал", value.requested_material], ["Границы", value.boundaries],
  ];
  $("#result-output").innerHTML = rows.map(([label, text]) => `<article><span>${escapeHtml(label)}</span><p>${escapeHtml(text)}</p></article>`).join("");
  $("#result").hidden = false;
  $("#result").scrollIntoView({ behavior:"smooth", block:"start" });
}

$("#access-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#form-error").textContent = "";
  try {
    request = buildCreatorAccessRequest(collect(event.currentTarget));
    const saved = persistJournal(localStorage, STORAGE_KEY, request);
    render(request);
    if (!saved.ok) $("#form-error").textContent = "Запрос собран, но локальный журнал недоступен. Скачайте JSON.";
  } catch (error) {
    $("#form-error").textContent = `Запрос не собран: ${error.message}. Проверьте поля и три явных согласия.`;
    event.currentTarget.reportValidity();
  }
});
$("#download").addEventListener("click", () => request && downloadJson(`${request.id}.json`, request));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
