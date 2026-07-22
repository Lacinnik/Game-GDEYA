(() => {
  const BEFORE = ["рассеянность", "напряжение", "неопределённость", "перегруз", "остановка", "фоновый шум"];
  const AFTER = ["ясность", "тишина", "устойчивость", "собранность", "направленность", "простота"];
  const DELTAS = [
    { id: "density_shift", label: "Плотность", quadrant: "resource" },
    { id: "impulse_break", label: "Прерывание", quadrant: "power" },
    { id: "distance_collapse", label: "Схлопывание", quadrant: "relations" },
    { id: "auto_form", label: "Самоформа", quadrant: "result" },
  ];
  const STORAGE_KEY = "architectonica.voidocr.traces.v1";
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
    $("#commit").disabled = !(state.pre && state.post && state.delta && state.stability !== null);
  }

  function readTraces() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function saveTrace(trace) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([trace, ...readTraces()].slice(0, 100)));
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
    const trace = {
      schema: "architectonica.voidocr-trace/1.0.0",
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
    state.trace = trace;
    saveTrace(trace);
    renderResult(trace);
    showStage("result");
  }

  function renderResult(trace) {
    const allow = trace.decision === "ALLOW";
    $("#verdict").textContent = trace.decision;
    $("#verdict").classList.toggle("deny", !allow);
    $("#result-title").textContent = allow ? "Допуск получен." : "Действие пока не допускается.";
    $("#result-copy").textContent = allow ? "Различение удержалось после паузы. След можно передать следующему шагу субъектного контура." : "Различение пока не удерживает форму. Вернитесь в паузу без попытки усилить результат.";
    const rows = [["Точка", trace.trigger], ["До → после", `${trace.pre_state} → ${trace.post_state}`], ["Δ", `${trace.delta_type} · ${trace.quadrant}`], ["Устойчивость", `${trace.stability} / 3`], ["Хранение", "локально в этом браузере"]];
    $("#trace").innerHTML = rows.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join("");
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

  renderChoices("#pre", BEFORE, "pre");
  renderChoices("#post", AFTER, "post");
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
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(() => {});
})();
