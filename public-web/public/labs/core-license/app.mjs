import { buildCoreLicenseDossier, GATE_DEFINITIONS } from "./protocol.mjs?v=product-line-20261020-r1";
import { downloadJson, persistJournal } from "../local-journal.mjs";

const STORAGE_KEY = "architectonica.core-license.journal.v1";
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);
let dossier = null;

function collect(form) {
  const data = new FormData(form);
  const gates = Object.fromEntries(GATE_DEFINITIONS.map(({ id }) => [id, {
    status: data.get(`${id}_status`) === "on" ? "declared" : "unresolved",
    statement: data.get(`${id}_statement`),
    reference: data.get(`${id}_reference`),
  }]));
  return {
    object: data.get("object"), targetRelation: data.get("target_relation"), context: data.get("context"), invariant: data.get("invariant"),
    organization: data.get("organization"), responsibleParty: data.get("responsible_party"), application: data.get("application"),
    modules: data.getAll("modules"), allowedUse: data.get("allowed_use"), excludedUse: data.get("excluded_use"),
    implementationBoundary: data.get("implementation_boundary"), evidencePlan: data.get("evidence_plan"), gates,
  };
}

function render(value) {
  const unresolved = value.readiness.unresolved_gates;
  $("#result-title").textContent = unresolved.length ? "Объём собран. Решения остаются открыты." : "Пакет готов к авторскому рассмотрению.";
  $("#result-state").textContent = unresolved.length ? `${5 - unresolved.length}/5 шлюзов заявлены` : "5/5 заявлены · не верифицированы";
  const rows = [
    ["O · объект", value.object], ["R_g · отношение", value.target_relation], ["C · контекст", value.context], ["Инвариант", value.invariant],
    ["Организация", value.deployment.organization], ["Ответственность", value.deployment.responsible_party],
    ["Включено", value.deployment.included_modules.map((item) => item.label).join(" · ")], ["Граница внедрения", value.deployment.implementation_boundary],
  ];
  $("#result-output").innerHTML = `${rows.map(([label, text]) => `<article><span>${escapeHtml(label)}</span><p>${escapeHtml(text)}</p></article>`).join("")}
    <article class="gate-result"><span>ШЛЮЗЫ ФИНАЛИЗАЦИИ</span><div>${Object.values(value.finalization_gates).map((gate) => `<p class="${gate.status}"><b>${escapeHtml(gate.label)}</b><i>${gate.status === "unresolved" ? "ОТКРЫТ" : "ЗАЯВЛЕН · НЕ ПРОВЕРЕН"}</i></p>`).join("")}</div></article>
    <article><span>Доказательность</span><p>self-reported-unverified · verified=false · Q=null</p></article>`;
  $("#result").hidden = false;
  $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
}

for (const fieldset of document.querySelectorAll("[data-gate]")) {
  const checkbox = fieldset.querySelector('input[type="checkbox"]');
  const dependent = [...fieldset.querySelectorAll("textarea,input")].filter((field) => field !== checkbox);
  const sync = () => {
    fieldset.classList.toggle("declared", checkbox.checked);
    for (const field of dependent) field.required = checkbox.checked;
  };
  checkbox.addEventListener("change", sync); sync();
}

$("#license-form").addEventListener("submit", (event) => {
  event.preventDefault(); $("#form-error").textContent = "";
  try {
    dossier = buildCoreLicenseDossier(collect(event.currentTarget));
    const saved = persistJournal(localStorage, STORAGE_KEY, dossier);
    render(dossier);
    if (!saved.ok) $("#form-error").textContent = "Досье собрано, но локальный журнал недоступен. Скачайте JSON.";
  } catch (error) {
    $("#form-error").textContent = `Досье не собрано: ${error.message}. Проверьте обязательные поля и заявленные шлюзы.`;
    event.currentTarget.reportValidity();
  }
});
$("#download").addEventListener("click", () => dossier && downloadJson(`${dossier.id}.json`, dossier));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
