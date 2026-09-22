import { readHandoff, readReceipts, saveReceipt } from "./handoff.mjs?v=meta-metrics-20260922-r1";
import { evaluateTransition } from "./runtime.mjs?v=meta-metrics-20260922-r1";
import { downloadJson } from "../local-journal.mjs";
const $=id=>document.getElementById(id);
const state={envelope:null,report:null,receipt:null};
const messages={
  "local-journal-match-only":"сверено только с локальным журналом, без подтверждения авторства",
  "explicit local risk declaration":"риск указан явно, стоп не включён",
  "declaration only; no delegated authority":"локальное подтверждение, без передачи полномочий",
  "explicit phase and local task":"фаза и локальная задача указаны явно",
  NO_HANDOFF:"Нет входящего следа. Завершите VoidOCR и нажмите «Передать в Meta Core».",
  SOURCE_NOT_ALLOWED:"Исходный след не допускает передачу.",
  EXPIRED_OR_FUTURE:"Передача устарела или содержит неверное время. Нужен свежий след.",
  SOURCE_JOURNAL_UNAVAILABLE:"Исходный локальный журнал недоступен.",
  SOURCE_MISMATCH:"Передача не совпадает с исходным локальным следом.",
  ALREADY_CONSUMED:"Эта передача уже закрыта сохранённой квитанцией.",
  STOP_OR_UNKNOWN_CRITICAL_RISK:"Включён стоп, риск не указан или отмечен как критический.",
  CONTEXT_REQUIRED:"Нужен явный, известный контекст.",
  ONLY_LOCAL_REVERSIBLE_DRAFTS:"Этот адаптер допускает только локальные обратимые черновики.",
  OWNER_AND_RECEIVER_CONFIRMATION_REQUIRED:"Назовите владельца и подтвердите проверку входящего следа.",
  RESPONSIBLE_PARTY_REQUIRED:"Для организации требуется явная ответственная сторона.",
  PUBLIC_DEFAULT_DENY:"Публичный контекст закрыт политикой исходного Meta Core.",
  PHASE_REQUIRED:"Фаза должна быть выбрана явно.",
  ACTION_AND_INVARIANT_REQUIRED:"Назовите действие и сохраняемый инвариант.",
  OBSERVED_RETURN_REQUIRED:"Нет отдельно сообщённого фактического возврата по объекту. Q не подставляется из VoidOCR.",
  EXPLICIT_METRICS_AND_BASIS_REQUIRED:"Для каждой из четырёх оценок выберите 0, 0.25, 0.5, 0.75 или 1 и укажите основания.",
  LOCAL_CHECK_PASSED:"Локальные проверки пройдены. Никакое действие не исполнено.",
  STORAGE_UNAVAILABLE_OR_CORRUPT:"Хранилище недоступно или повреждено; записи не заменены.",
  RECEIPT_JOURNAL_FULL:"Журнал содержит 500 квитанций. Новая запись остановлена, старые сохранены.",
};
const describe=code=>messages[code] || code;
function loadJournal() {
  let journal;
  try { journal=readReceipts(localStorage); } catch { journal={ok:false}; }
  $("journal").replaceChildren();
  $("journal-status").textContent=journal.ok ? "Сохранено: "+journal.entries.length+". Показаны последние 10; записи остаются локальными." : "Журнал недоступен или повреждён. Ничего не перезаписано.";
  if (!journal.ok) return;
  if (journal.entries.length) {
    const all=document.createElement("button");all.type="button";all.textContent="Экспорт всего журнала";
    all.addEventListener("click",()=>downloadJson("meta-core-journal.json",{schema:"architectonica.meta-receipt-journal/1.0.0",entries:journal.entries}));
    $("journal").append(all);
  }
  for (const receipt of journal.entries.slice(-10).reverse()) {
    const row=document.createElement("p"),label=document.createElement("span"),button=document.createElement("button");
    label.textContent=String(receipt.savedAt ?? "")+" · "+String(receipt.report?.status ?? "неизвестно")+" · ";
    button.type="button";button.textContent="Экспорт "+receipt.handoffId;
    button.addEventListener("click",()=>downloadJson("meta-core-"+receipt.handoffId+".json",receipt));
    row.append(label,button);$("journal").append(row);
  }
}
function load() {
  let result;
  try { result=readHandoff(sessionStorage,localStorage); } catch { result={ok:false,reason:"STORAGE_UNAVAILABLE_OR_CORRUPT"}; }
  $("source-status").textContent=result.ok?"Совпадение с локальным журналом подтверждено. Допуск принимающего контура ещё не проверен.":describe(result.reason);
  $("draft").hidden=!result.ok;
  if (!result.ok) return;
  state.envelope=result.envelope;
  const trace=result.envelope.trace;
  for (const [label,value] of [["Объект · дословно",trace.trigger],["След",trace.id],["До → после",trace.pre_state+" → "+trace.post_state],["Решение источника",trace.decision+" · устойчивость "+trace.stability+" / 3"],["Действует до",new Date(result.envelope.expiresAt).toLocaleString("ru-RU")]]) {
    const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=value;$("source").append(dt,dd);
  }
}
function draft() {
  const number=id=>$(id).value === "" || !$(id).validity.valid ? null : Number($(id).value);
  return {owner:$("owner").value.trim(),action:$("action").value.trim(),invariant:$("invariant").value.trim(),
    context:$("context").value,impact:$("impact").value,phase:$("phase").value,risk:$("risk").value,
    stop:$("stop").checked,responsible:$("responsible").checked,confirmed:$("confirmed").checked,
    observedQ:number("observed-q"),observation:$("observation").value.trim(),
    metrics:Object.fromEntries(["alpha","IY","Cm","T"].map(key=>[key,number(key)])),metricBasis:$("metric-basis").value.trim()};
}
function render(report) {
  $("result").hidden=false;$("verdict").textContent=report.status;$("reason").textContent=describe(report.reason);
  $("checks").replaceChildren(...report.checks.map(check=>{const li=document.createElement("li");li.textContent=(check.pass?"✓ ":"— ")+check.gate+": "+describe(check.reason || "локальный порог пройден");return li;}));
  $("save").disabled=false;$("save-status").textContent="Предварительная проверка · не сохранена.";
}
$("draft").addEventListener("submit",event=>{
  event.preventDefault();$("error").textContent="";
  try { state.report=evaluateTransition(state.envelope,draft(),localStorage);render(state.report); }
  catch { state.report=null;$("result").hidden=true;$("error").textContent="Проверка не завершена. Результат не выдан; проверьте доступность хранилища."; }
});
$("draft").addEventListener("input",()=>{state.report=null;$("result").hidden=true;});
$("save").addEventListener("click",()=>{
  if (!state.report || state.receipt) return;
  try {
    // Re-evaluate at save time; stale input, storage or expiry cannot reuse the preview.
    const fresh=evaluateTransition(state.envelope,draft(),localStorage);
    if (fresh.status !== state.report.status || fresh.reason !== state.report.reason || fresh.gate !== state.report.gate) {
      state.report=fresh;render(fresh);$("error").textContent="Условия изменились. Проверьте обновлённый результат перед сохранением.";return;
    }
    const result=saveReceipt(sessionStorage,localStorage,state.envelope,fresh);
    if (!result.ok) {$("error").textContent=describe(result.reason);return;}
    state.receipt=result.receipt;$("save-status").textContent="Квитанция сохранена. Передача закрыта; повторное использование этого идентификатора блокируется локально.";
    $("draft").hidden=true;$("save").disabled=true;$("export").disabled=false;$("error").textContent="";
    loadJournal();
  } catch { $("error").textContent="Не удалось сохранить квитанцию. Успешное сохранение не подтверждено."; }
});
$("export").addEventListener("click",()=>{if(state.receipt)downloadJson("meta-core-"+state.receipt.handoffId+".json",state.receipt);});
load();
loadJournal();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("../../sw.js").catch(()=>{});
