(() => {
  const app = document.querySelector('#app');
  const overlay = document.querySelector('#install');
  let registry;
  let byId;
  let activeFilter = 'all';

  const kindLabels = {
    shell: 'оболочка',
    core: 'ядро',
    space: 'пространство',
    engine: 'движок',
    corpus: 'корпус',
    artifact: 'артефакт',
    infrastructure: 'инфраструктура',
    applied: 'прикладной контур'
  };

  const statusGroups = {
    all: () => true,
    launch: entity => entity.kind === 'space' && entity.status === 'live',
    prototype: entity => ['prototype', 'author-review', 'planned'].includes(entity.status),
    embedded: entity => entity.status === 'embedded',
    private: entity => entity.status === 'private'
  };

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const entityLink = id => `#/product/${encodeURIComponent(id)}`;
  const names = ids => (ids || []).map(id => byId.get(id)).filter(Boolean);
  const statusText = entity => entity.status_label || entity.status;

  function setTitle(title) {
    document.title = title ? `${title} — Архитектоника` : 'Архитектоника — Платформа продуктов';
  }

  function updateNavigation(route) {
    document.querySelectorAll('[data-nav]').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === route);
    });
  }

  function route() {
    if (!registry) return;
    const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/').filter(Boolean);
    const name = parts[0] || 'home';
    updateNavigation(name);

    if (name === 'enter') renderEntry();
    else if (name === 'hypothesis') renderHypothesis();
    else if (name === 'map') renderMap();
    else if (name === 'product' && parts[1]) renderDossier(decodeURIComponent(parts[1]));
    else renderHome();

    window.scrollTo(0, 0);
    requestAnimationFrame(() => app.focus({ preventScroll: true }));
  }

  function renderHome() {
    setTitle('Платформа продуктов');
    app.innerHTML = `
      <div class="view">
        <section class="home-hero shell">
          <div class="home-copy">
            <p class="eyebrow">ЕДИНАЯ ТОЧКА ВХОДА</p>
            <h1>Не каталог.<br><em>Среда запуска.</em></h1>
            <p class="home-lead">Каждый продукт — самостоятельная геометрия действия. Архитектоника удерживает связи, а путь выбирается сообразно задаче.</p>
            <div class="home-actions">
              <a class="button primary" href="#/enter"><span>Войти по задаче</span><span>→</span></a>
              <a class="button ghost" href="#/map"><span>Карта системы</span><span>⌖</span></a>
            </div>
            <p class="home-meta">${registry.entities.length} сущности · ${registry.layers.length} слоёв · один живой реестр</p>
          </div>
          <div class="system-orbit" aria-label="Шесть слоёв вокруг Архитектоники">
            <div class="orbit-ring r1"></div><div class="orbit-ring r2"></div><div class="orbit-ring r3"></div><div class="orbit-ring r4"></div><div class="orbit-ring r5"></div>
            <div class="orbit-center"><span>Архитектоника</span><small>ОСЬ СИСТЕМЫ</small></div>
            <span class="orbit-label l1">Ядра</span><span class="orbit-label l2">Пространства</span><span class="orbit-label l3">Движки</span><span class="orbit-label l4">Артефакты</span><span class="orbit-label l5">Инфраструктура</span>
            <span class="orbit-pulse"></span>
          </div>
        </section>
        <section class="home-principle shell">
          <div class="principle-mark">⊕</div>
          <div><p class="eyebrow">ОСЕВОЙ ПРИНЦИП</p><h2>${escapeHtml(registry.platform.principle)}</h2></div>
          <p>Платформа сначала различает тип задачи, затем показывает пространство действия и только после этого — встроенные движки и материалы, которые поддерживают переход.</p>
        </section>
        <section class="hypothesis-teaser shell">
          <div><p class="eyebrow">РАБОЧАЯ ГИПОТЕЗА · 10 / 10</p><h2>Две лаборатории.<br>Двадцать контуров.</h2></div>
          <div class="teaser-branches">
            ${registry.hypothesis.branches.map(branch => `<div style="--branch-accent:${escapeHtml(branch.accent)}"><span>${escapeHtml(branch.code)}</span><b>${escapeHtml(branch.name)}</b><small>${escapeHtml(branch.focus)}</small></div>`).join('')}
          </div>
          <a class="button ghost" href="#/hypothesis"><span>Открыть гипотезу</span><span>→</span></a>
        </section>
      </div>`;
  }

  function hypothesisEntityRow(entity, index) {
    return `
      <a class="hypothesis-entity" href="${entityLink(entity.id)}" style="--entity-accent:${escapeHtml(entity.accent)}">
        <span class="hypothesis-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="hypothesis-glyph">${escapeHtml(entity.glyph)}</span>
        <span><b>${escapeHtml(entity.name)}</b><small>${escapeHtml(entity.subtitle)}</small></span>
        <span class="hypothesis-status">${escapeHtml(statusText(entity))}</span>
        <span>→</span>
      </a>`;
  }

  function renderHypothesis() {
    setTitle('Гипотеза 10/10');
    const branches = registry.hypothesis.branches.map(branch => {
      const entities = names(branch.entity_ids);
      const product = byId.get(branch.product_id);
      return `
        <section class="hypothesis-branch" style="--branch-accent:${escapeHtml(branch.accent)}">
          <header class="branch-head">
            <span class="branch-code">${escapeHtml(branch.code)}</span>
            <div class="branch-symbol">${escapeHtml(product.glyph)}</div>
            <h2>${escapeHtml(branch.name)}</h2>
            <p class="branch-focus">${escapeHtml(branch.focus)}</p>
            <p>${escapeHtml(branch.description)}</p>
            <a class="text-link" href="${entityLink(product.id)}">Открыть рабочий продукт →</a>
          </header>
          <div class="hypothesis-entities">${entities.map(hypothesisEntityRow).join('')}</div>
        </section>`;
    }).join('');

    app.innerHTML = `
      <div class="view">
        <section class="page-head shell">
          <div class="crumbs"><a href="#/home">Главная</a><span>/</span><span>Гипотеза 10/10</span></div>
          <div class="page-head-row">
            <h1>${escapeHtml(registry.hypothesis.title)}</h1>
            <p class="intro">${escapeHtml(registry.hypothesis.statement)}</p>
          </div>
        </section>
        <section class="hypothesis-board shell">${branches}</section>
        <section class="hypothesis-note shell"><span>⊕</span><p>Фундаментальные элементы могут действовать в обеих лабораториях. Здесь указан их первичный полигон проверки — распределение будет меняться по фактическим результатам.</p></section>
      </div>`;
  }

  function recommendationCard(entity) {
    return `
      <a class="recommend-card" style="--card-accent:${escapeHtml(entity.accent)}" href="${entityLink(entity.id)}">
        <div class="mini-top"><span>${escapeHtml(kindLabels[entity.kind])}</span><span>${escapeHtml(statusText(entity))}</span></div>
        <h3>${escapeHtml(entity.name)}</h3>
        <p>${escapeHtml(entity.subtitle)}</p>
        <span class="open-label">Открыть досье →</span>
      </a>`;
  }

  function renderEntry() {
    setTitle('Войти по задаче');
    const rows = registry.task_vectors.map((task, index) => {
      const products = names(task.product_ids);
      return `
        <button class="task-row" type="button" aria-expanded="${index === 0}" data-task="${escapeHtml(task.id)}">
          <span class="task-number">${escapeHtml(task.number)}</span>
          <h2>${escapeHtml(task.title)}</h2>
          <p>${escapeHtml(task.prompt)}</p>
          <span class="task-toggle" aria-hidden="true">+</span>
        </button>
        <div class="recommendations" aria-label="Рекомендованные контуры">
          ${products.map(recommendationCard).join('')}
        </div>`;
    }).join('');

    app.innerHTML = `
      <div class="view">
        <section class="page-head shell">
          <div class="crumbs"><a href="#/home">Главная</a><span>/</span><span>Войти по задаче</span></div>
          <div class="page-head-row">
            <h1>С чего начинается ваш переход?</h1>
            <p class="intro">Выберите не название продукта, а характер задачи. Платформа покажет основной контур и соседние формы, которые могут поддержать движение.</p>
          </div>
        </section>
        <section class="task-list shell">${rows}</section>
      </div>`;

    app.querySelectorAll('.task-row').forEach(row => {
      row.addEventListener('click', () => {
        const wasOpen = row.getAttribute('aria-expanded') === 'true';
        app.querySelectorAll('.task-row').forEach(other => other.setAttribute('aria-expanded', 'false'));
        row.setAttribute('aria-expanded', String(!wasOpen));
      });
    });
  }

  function entityCard(entity) {
    return `
      <a class="entity-card" data-status="${escapeHtml(entity.status)}" style="--card-accent:${escapeHtml(entity.accent)}" href="${entityLink(entity.id)}">
        <div class="card-top"><span>${escapeHtml(entity.code)} · ${escapeHtml(kindLabels[entity.kind])}</span><span class="status-badge">${escapeHtml(statusText(entity))}</span></div>
        <div class="entity-glyph">${escapeHtml(entity.glyph)}</div>
        <h3>${escapeHtml(entity.name)}</h3>
        <p class="entity-subtitle">${escapeHtml(entity.subtitle)}</p>
        <div class="entity-tags">${entity.tags.slice(0, 3).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
        <span class="card-open">Открыть досье <span>→</span></span>
      </a>`;
  }

  function renderMap() {
    setTitle('Карта системы');
    const layers = registry.layers.map(layer => {
      const entities = registry.entities.filter(entity => entity.layer === layer.id);
      return `
        <section class="map-layer" data-layer="${layer.id}">
          <div class="layer-head">
            <span class="layer-index">0${layer.id}</span>
            <div class="layer-title"><h2>${escapeHtml(layer.name)}</h2><small>${escapeHtml(layer.short)}</small></div>
            <p class="layer-description">${escapeHtml(layer.description)}</p>
            <span class="layer-total">${entities.length}</span>
          </div>
          <div class="node-grid">${entities.map(entityCard).join('')}</div>
        </section>`;
    }).join('');

    app.innerHTML = `
      <div class="view">
        <section class="page-head shell">
          <div class="crumbs"><a href="#/home">Главная</a><span>/</span><span>Карта системы</span></div>
          <div class="page-head-row">
            <h1>Шесть слоёв одной системы</h1>
            <p class="intro">Здесь видны не только сайты, но и ядра, встроенные движки, артефакты и частные контуры. Статус каждой сущности назван прямо.</p>
          </div>
        </section>
        <section class="map-toolbar shell">
          <div class="filters" role="group" aria-label="Фильтр по готовности">
            <button class="filter-button" data-filter="all">Все</button>
            <button class="filter-button" data-filter="launch">Рабочие продукты</button>
            <button class="filter-button" data-filter="prototype">Формируются</button>
            <button class="filter-button" data-filter="embedded">Встроены</button>
            <button class="filter-button" data-filter="private">Частный контур</button>
          </div>
          <span class="registry-count" aria-live="polite"></span>
        </section>
        <section class="layer-stack shell">${layers}</section>
      </div>`;

    app.querySelectorAll('[data-filter]').forEach(button => {
      button.addEventListener('click', () => applyMapFilter(button.dataset.filter));
    });
    applyMapFilter(activeFilter);
  }

  function applyMapFilter(filter) {
    activeFilter = statusGroups[filter] ? filter : 'all';
    const test = statusGroups[activeFilter];
    let visible = 0;
    app.querySelectorAll('.filter-button').forEach(button => button.classList.toggle('active', button.dataset.filter === activeFilter));
    app.querySelectorAll('.map-layer').forEach(layer => {
      let layerVisible = 0;
      layer.querySelectorAll('.entity-card').forEach(card => {
        const entity = byId.get(card.getAttribute('href').split('/').pop());
        const show = Boolean(entity && test(entity));
        card.hidden = !show;
        if (show) layerVisible += 1;
      });
      layer.hidden = layerVisible === 0;
      const total = layer.querySelector('.layer-total');
      if (total) total.textContent = layerVisible;
      visible += layerVisible;
    });
    const count = app.querySelector('.registry-count');
    if (count) count.textContent = `${visible} из ${registry.entities.length} сущностей`;
  }

  function relationLinks(items, emptyText) {
    if (!items.length) return `<span class="relation-link"><span>${escapeHtml(emptyText)}</span><small>—</small></span>`;
    return items.map(entity => `<a class="relation-link" href="${entityLink(entity.id)}"><span>${escapeHtml(entity.name)}</span><small>${escapeHtml(kindLabels[entity.kind])} →</small></a>`).join('');
  }

  function entrypointButtons(entity) {
    if (!entity.entrypoints.length) {
      const label = entity.status === 'private' ? 'Частный контур' : entity.status === 'embedded' ? 'Работает внутри системы' : 'Публичный запуск ещё не открыт';
      return `<span class="button ghost" aria-disabled="true">${escapeHtml(label)}</span>`;
    }
    return entity.entrypoints.map((entry, index) => {
      const external = entry.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a class="button ${index === 0 ? 'primary' : 'ghost'}" href="${escapeHtml(entry.url)}"${external}><span>${escapeHtml(entry.label)}</span><span>${entry.external ? '↗' : '→'}</span></a>`;
    }).join('');
  }

  function engineContract(entity) {
    if (entity.kind !== 'engine') return '';
    const match = entity.function.match(/Где действует: (.*?)\. Что принимает: (.*?)\. Что выдаёт: (.*?)\./);
    const acts = match?.[1] || names(entity.parent_ids).map(item => item.name).join(', ') || 'внутри системы';
    const input = match?.[2] || 'состояние и контекст';
    const output = match?.[3] || 'проверенный переход';
    return `
      <div class="engine-contract">
        <div class="contract-cell"><span>Где действует</span><p>${escapeHtml(acts)}</p></div>
        <div class="contract-cell"><span>Что принимает</span><p>${escapeHtml(input)}</p></div>
        <div class="contract-cell"><span>Что выдаёт</span><p>${escapeHtml(output)}</p></div>
        <div class="contract-cell"><span>Состояние контракта</span><p>${escapeHtml(entity.contract || statusText(entity))}</p></div>
      </div>`;
  }

  function renderDossier(id) {
    const entity = byId.get(id);
    if (!entity) {
      renderNotFound();
      return;
    }
    setTitle(entity.name);
    const layer = registry.layers.find(item => item.id === entity.layer);
    const parents = names(entity.parent_ids);
    const dependencies = names(entity.depends_on);
    const consumers = registry.entities.filter(other => other.id !== entity.id && [...(other.parent_ids || []), ...(other.depends_on || [])].includes(entity.id));
    const laboratory = registry.hypothesis.branches.find(branch => branch.entity_ids.includes(entity.id));
    const functionText = entity.kind === 'engine' ? 'Этот движок не является отдельным продуктом запуска. Его задача — исполнять конкретный контракт внутри одного или нескольких пространств.' : entity.function;

    app.innerHTML = `
      <div class="view shell dossier" style="--entity-accent:${escapeHtml(entity.accent)}">
        <div class="crumbs"><a href="#/home">Главная</a><span>/</span><a href="#/map">Карта</a><span>/</span><span>${escapeHtml(entity.name)}</span></div>
        <section class="dossier-hero">
          <div>
            <span class="dossier-code">Слой 0${entity.layer} · ${escapeHtml(kindLabels[entity.kind])} · ${escapeHtml(statusText(entity))}</span>
            <h1>${escapeHtml(entity.name)}</h1>
            <p class="dossier-alt">${escapeHtml(entity.alt_name || entity.subtitle)}</p>
            <p class="dossier-lead">${escapeHtml(entity.description)}</p>
            <div class="dossier-actions">${entrypointButtons(entity)}</div>
          </div>
          <aside class="identity-panel" aria-label="Паспорт сущности">
            <div class="identity-glyph">${escapeHtml(entity.glyph)}</div>
            <dl class="identity-list">
              <div><dt>Статус</dt><dd>${escapeHtml(statusText(entity))}</dd></div>
              <div><dt>Слой</dt><dd>${escapeHtml(layer.name)} · ${escapeHtml(layer.short)}</dd></div>
              <div><dt>Геометрия</dt><dd>${escapeHtml(entity.geometry)}</dd></div>
              <div><dt>Версия</dt><dd>${escapeHtml(entity.version)}</dd></div>
              <div><dt>Для кого</dt><dd>${escapeHtml(entity.audience.join(', '))}</dd></div>
              ${laboratory ? `<div><dt>Полигон</dt><dd>${escapeHtml(laboratory.name)} · ${escapeHtml(laboratory.focus)}</dd></div>` : ''}
            </dl>
          </aside>
        </section>
        <section class="dossier-body">
          <div>
            <div class="dossier-section">
              <span class="section-label">Роль в системе</span>
              <h2>${escapeHtml(entity.subtitle)}</h2>
              <p>${escapeHtml(functionText)}</p>
              ${engineContract(entity)}
            </div>
            <div class="dossier-section">
              <span class="section-label">Метки контура</span>
              <div class="dossier-tags" style="margin-top:16px">${entity.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
            </div>
          </div>
          <aside>
            <div class="relation-block"><h3>Где находится</h3><div class="relation-links">${relationLinks(parents, 'Корневой контур')}</div></div>
            <div class="relation-block"><h3>На что опирается</h3><div class="relation-links">${relationLinks(dependencies, 'Не требует другого узла')}</div></div>
            <div class="relation-block"><h3>Где используется</h3><div class="relation-links">${relationLinks(consumers, 'Пока не связано с другими узлами')}</div></div>
          </aside>
        </section>
      </div>`;
  }

  function renderNotFound() {
    setTitle('Контур не найден');
    app.innerHTML = `<section class="error-state view"><p class="eyebrow">404 · КОНТУР НЕ НАЙДЕН</p><h1>Такой сущности пока нет в реестре.</h1><p>Вернитесь к карте системы — там собраны все зарегистрированные продукты, движки и артефакты.</p><a class="button primary" href="#/map">Открыть карту →</a></section>`;
  }

  function setupInstallDialog() {
    const open = () => {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      overlay.querySelector('.modal-close').focus();
    };
    const close = () => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    };
    document.querySelectorAll('[data-install]').forEach(button => button.addEventListener('click', open));
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('.modal-close,.close-action')) close();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  }

  async function init() {
    setupInstallDialog();
    try {
      const response = await fetch('./products.registry.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Registry request failed: ${response.status}`);
      registry = await response.json();
      byId = new Map(registry.entities.map(entity => [entity.id, entity]));
      window.addEventListener('hashchange', route);
      route();
    } catch (error) {
      console.error(error);
      app.innerHTML = `<section class="error-state"><p class="eyebrow">РЕЕСТР НЕДОСТУПЕН</p><h1>Карта не собралась.</h1><p>Обновите страницу. Если состояние сохранится, откройте работающие продукты напрямую: <a class="text-link" href="https://lacinnik.github.io/Game-GDEYA/">ГДЕЯ</a> или <a class="text-link" href="https://lacinnik.github.io/reason-/">РЕЗОН</a>.</p></section>`;
    }
  }

  init();
})();
