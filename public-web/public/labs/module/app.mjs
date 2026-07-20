import { AZ, BUKI, TAGS, TRANSMISSIONS } from "./catalog.mjs";
import { buildPassport, validateDraft, wordCount } from "./runtime.mjs";

const STORAGE_KEY = "architectonica.module.passports.v1";
const catalog = { az: AZ, buki: BUKI, transmissions: TRANSMISSIONS };
const state = { intent:"", invariant:"", azId:"", bukaId:"", txId:"", induction:"", inversion:"", axis:"", passport:null, tag:"all", search:"" };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[character]);

function readJournal() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}
function savePassport(passport) { localStorage.setItem(STORAGE_KEY, JSON.stringify([passport, ...readJournal()].slice(0, 100))); updateJournal(); }
function updateJournal() { $("#journal-count").textContent = String(readJournal().length); }

function setStage(name) {
  const order = ["axis", "alphabet", "formula", "passport"];
  const current = order.indexOf(name);
  $$('[data-stage]').forEach(section => { const active = section.dataset.stage === name; section.classList.toggle("active", active); section.setAttribute("aria-hidden", String(!active)); });
  $$('[data-go]').forEach((button, index) => button.classList.toggle("active", index <= current));
  history.replaceState(null, "", name === "alphabet" ? "#alphabet" : name === "formula" ? "#az-buki" : "#" + name);
  window.scrollTo({ top: Math.max(0, $(".workbench").offsetTop - 18), behavior:"smooth" });
}

function syncText() {
  state.intent = $("#intent").value.trim(); state.invariant = $("#invariant").value.trim();
  state.induction = $("#induction").value.trim(); state.inversion = $("#inversion").value.trim();
}
function validateAxis() {
  syncText(); const ready = wordCount(state.intent) >= 3 && wordCount(state.invariant) >= 2;
  $("#to-alphabet").disabled = !ready;
  $("#axis-hint").textContent = wordCount(state.intent) + " слов в намерении · " + wordCount(state.invariant) + " слов в инварианте" + (ready ? " · ось предъявлена" : "");
}
function validateFormula() {
  syncText();
  const errors = validateDraft(state, catalog).filter(code => !["INTENT_INCOMPLETE", "INVARIANT_INCOMPLETE", "AZ_REQUIRED"].includes(code));
  $("#compile").disabled = errors.length > 0;
  $("#formula-hint").textContent = errors.length ? "Не завершено: " + errors.map(code => ({BUKA_REQUIRED:"выбор Буки",TRANSMISSION_REQUIRED:"выбор Передачи",INDUCTION_INCOMPLETE:"индукция",INVERSION_INCOMPLETE:"инверсия",AXIS_REQUIRED:"проверка оси"})[code]).filter(Boolean).join(" · ") : "Формула полна · паспорт готов к сборке";
}

