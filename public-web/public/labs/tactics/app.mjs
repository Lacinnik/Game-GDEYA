import {
  createTacticalPlan,
  createTacticalReceipt,
  tacticalEmptiness,
  tacticalVolume,
  validateTacticalReceipt,
} from "./protocol.mjs?v=tactics-20261020-r1";

const STORAGE_KEY = "architectonica.tactics.journal.v1";
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]);
const state = { plan: null, receipt: null };

function values(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function download(filename, payload) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1000);
}

function readJournal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: "ok", entries: [] };
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return { status: "corrupt", entries: [] };
    const valid = entries.every((entry) => entry && ["plan", "receipt"].includes(entry.kind) && entry.payload && typeof entry.saved_at === "string");
    return valid ? { status: "ok", entries } : { status: "corrupt", entries: [] };
  } catch {
    return { status: "blocked", entries: [] };
  }
}

function saveJournal(kind, payload) {
  const current = readJournal();
  if (current.status !== "ok") return false;
  const entries = [{ kind, payload, saved_at: new Date().toISOString() }, ...current.entries].slice(0, 50);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    const check = readJournal();
    return check.status === "ok" && check.entries[0]?.payload?.id === payload.id;
  } catch {
    return false;
  }
}

function statusLabel(status) {
  return ({
    "ready-for-micro-action": "READY · среда и шаг соразмерны",
    "reshape-environment": "RESHAPE · масштаб среды требует пересборки",
    "hold-empty-space": "HOLD · сначала восстановите локальную пустоту",
  })[status] || status;
}

function updateMetrics() {
  const input = values($("#tactics-form"));
  try {
    const pM = tacticalEmptiness(input);
    const vM = tacticalVolume(input);
    $("#p-metric").textContent = pM.toFixed(2);
    $("#v-metric").textContent = vM.toFixed(2);
    $("#metric-boundary").textContent = pM < 0.25
      ? "Пₘ ниже рабочего порога 0.25: протокол предложит HOLD, но не поставит диагноз."
      : "Обе величины вычислены только из выбранных вами значений; скрытых весов нет.";
  } catch {
    $("#p-metric").textContent = "—";
    $("#v-metric").textContent = "—";
    $("#metric-boundary").textContent = "Заполните шесть видимых входов. Производные появятся без скрытых весов.";
  }
}

function passportMarkup(plan) {
  const cells = [
    ["R_g · отношение", plan.target_relation],
    ["C · контекст", plan.context],
    ["A¹ · микро-решение", plan.algebra.a1_micro_decision],
    ["A² · микро-вектор", plan.algebra.a2_micro_vector],
    ["A³ · микро-ритм", plan.algebra.a3_micro_rhythm],
    ["A⁴ · микро-свёртка", plan.algebra.a4_micro_collapse],
    ["I₉ · действие", plan.action.statement],
    ["Сигнал завершения", plan.action.completion_signal],
  ];
  return `<header class="passport-head"><span>TACTICS PLAN · ${escapeHtml(plan.id.slice(0, 18))}</span><b>Q = null</b></header>
    <div class="passport-object"><span>O · ОБЪЕКТ</span><h3>${escapeHtml(plan.object)}</h3></div>
    <div class="passport-grid">
      <div class="passport-cell metric-cell"><span>Пₘ · относительный индекс</span><b>${plan.derived.tactical_emptiness_p_m.toFixed(2)}</b><p>Не вероятность результата.</p></div>
      <div class="passport-cell metric-cell"><span>Vₘ · относительный объём</span><b>${plan.derived.tactical_volume_v_m.toFixed(2)}</b><p>Произведение Scope × Time × Energy.</p></div>
      ${cells.map(([label, value]) => `<div class="passport-cell"><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>`).join("")}
      <div class="passport-cell"><span>М-СРЕДА</span><p>${escapeHtml(plan.tactical_environment.code)} · ${escapeHtml(plan.tactical_environment.label)} · ${plan.tactical_environment.planned_minutes} мин · ${plan.tactical_environment.fit ? "масштаб совпадает" : "масштаб не совпадает"}</p></div>
      <div class="passport-cell"><span>ОКНО ОБРАТНОЙ СВЯЗИ</span><p>${plan.action.feedback_window_min} минут · затем I₁₀–I₁₂</p></div>
    </div>
    <footer class="passport-foot">self-reported inputs · derived indices · outcome unknown · ${escapeHtml(new Date(plan.created_at).toLocaleString("ru-RU"))}</footer>`;
}

function renderPlan(plan) {
  state.plan = plan;
  state.receipt = null;
  $("#plan-passport").innerHTML = passportMarkup(plan);
  $("#plan-status").textContent = statusLabel(plan.derived.protocol_status);
  $("#plan-title").textContent = plan.derived.protocol_status === "ready-for-micro-action" ? "Микро-действие собрано" : "Паспорт требует пересборки";
  $("#receipt").hidden = true;
  $("#plan-stage").hidden = false;
  $("#plan-stage").scrollIntoView({ behavior: "smooth", block: "start" });
}

