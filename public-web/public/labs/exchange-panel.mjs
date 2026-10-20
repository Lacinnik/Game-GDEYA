export const SCHEMA = "architectonica.ecosystem-exchange/1.0.0";
export const JOURNAL_SCHEMA = "architectonica.exchange-journal/1.0.0";
const STORAGE_KEY = "architectonica.exchange-journal.v1";
const EVIDENCE_CLASSES = new Set(["none", "self-reported", "documented", "independent-observation"]);
const SOURCE_SCHEMAS = [
  [/^architectonica\.axis-handoff\//u, "gdeya-axis", "Game-GDEYA"],
  [/^architectonica\.axis-return\//u, "reson-field-check", "reason-"],
  [/^architectonica\.axis-receipt\//u, "gdeya-axis", "Game-GDEYA"],
  [/^reson\.collective-meta-decision\//u, "reson-field-check", "reason-"],
  [/^gdeya\.sep7x7\./u, "gdeya-sep7x7", "Game-GDEYA"],
  [/^architectonica\.(?:certification-dossier|supervised-case|supervision-review|authorization-package)\//u, "gdeya-certification", "Game-GDEYA"],
  [/^architectonica\.core-license-dossier\//u, "gdeya-core-license", "Game-GDEYA"],
  [/^architectonica\.creator-access-request\//u, "gdeya-creator-gate", "Game-GDEYA"],
  [/^architectonica\.diagnostic-passport\//u, "gdeya-diagnostics", "Game-GDEYA"],
  [/^architectonica\.facilitation-(?:plan|note)\//u, "gdeya-facilitation", "Game-GDEYA"],
  [/^architectonica\.frontier-/u, "gdeya-frontier", "Game-GDEYA"],
  [/^architectonica\.guide-/u, "gdeya-guide", "Game-GDEYA"],
  [/^architectonica\.meta-/u, "gdeya-meta-core", "Game-GDEYA"],
  [/^architectonica\.(?:module-passport|materialization-receipt)\//u, "gdeya-module", "Game-GDEYA"],
  [/^architectonica\.practice-/u, "gdeya-practice", "Game-GDEYA"],
  [/^architectonica\.rhythm-/u, "gdeya-rhythm", "Game-GDEYA"],
  [/^architectonica\.tactics-/u, "gdeya-tactics", "Game-GDEYA"],
  [/^architectonica\.voidocr-/u, "gdeya-voidocr", "Game-GDEYA"],
];

function validId(value) { return typeof value === "string" && value.trim().length >= 8 && value.length <= 200; }
function validDate(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
export function isEnvelope(value) {
  return Boolean(value && value.schema === SCHEMA && validId(value.id) && validDate(value.created_at)
    && value.source?.ecosystem === "architectonica" && typeof value.source.product === "string"
    && typeof value.source.record_schema === "string" && value.payload?.schema === value.source.record_schema
    && (value.payload?.id === value.source.record_id || value.payload?.handoffId === value.source.record_id)
    && EVIDENCE_CLASSES.has(value.evidence_class) && value.verified === false);
}
function uuid() { return globalThis.crypto?.randomUUID?.() || `exchange-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function readJournal() {
  const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!Array.isArray(value) || value.length > 100 || !value.every(isEnvelope)) throw new Error("INVALID_LOCAL_JOURNAL");
  return value;
}
export function createEnvelope(record, product, now = Date.now(), makeId = uuid, repository = product === "reson-field-check" ? "reason-" : product === "unclassified-source" ? "unknown" : "Game-GDEYA") {
  const recordId = validId(record?.id) ? record.id : validId(record?.handoffId) ? record.handoffId : null;
  if (!record || typeof record.schema !== "string" || !recordId) throw new Error("RECORD_NEEDS_SCHEMA_AND_ID");
  return {
    schema: SCHEMA,
    id: makeId(),
    created_at: new Date(now).toISOString(),
    source: { ecosystem: "architectonica", product, repository, record_schema: record.schema, record_id: recordId },
    payload: record,
    evidence_class: record.evidence?.class && EVIDENCE_CLASSES.has(record.evidence.class) ? record.evidence.class : "none",
    verified: false,
  };
}
export function normalizeFile(value) {
  let records;
  if (value?.schema === JOURNAL_SCHEMA) records = value.entries;
  else if (value?.schema === "gdeya.sep7x7.export.v1") records = value.passports;
  else if (value?.schema === "architectonica.meta-receipt-journal/1.0.0") records = value.entries;
  else records = Array.isArray(value) ? value : [value];
  if (!Array.isArray(records) || records.length < 1 || records.length > 100) throw new Error("INVALID_IMPORT_BATCH");
  return records.map((record) => {
    if (isEnvelope(record)) return record;
    const source = SOURCE_SCHEMAS.find(([pattern]) => pattern.test(record?.schema));
    return createEnvelope(record, source?.[1] ?? "unclassified-source", Date.now(), uuid, source?.[2] ?? "unknown");
  });
}
function download(filename, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.hidden = true; document.body.append(anchor); anchor.click();
  setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 1000);
}
function createPanelStyles() {
  const style = document.createElement("style");
  style.textContent = `#architectonica-exchange{position:fixed;z-index:9999;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));width:min(370px,calc(100vw - 32px));font:13px/1.5 system-ui,sans-serif;color:#edf8f5}#architectonica-exchange details{background:#0b1d1a;border:1px solid #3a746a;box-shadow:0 14px 48px #0008}#architectonica-exchange summary{padding:12px 16px;cursor:pointer;list-style:none;color:#56e2cc;font-weight:700}#architectonica-exchange summary::-webkit-details-marker{display:none}#architectonica-exchange .exchange-body{padding:0 16px 16px;border-top:1px solid #25433d}#architectonica-exchange p{margin:12px 0;color:#a9bfba;font-size:11px}#architectonica-exchange .exchange-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}#architectonica-exchange button,#architectonica-exchange label{min-height:40px;padding:8px;border:1px solid #45645e;background:#102722;color:#edf8f5;display:grid;place-items:center;text-align:center;font:inherit;font-size:11px;cursor:pointer}#architectonica-exchange input{display:none}#architectonica-exchange .exchange-wide{grid-column:1/-1}#architectonica-exchange output{display:block;margin-top:10px;color:#8fc7b9;font-size:11px}#architectonica-exchange ul{max-height:145px;overflow:auto;padding-left:18px;color:#b8cbc5;font-size:10px}#architectonica-exchange .exchange-warning{color:#d9b86c}@media(max-width:500px){#architectonica-exchange{right:8px;bottom:8px;width:calc(100vw - 16px)}}`;
  document.head.append(style);
}
function installPanel() {
  if (!document.body || document.querySelector("#architectonica-exchange")) return;
  createPanelStyles();
  const root = document.createElement("aside");
  root.id = "architectonica-exchange";
  root.innerHTML = `<details><summary>↔ Обмен экосистемы · локально</summary><div class="exchange-body"><p>Подключите JSON текущего продукта или возврат из другой студии. Исходная запись сохраняется как payload; подпись и достоверность не проверяются.</p><div class="exchange-actions"><label>Импорт JSON<input id="exchange-import" type="file" accept="application/json,.json"></label><button id="exchange-export-one" disabled>Скачать конверт</button><button id="exchange-export-journal" class="exchange-wide">Скачать общий журнал</button></div><output id="exchange-message" aria-live="polite">Данные остаются в этом браузере до ручного экспорта.</output><ul id="exchange-entries"></ul><p class="exchange-warning">Не загружайте персональные данные, закрытые документы или секреты. verified=false всегда.</p></div></details>`;
  document.body.append(root);
  let latest = null;
  const message = root.querySelector("#exchange-message");
  const list = root.querySelector("#exchange-entries");
  const render = () => {
    try {
      const journal = readJournal();
      list.replaceChildren(...journal.slice(0, 8).map((entry) => {
        const item = document.createElement("li");
        item.textContent = `${entry.source.product} · ${entry.source.record_schema} · verified=false`;
        return item;
      }));
      if (!journal.length) list.textContent = "Журнал пока пуст.";
    } catch { list.textContent = "Журнал недоступен или повреждён; исходные данные не перезаписаны."; }
  };
  root.querySelector("#exchange-import").addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("IMPORT_TOO_LARGE");
      const incoming = normalizeFile(JSON.parse(await file.text()));
      const journal = readJournal();
      const byId = new Map(journal.map((entry) => [entry.id, entry]));
      incoming.forEach((entry) => byId.set(entry.id, entry));
      const next = [...byId.values()].slice(-100).reverse();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      latest = incoming.at(-1);
      root.querySelector("#exchange-export-one").disabled = false;
      message.textContent = `Принято: ${incoming.length}. Источник и содержимое не верифицированы.`;
      render();
    } catch (error) {
      message.textContent = error.message === "INVALID_LOCAL_JOURNAL" ? "Локальный журнал повреждён или недоступен; он не был перезаписан." : error.message === "IMPORT_TOO_LARGE" ? "Файл больше 2 МБ — уменьшите экспорт или перенесите записи частями." : "Формат файла не распознан; нужна запись с schema и id.";
    } finally { input.value = ""; }
  });
  root.querySelector("#exchange-export-one").addEventListener("click", () => {
    if (latest) download(`architectonica-exchange-${latest.id}.json`, latest);
  });
  root.querySelector("#exchange-export-journal").addEventListener("click", () => {
    try {
      const entries = readJournal();
      download("architectonica-exchange-journal.json", { schema: JOURNAL_SCHEMA, exported_at: new Date().toISOString(), entries });
      message.textContent = `Экспортировано: ${entries.length}. Файл остаётся у вас.`;
    } catch { message.textContent = "Экспорт невозможен: локальный журнал недоступен или повреждён."; }
  });
  render();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installPanel, { once: true });
  else installPanel();
}
