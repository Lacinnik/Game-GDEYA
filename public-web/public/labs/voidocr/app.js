import { OBSERVATION_STATES, DELTAS, isCompleteObservation } from "./observation.mjs?v=voidocr-observation-20260922-r2";
import { compileTzarLanguage } from "../tzar-language-001.mjs";
import { persistTrace } from "./storage.mjs";
import { sendHandoff } from "../meta-core/handoff.mjs?v=meta-metrics-20260922-r1";

(() => {
  const state = { trigger: "", pre: null, post: null, delta: null, stability: null, trace: null };

  const $ = selector => document.querySelector(selector);
  const words = value => String(value).trim().split(/\s+/u).filter(Boolean).length;

  function showStage(name) {
    document.querySelectorAll("[data-stage]").forEach(stage => {
      const active = stage.dataset.stage === name;
      stage.classList.toggle("active", active);
      stage.setAttribute("aria-hidden", String(!active));
    });
    const order = ["trigger", "pause", "distinguish", "result"];
    const current = order.indexOf(name);
    document.querySelectorAll("[data-rail]").forEach((rail, index) => rail.classList.toggle("active", index <= current));
  }

  function renderChoices(target, items, key) {
    const container = $(target);
    container.innerHTML = "";
    items.forEach(item => {
      const value = typeof item === "object" ? item.id : item;
      const label = typeof item === "object" ? item.label : item;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        state[key] = item;
        [...container.children].forEach(child => child.classList.toggle("selected", child === button));
        validateTrace();
      });
      button.dataset.value = value;
      container.append(button);
    });
  }

  function validateTrace() {
    $("#commit").disabled = !isCompleteObservation(state);
  }

  function beginPause() {
    state.trigger = $("#trigger").value.trim();
    showStage("pause");
    let remaining = 4;
    $("#countdown").textContent = remaining;
    const timer = setInterval(() => {
      remaining -= 1;
      $("#countdown").textContent = Math.max(remaining, 0);
      if (remaining <= 0) {
        clearInterval(timer);
        showStage("distinguish");
      }
    }, 1000);
  }

  function commit() {
    if (!(isCompleteObservation(state) && words(state.trigger) >= 3)) return;
    const trace = {
      schema: "architectonica.voidocr-trace/1.1.0",
      id: globalThis.crypto?.randomUUID?.() || `void-${Date.now()}`,
      ts: new Date().toISOString(),
      laboratory: "gdeya",
      trigger: state.trigger,
      pre_state: state.pre,
      post_state: state.post,
      delta_type: state.delta.id,
      quadrant: state.delta.quadrant,
      stability: state.stability,
      decision: state.stability >= 2 ? "ALLOW" : "DENY",
    };
    trace.language = compileTzarLanguage({
      object: trace.trigger,
      subjectTrace: `${trace.pre_state} → ${trace.post_state}; Δ ${trace.delta_type}`,
      innerImage: `${trace.post_state}; устойчивость ${trace.stability} / 3`,
      coreNeed: "различить проявившуюся форму без преждевременного называния",
      supra: "сохранить предъявленный след внимания",
      nextExperiment: trace.decision === "ALLOW" ? "передать след следующему субъектному шагу" : "вернуться в паузу без усиления результата",
      riemann: "фактический возврат после следующего внешнего действия",
      observedQ: null,
    }, {
      profile: "voidocr",
      voice: "subject",
      targetRelation: "сделать форму наблюдаемой до преждевременного называния",
      context: `VoidOCR · ${trace.quadrant} · устойчивость ${trace.stability} / 3`,
      subjectConfirmed: true,
    });
    let saved;
    try { saved = persistTrace(localStorage, trace); } catch { saved = { ok: false }; }
    if (!saved.ok) {
      state.trace = null;
      $("#storage-error").textContent = "След не сохранён. Хранилище недоступно или повреждено. Допуск не выдан; введённые данные остаются на экране. Проверьте доступ к хранилищу и повторите сохранение.";
      return;
    }
    $("#storage-error").textContent = "";
    state.trace = trace;
    renderResult(trace);
    showStage("result");
  }

  function renderResult(trace) {
    const allow = trace.decision === "ALLOW";
    $("#verdict").textContent = trace.decision;
    $("#verdict").classList.toggle("deny", !allow);
    $("#result-title").textContent = allow ? "Локальный порог по вашей оценке пройден." : "Действие пока не допускается.";
    $("#result-copy").textContent = allow ? "След можно передать для отдельной проверки следующего шага. ALLOW от VoidOCR не подтверждает полномочия, согласие или фактический возврат." : "Различение пока не удерживает форму. Вернитесь в паузу без попытки усилить результат.";
    $("#send-meta").disabled = !allow;
    $("#handoff-error").textContent = "";
    const rows = [["Слово Субъекта", trace.language.layers.publicStatement], ["Сингулярная формула", trace.language.formula], ["Точка", trace.trigger], ["До → после", `${trace.pre_state} → ${trace.post_state}`], ["Δ", `${trace.delta_type} · ${trace.quadrant}`], ["Устойчивость", `${trace.stability} / 3`], ["Q · возврат", "null · ещё не наблюдался"], ["Хранение", "локально в этом браузере"]];
    $("#trace").replaceChildren(...rows.map(([key, value]) => {
      const row = document.createElement("div");
      const label = document.createElement("dt");
      const content = document.createElement("dd");
      label.textContent = key;
      content.textContent = value;
      row.append(label, content);
      return row;
    }));
  }

  function reset() {
    Object.assign(state, { trigger: "", pre: null, post: null, delta: null, stability: null, trace: null });
    $("#trigger").value = "";
    $("#trigger-validation").textContent = "0 слов · нужно не менее 3";
    $("#begin").disabled = true;
    document.querySelectorAll(".choices button").forEach(button => button.classList.remove("selected"));
    validateTrace();
    showStage("trigger");
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function exportTrace() {
    if (!state.trace) return;
    downloadJson(`voidocr-${state.trace.id}.json`, state.trace);
  }

  renderChoices("#pre", OBSERVATION_STATES, "pre");
  renderChoices("#post", OBSERVATION_STATES, "post");
  renderChoices("#delta", DELTAS, "delta");
  renderChoices("#stability", [0, 1, 2, 3], "stability");
  $("#trigger").addEventListener("input", event => {
    const count = words(event.target.value);
    $("#trigger-validation").textContent = `${count} ${count === 1 ? "слово" : count < 5 ? "слова" : "слов"} · ${count >= 3 ? "допуск к паузе открыт" : "нужно не менее 3"}`;
    $("#begin").disabled = count < 3;
  });
  $("#begin").addEventListener("click", beginPause);
  $("#commit").addEventListener("click", commit);
  $("#reset").addEventListener("click", reset);
  $("#export").addEventListener("click", exportTrace);
  $("#send-meta").addEventListener("click", () => {
    let result;
    try { result = sendHandoff(sessionStorage, localStorage, state.trace); } catch { result = { ok:false }; }
    if (!result.ok) {
      $("#handoff-error").textContent = "Передача не сохранена: проверьте хранилище и свежесть следа (30 минут). Исходный журнал не изменён.";
      return;
    }
    location.assign("../meta-core/");
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
})();
