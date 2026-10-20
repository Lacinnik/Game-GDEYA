import { createAxisHandoff, createAxisReceipt, decodeEnvelope, encodeEnvelope, fragmentValue, validateAxisHandoff, validateAxisReturn } from "./protocol.mjs?v=axis-cycle-20261020-r1";

const RESON_URL = "https://lacinnik.github.io/reason-/field-check/";
const DRAFT_KEY = "architectonica.axis-cycle.draft.v1";
const $ = (selector) => document.querySelector(selector);
const state = { handoff: null, returned: null };
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);

function showStage(name) {
  document.querySelectorAll("[data-stage]").forEach((stage) => {
    const active = stage.dataset.stage === name;
    stage.classList.toggle("active", active);
    stage.setAttribute("aria-hidden", String(!active));
  });
  const order = ["compose", "handoff", "return"];
  const index = order.indexOf(name);
  document.querySelectorAll("[data-step-button]").forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === index);
    button.classList.toggle("complete", buttonIndex < index);
  });
  $("#journey").scrollIntoView({ behavior: "smooth", block: "start" });
}

function download(filename, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.hidden = true; document.body.append(link); link.click();
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1000);
}

function passportMarkup(handoff) {
  const rows = [
    ["O · объект", handoff.object], ["S · проявление", handoff.subject_manifestation], ["I · образ", handoff.reflected_image],
    ["R_g · отношение", handoff.target_relation], ["C · контекст", handoff.context], ["Следующий шаг", handoff.next_action], ["Инвариант", handoff.invariant],
  ];
  return `<header><span>AXIS PASSPORT · ${escapeHtml(handoff.id.slice(0, 8))}</span><b>Q = null</b></header><dl>${rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl><footer><span>self-reported-draft</span><span>${escapeHtml(new Date(handoff.created_at).toLocaleString("ru-RU"))}</span></footer>`;
}

function handoffUrl(handoff) {
  return `${RESON_URL}#axis=${encodeEnvelope(handoff)}`;
}

function activateHandoff(handoff) {
  state.handoff = handoff;
  $("#passport").innerHTML = passportMarkup(handoff);
  $("#open-reson").href = handoffUrl(handoff);
  $("#repeat-field").href = handoffUrl(handoff);
  $("[data-step-button='handoff']").disabled = false;
  showStage("handoff");
}

function readForm() {
  return Object.fromEntries(new FormData($("#axis-form")).entries());
}

function saveDraft(input) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(input)); } catch { /* A blocked store must not block the route. */ }
}

function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (!draft) return;
    for (const [key, value] of Object.entries(draft)) {
      const field = $("#axis-form").elements.namedItem(key);
      if (field && typeof value === "string") field.value = value;
    }
  } catch { /* Corrupt optional draft is ignored. */ }
}

function applyCatalogSeed() {
  const parameters = new URLSearchParams(location.search);
  const seeds = {
    object: parameters.get("object")?.trim().slice(0, 500),
    context: parameters.get("context")?.trim().slice(0, 1200),
  };
  for (const [name, value] of Object.entries(seeds)) {
    if (!value) continue;
    const field = $("#axis-form").elements.namedItem(name);
    if (field) field.value = value;
  }
}

function renderReturn(returned) {
  state.returned = returned;
  $("#return-decision").textContent = returned.allow ? "ALLOW" : "HOLD";
  $("#return-decision").classList.toggle("hold", !returned.allow);
  $("#return-reason").textContent = returned.allow ? "Предварительный порог по предъявленным данным пройден." : `Возврат к пересборке · gate=${returned.gate}.`;
  $("#return-links").textContent = returned.links_verified ? "ПРЕДЪЯВЛЕНЫ" : "НЕПОЛНЫ";
  $("[data-step-button='return']").disabled = false;
  showStage("return");
}

function loadReturn() {
  const returnToken = fragmentValue(location.hash, "return");
  const sourceToken = fragmentValue(location.hash, "source");
  if (!returnToken || !sourceToken) return false;
  try {
    const handoff = decodeEnvelope(sourceToken);
    const returned = decodeEnvelope(returnToken);
    if (!validateAxisHandoff(handoff) || !validateAxisReturn(returned, handoff)) throw new Error("CHAIN_MISMATCH");
    state.handoff = handoff;
    $("#passport").innerHTML = passportMarkup(handoff);
    $("#open-reson").href = handoffUrl(handoff);
    $("#repeat-field").href = handoffUrl(handoff);
    $("[data-step-button='handoff']").disabled = false;
    renderReturn(returned);
    return true;
  } catch {
    history.replaceState(null, "", location.pathname);
    return false;
  }
}

$("#axis-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const input = readForm();
    const handoff = createAxisHandoff(input);
    saveDraft(input);
    activateHandoff(handoff);
  } catch {
    $("#axis-form").reportValidity();
  }
});

$("#download-handoff").addEventListener("click", () => state.handoff && download(`gdeya-axis-${state.handoff.id}.json`, state.handoff));
$("#edit-handoff").addEventListener("click", () => showStage("compose"));
$("[data-step-button='compose']").addEventListener("click", () => showStage("compose"));
$("[data-step-button='handoff']").addEventListener("click", () => state.handoff && showStage("handoff"));
$("[data-step-button='return']").addEventListener("click", () => state.returned && showStage("return"));

$("#observation-form").addEventListener("submit", (event) => {
  event.preventDefault();
  $("#observation-error").textContent = "";
  try {
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const receipt = createAxisReceipt(state.handoff, state.returned, values);
    $("#return-q").textContent = receipt.q === null ? "null" : receipt.q.toFixed(2);
    download(`axis-receipt-${receipt.id}.json`, receipt);
  } catch {
    $("#observation-error").textContent = "Чтобы указать Q, сначала опишите фактический наблюдаемый возврат. Иначе оставьте оба поля пустыми.";
  }
});

restoreDraft();
applyCatalogSeed();
loadReturn();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