function receiptMarkup(receipt) {
  const rows = [
    ["Фактический след", receipt.observed.action_result],
    ["I₁₀ · коррекция", receipt.observed.i10_correction],
    ["I₁₁ · узнавание", receipt.observed.i11_recognition],
    ["I₁₂ · синтез", receipt.observed.i12_synthesis],
  ];
  return `<header><span>ТАКТИЧЕСКАЯ КВИТАНЦИЯ · SELF-REPORTED</span><b>Q = null</b></header><div class="receipt-grid">${rows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>`).join("")}<div><span>Время</span><p>${receipt.observed.elapsed_minutes} минут</p></div><div><span>Связь</span><p>${escapeHtml(receipt.plan_id)}</p></div></div><button class="primary" type="button" data-download-receipt>Скачать квитанцию JSON <span>↓</span></button>`;
}

function renderJournal() {
  const result = readJournal();
  if (result.status !== "ok") {
    $("#journal-list").innerHTML = `<p>Локальный журнал ${result.status === "corrupt" ? "повреждён" : "недоступен"}. Существующие данные не перезаписываются.</p>`;
    return;
  }
  if (!result.entries.length) {
    $("#journal-list").innerHTML = "<p>Записей пока нет.</p>";
    return;
  }
  $("#journal-list").innerHTML = result.entries.slice(0, 9).map((entry) => {
    const payload = entry.payload;
    const plan = entry.kind === "plan";
    return `<article class="journal-card"><span>${plan ? "ПЛАН" : "КВИТАНЦИЯ"} · Q NULL</span><h3>${escapeHtml(payload.object)}</h3><p>${plan ? escapeHtml(payload.action?.statement) : escapeHtml(payload.observed?.action_result)}</p><small>${escapeHtml(new Date(entry.saved_at).toLocaleString("ru-RU"))}</small></article>`;
  }).join("");
}

function applySeed() {
  const parameters = new URLSearchParams(location.search);
  const mapping = {
    object: ["object", 500],
    target_relation: ["target_relation", 1200],
    context: ["context", 1200],
    invariant: ["invariant", 1200],
    next_action: ["action", 1200],
  };
  for (const [parameter, [fieldName, max]] of Object.entries(mapping)) {
    const value = parameters.get(parameter)?.trim().slice(0, max);
    const field = $("#tactics-form").elements.namedItem(fieldName);
    if (field && value) field.value = value;
  }
}

$("#tactics-form").addEventListener("change", updateMetrics);
$("#tactics-form").addEventListener("submit", (event) => {
  event.preventDefault();
  $("#form-error").textContent = "";
  try {
    const plan = createTacticalPlan(values(event.currentTarget));
    const saved = saveJournal("plan", plan);
    renderPlan(plan);
    renderJournal();
    if (!saved) $("#plan-status").textContent += " · локальное сохранение недоступно";
  } catch (error) {
    $("#form-error").textContent = `Паспорт не собран: ${error.message}. Проверьте обязательные поля и шкалы.`;
    event.currentTarget.reportValidity();
  }
});

$("#download-plan").addEventListener("click", () => state.plan && download(`${state.plan.id}.json`, state.plan));
$("#copy-action").addEventListener("click", async (event) => {
  if (!state.plan) return;
  try {
    await navigator.clipboard.writeText(state.plan.action.statement);
    event.currentTarget.textContent = "Действие скопировано";
  } catch {
    event.currentTarget.textContent = "Копирование недоступно";
  }
});
$("#edit-plan").addEventListener("click", () => $("#workbench").scrollIntoView({ behavior: "smooth", block: "start" }));

$("#observation-form").addEventListener("submit", (event) => {
  event.preventDefault();
  $("#observation-error").textContent = "";
  try {
    const receipt = createTacticalReceipt(state.plan, values(event.currentTarget));
    if (!validateTacticalReceipt(receipt, state.plan)) throw new Error("RECEIPT_INVALID");
    state.receipt = receipt;
    const saved = saveJournal("receipt", receipt);
    $("#receipt").innerHTML = receiptMarkup(receipt);
    $("#receipt").hidden = false;
    $("#receipt").querySelector("[data-download-receipt]").addEventListener("click", () => download(`${receipt.id}.json`, receipt));
    if (!saved) $("#observation-error").textContent = "Квитанция собрана, но локальное сохранение недоступно. Скачайте JSON.";
    renderJournal();
    $("#receipt").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    $("#observation-error").textContent = `Квитанция не собрана: ${error.message}. Нужен фактический след по всем I₁₀–I₁₂.`;
    event.currentTarget.reportValidity();
  }
});

applySeed();
updateMetrics();
renderJournal();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