function renderFilters() {
  const entries = [["all", "все"], ...Object.entries(TAGS)];
  $("#tag-filters").innerHTML = entries.map(([id, label]) => '<button type="button" data-tag="' + id + '" class="' + (state.tag === id ? "active" : "") + '">' + label + '</button>').join("");
  $$('[data-tag]').forEach(button => button.addEventListener("click", () => { state.tag = button.dataset.tag; renderFilters(); renderAz(); }));
}
function renderAz() {
  const query = state.search.toLocaleLowerCase("ru");
  const items = AZ.filter(item => (state.tag === "all" || item.tag === state.tag) && (!query || item.title.toLocaleLowerCase("ru").includes(query) || String(item.number).includes(query)));
  $("#az-grid").innerHTML = items.map(item => '<button type="button" data-az="' + item.id + '" class="catalog-card ' + (state.azId === item.id ? "selected" : "") + '"><i>' + String(item.number).padStart(2,"0") + '</i><b>' + escapeHtml(item.title) + '</b><span>' + TAGS[item.tag] + '</span></button>').join("") || '<p class="empty">Совпадений нет.</p>';
  $$('[data-az]').forEach(button => button.addEventListener("click", () => { state.azId = button.dataset.az; renderAz(); updateFormula(); $("#to-formula").disabled = false; }));
  const selected = AZ.find(item => item.id === state.azId);
  $("#az-selection").textContent = selected ? selected.id + " · " + selected.title + " · " + TAGS[selected.tag] : "Аз не выбран";
}
function renderBuki() {
  $("#buka-grid").innerHTML = BUKI.map(item => '<button type="button" data-buka="' + item.id + '" class="catalog-card buka-card ' + (state.bukaId === item.id ? "selected" : "") + '"><i>' + String(item.number).padStart(2,"0") + '</i><strong>' + escapeHtml(item.symbol) + '</strong><b>' + escapeHtml(item.title) + '</b><span>' + TAGS[item.tag] + '</span></button>').join("");
  $$('[data-buka]').forEach(button => button.addEventListener("click", () => { state.bukaId = button.dataset.buka; renderBuki(); updateFormula(); validateFormula(); }));
}
function renderTransmissions() {
  $("#tx-grid").innerHTML = TRANSMISSIONS.map(item => '<button type="button" data-tx="' + item.id + '" class="tx-card ' + (state.txId === item.id ? "selected" : "") + '"><i>' + String(item.number).padStart(2,"0") + '</i><strong>' + item.symbol + '</strong><span><b>' + item.title + '</b><small>' + item.description + '</small></span></button>').join("");
  $$('[data-tx]').forEach(button => button.addEventListener("click", () => { state.txId = button.dataset.tx; renderTransmissions(); updateFormula(); validateFormula(); }));
}
function updateFormula() {
  const az = AZ.find(item => item.id === state.azId); const buka = BUKI.find(item => item.id === state.bukaId); const tx = TRANSMISSIONS.find(item => item.id === state.txId);
  $("#formula-preview").innerHTML = '<span>' + escapeHtml(az?.title || "Аз") + '</span><i>×</i><span>' + escapeHtml(buka ? buka.symbol + " " + buka.title : "Бука") + '</span><i>→</i><span>' + escapeHtml(tx?.title || "Передача") + '</span>';
}
function compile() {
  syncText();
  state.passport = buildPassport(state, catalog);
  savePassport(state.passport); renderPassport(state.passport); setStage("passport");
}
function renderPassport(passport) {
  const labels = { conduct:"CONDUCT", review:"REVIEW", hold:"HOLD" };
  $("#result-state").textContent = labels[passport.outcome]; $("#result-state").dataset.outcome = passport.outcome;
  $("#result-title").textContent = passport.outcome === "conduct" ? "Формула сохраняет заявленную ось." : passport.outcome === "review" ? "Формула просит дополнительного различения." : "Проведение остановлено заявленным разрывом.";
  const rows = [["Формула",passport.formula.notation],["Намерение",passport.intent],["Инвариант",passport.invariant],["Индукция",passport.induction],["Инверсия",passport.inversion],["Следующий ход",passport.nextAction],["Хранение","локально в этом браузере"]];
  $("#passport-output").innerHTML = rows.map(([key,value]) => '<div><dt>' + key + '</dt><dd>' + escapeHtml(value) + '</dd></div>').join("");
}
function exportPassport() {
  if (!state.passport) return; const blob = new Blob([JSON.stringify(state.passport, null, 2)], {type:"application/json"}); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "module-" + state.passport.id + ".json"; link.click(); URL.revokeObjectURL(url);
}
function reset() {
  Object.assign(state, { intent:"", invariant:"", azId:"", bukaId:"", txId:"", induction:"", inversion:"", axis:"", passport:null, tag:"all", search:"" });
  $$('textarea,input[type="search"]').forEach(input => { input.value = ""; }); $$('input[type="radio"]').forEach(input => { input.checked = false; });
  renderFilters(); renderAz(); renderBuki(); renderTransmissions(); updateFormula(); validateAxis(); validateFormula(); setStage("axis");
}

["#intent", "#invariant"].forEach(selector => $(selector).addEventListener("input", validateAxis));
["#induction", "#inversion"].forEach(selector => $(selector).addEventListener("input", validateFormula));
$$('input[name="axis"]').forEach(input => input.addEventListener("change", () => { state.axis = input.value; validateFormula(); }));
$("#az-search").addEventListener("input", event => { state.search = event.target.value; renderAz(); });
$("#to-alphabet").addEventListener("click", () => setStage("alphabet"));
$("#to-formula").addEventListener("click", () => setStage("formula"));
$("#compile").addEventListener("click", compile); $("#new-cycle").addEventListener("click", reset); $("#export").addEventListener("click", exportPassport);
$$('[data-go]').forEach(button => button.addEventListener("click", () => { const target = button.dataset.go; if (target === "axis" || target === "alphabet" || (target === "formula" && state.azId) || (target === "passport" && state.passport)) setStage(target); }));

renderFilters(); renderAz(); renderBuki(); renderTransmissions(); updateFormula(); updateJournal(); validateAxis(); validateFormula();
if (location.hash === "#alphabet") setStage("alphabet");
