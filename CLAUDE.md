# Game-GDEYA · игра «Ядро субъекта» и Platform 2.0

Игра — React-компонент `app/page.tsx` (+ `game-trace.mjs`, `dictation-guard.mjs`, `onboarding.mjs`, `globals.css`), собирается Vite из `public-web/` в `dist-public/` и публикуется на GitHub Pages с базой `/Game-GDEYA/`. Платформа и лаборатории — статические файлы в `public-web/public/` (`platform/`, `labs/`). Node.js 22.13+.

## Перед отправкой

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:mobile   # Chromium+WebKit, iPhone 13; локально: E2E_BROWSERS=chromium PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium
```

`dist-public/` не коммитить.

## Ловушки

- **Скопированные модули** (`labs/meta-core/vendor/*`, `labs/tzar-language-001.mjs`, `labs/local-journal.mjs`, `platform/tzar-language.profiles.json`) не править руками: они закреплены по SHA-256 в `vendor.lock.json`. Обновление — `npm run vendor:update` (берёт свежий `main` источника и переписывает `provenance.json`); расхождение показывает `npm run vendor:drift`.
- **Service Worker**: после изменения сайта поднять `CACHE_REVISION` в `public-web/public/sw.js`; новый файл лаборатории добавить в его список предкэша (это проверяют тесты).
- **Реестр платформы** `public-web/public/platform/products.registry.json` — источник статусов лаунчера; тесты проверяют адреса входов.
- **`page.tsx`** написан плотно, в одну строку на блок; тесты читают его исходник (например, `label="Qsim"`), поэтому сохранять эти метки.
- **Обучение** запоминается ключом `gdeya.onboarding.v1` в `localStorage`; при недоступном хранилище не показывается, чтобы не блокировать игру.
- `ecosystem.status.json` проверяет `npm run ecosystem:status` (`-- --all` — все четыре репозитория из `main`).

## Экосистема

Четыре репозитория одного автора (Lacinnik): `architectonica-az-buki` (корпус и исходные ядра), `-tensor-architectonics` (научный канон ТзАр), `reason-` (лаборатория РЕЗОН), `Game-GDEYA` (игра и Platform 2.0 — единая точка входа). Все сайты — статические GitHub Pages, всё работает локально в браузере.

## Правила содержания

- Статусы (`canonical`, `stable`, `candidate`, `not-accepted`…) присваивает только автор. Не повышать статус по итогам CI или собственной проверки; в `ecosystem.status.json` у каждого статуса поле `source` указывает документ автора, а неуказанный статус — `unstated`.
- `Q` остаётся `null`, пока отклик не наблюдён; игровой балл — `Qsim`. Не выдавать симуляцию за наблюдение или диагностику.
- TZAR-LANGUAGE-001 — детерминированный символический компилятор, не обученная нейросеть. Не писать иного.
- Термины корпуса брать из канонических документов (`-tensor-architectonics/GLOSSARY.md`), не пересказывать своими определениями.
- Тексты и интерфейс — на русском; английский — только `README.en.md`.
- Ссылки в Markdown проверяет workflow `links.yml` (lychee): в PR — внутренние, еженедельно — внешние.
