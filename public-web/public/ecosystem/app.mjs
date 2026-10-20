const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]);

const state = {
  catalog: null,
  category: "all",
  query: "",
};

function stageById(id) {
  return state.catalog.stages.find((stage) => stage.id === id);
}

function categoryById(id) {
  return state.catalog.categories.find((category) => category.id === id);
}

function axisUrl(item) {
  const parameters = new URLSearchParams({
    object: item.object,
    context: `Цифровая экосистема · ${item.name}`,
  });
  return `../labs/axis-cycle/?${parameters.toString()}#journey`;
}

function stagePill(stageId) {
  const stage = stageById(stageId);
  return `<span class="stage-pill ${escapeHtml(stageId)}">${escapeHtml(stage?.label || stageId)}</span>`;
}

function renderSpine() {
  const byId = new Map(state.catalog.items.map((item) => [item.id, item]));
  $("#spine-list").innerHTML = state.catalog.spine.map((id, index) => {
    const item = byId.get(id);
    if (!item) return "";
    return `<article class="spine-node">
      <span class="spine-index">${String(index + 1).padStart(2, "0")}</span>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.role)}</p>
      ${stagePill(item.delivery_stage)}
    </article>`;
  }).join("");
}

function renderStageKey() {
  $("#stage-key").innerHTML = state.catalog.stages.map((stage) => (
    `<span data-stage="${escapeHtml(stage.id)}" title="${escapeHtml(stage.description)}"><i></i>${escapeHtml(stage.label)}</span>`
  )).join("");
}

function renderFilters() {
  const buttons = [
    { id: "all", label: "Все" },
    ...state.catalog.categories,
  ];
  $("#category-filters").innerHTML = buttons.map((category) => (
    `<button type="button" class="${category.id === state.category ? "active" : ""}" data-category="${escapeHtml(category.id)}">${escapeHtml(category.label)}</button>`
  )).join("");

  $("#category-filters").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      renderFilters();
      renderCatalog();
    });
  });
}

function searchableText(item) {
  return [item.name, item.object, item.role, item.next_action, ...item.evidence].join(" ").toLocaleLowerCase("ru-RU");
}

function filteredItems() {
  return state.catalog.items.filter((item) => {
    const categoryMatch = state.category === "all" || item.category === state.category;
    const queryMatch = !state.query || searchableText(item).includes(state.query);
    return categoryMatch && queryMatch;
  });
}

function itemCard(item, index) {
  const category = categoryById(item.category);
  const entrypoint = item.entrypoint
    ? `<a href="${escapeHtml(item.entrypoint)}"${item.entrypoint.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : ""}>Открыть контур ↗</a>`
    : "";
  return `<article class="catalog-card" data-stage="${escapeHtml(item.delivery_stage)}" data-id="${escapeHtml(item.id)}">
    <div class="card-main">
      <div class="card-top"><span>${String(index + 1).padStart(2, "0")} · ${escapeHtml(category?.label || item.category)}</span>${stagePill(item.delivery_stage)}</div>
      <h3>${escapeHtml(item.name)}</h3>
      <p class="role">${escapeHtml(item.role)}</p>
      <div class="card-actions">
        <button type="button" data-details aria-expanded="false">Паспорт объекта</button>
        <a class="axis-link" href="${escapeHtml(axisUrl(item))}">Передать в ось →</a>
      </div>
    </div>
    <div class="card-details">
      <div class="detail-row"><span>O · объект</span><p>${escapeHtml(item.object)}</p></div>
      <div class="detail-row"><span>Следующий ход</span><p>${escapeHtml(item.next_action)}</p></div>
      <div class="detail-row"><span>След источника</span><ul class="evidence-list">${item.evidence.map((source) => `<li>${escapeHtml(source)}</li>`).join("")}</ul></div>
      ${entrypoint ? `<div class="card-actions">${entrypoint}</div>` : ""}
      <p class="canonical-note">Авторский статус: ${escapeHtml(item.canonical_status)} · Q = null до наблюдаемого возврата.</p>
    </div>
  </article>`;
}

function renderCatalog() {
  const items = filteredItems();
  const total = state.catalog.items.length;
  const categoryLabel = state.category === "all" ? "всех категориях" : `категории «${categoryById(state.category)?.label}»`;
  $("#filter-result").textContent = `Показано ${items.length} из ${total} объектов · ${categoryLabel}`;
  $("#catalog-grid").innerHTML = items.length
    ? items.map(itemCard).join("")
    : '<div class="empty-state"><p>По этому запросу объектов не найдено.</p><button type="button" data-clear>Сбросить поиск</button></div>';

  $("#catalog-grid").querySelectorAll("[data-details]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".catalog-card");
      const open = card.classList.toggle("open");
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "Свернуть паспорт" : "Паспорт объекта";
    });
  });

  $("#catalog-grid").querySelector("[data-clear]")?.addEventListener("click", () => {
    state.query = "";
    state.category = "all";
    $("#search").value = "";
    renderFilters();
    renderCatalog();
  });
}

function renderRoadmap() {
  $("#roadmap-list").innerHTML = state.catalog.roadmap.map((step) => `<article class="roadmap-card">
    <span>${escapeHtml(step.label)}</span>
    <h3>${escapeHtml(step.title)}</h3>
    <p>${escapeHtml(step.description)}</p>
  </article>`).join("");
}

function renderBoundary() {
  $("#deferred-list").innerHTML = state.catalog.boundary.deferred.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderSummary() {
  const stageCounts = Object.fromEntries(state.catalog.stages.map((stage) => [stage.id, 0]));
  for (const item of state.catalog.items) stageCounts[item.delivery_stage] += 1;
  const working = stageCounts.live + stageCounts.prototype;
  $("#registry-summary").textContent = `${state.catalog.items.length} объектов сохранены в реестре. ${working} уже имеют рабочую или прототипную цифровую форму; остальные получили место и следующий ход.`;
}

async function init() {
  try {
    const response = await fetch("./catalog.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    state.catalog = await response.json();
    renderSummary();
    renderSpine();
    renderStageKey();
    renderFilters();
    renderCatalog();
    renderRoadmap();
    renderBoundary();
    $("#search").addEventListener("input", (event) => {
      state.query = event.currentTarget.value.trim().toLocaleLowerCase("ru-RU");
      renderCatalog();
    });
  } catch (error) {
    console.error(error);
    $("#catalog-grid").innerHTML = '<div class="empty-state"><p>Реестр временно не загрузился. Откройте Живую ось и начните с формулировки объекта.</p><a class="button secondary" href="../labs/axis-cycle/">Открыть Живую ось →</a></div>';
  }
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("../sw.js").catch(() => {});
init();
