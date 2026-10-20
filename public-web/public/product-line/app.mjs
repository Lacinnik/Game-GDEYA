const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);

const contracts = {
  "gdeya-practical": { verb:"РАЗЛИЧИТЬ", input:"Намерение, состояние, вопрос", output:"Объект и личная ось", href:"../", cta:"Войти в ГДЕЯ" },
  reson: { verb:"ПРЕДЪЯВИТЬ", input:"Объект и состав участников", output:"Связи, голоса, решение поля", href:"https://lacinnik.github.io/reason-/", cta:"Открыть РЕЗОН", external:true },
  "architectonics-tactics": { verb:"СДЕЛАТЬ", input:"Объект, среда, ограничения", output:"Один соразмерный микро-ход", href:"../labs/tactics/", cta:"Собрать тактику" },
  "living-materialization-module": { verb:"ВЫПУСТИТЬ", input:"Тактический паспорт", output:"Форма, артефакт, самоотчётный след", href:"../labs/module/", cta:"Материализовать" },
  "core-architecture-license": { verb:"ОГРАНИЧИТЬ", input:"Архитектура и контекст внедрения", output:"Досье объёма и пяти шлюзов", href:"../labs/core-license/", cta:"Собрать досье" },
  "architect-creator": { verb:"ДОПУСТИТЬ", input:"Точный запрос и предыдущий след", output:"Запрос на авторское рассмотрение", href:"../labs/creator-gate/", cta:"Подготовить запрос" },
};

function render(catalog) {
  const byId = new Map(catalog.items.map((item) => [item.id, item]));
  $("#line-grid").innerHTML = catalog.spine.map((id, index) => {
    const item = byId.get(id); const contract = contracts[id];
    if (!item || !contract) return "";
    const linkProps = contract.external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<article class="line-card" data-index="${index + 1}">
      <header><span>${String(index + 1).padStart(2,"0")}</span><i>${escapeHtml(contract.verb)}</i></header>
      <h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.role)}</p>
      <dl><div><dt>ВХОД</dt><dd>${escapeHtml(contract.input)}</dd></div><div><dt>ВЫХОД</dt><dd>${escapeHtml(contract.output)}</dd></div></dl>
      <footer><span class="stage ${escapeHtml(item.delivery_stage)}">${item.delivery_stage === "live" ? "РАБОТАЕТ" : "РАБОЧИЙ ПРОТОТИП"}</span><a href="${escapeHtml(contract.href)}"${linkProps}>${escapeHtml(contract.cta)} ↗</a></footer>
    </article>`;
  }).join("");
}

fetch("../ecosystem/catalog.json", { cache:"no-cache" }).then((response) => {
  if (!response.ok) throw new Error(String(response.status)); return response.json();
}).then(render).catch(() => {
  $("#line-grid").innerHTML = '<p class="load-error">Реестр временно недоступен. Начните с <a href="../labs/axis-cycle/">Живой оси →</a></p>';
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../sw.js").catch(() => {});
