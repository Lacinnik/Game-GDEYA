// SC-5 Research v0.2 — самоотчётная, невалидированная шкала; не диагностика и не допуск.
export const FACTORS=Object.freeze([
  {key:"alpha",title:"α · Соответствие",items:["Связь действия с мотивом","Соответствие действия цели","Учет условий и последствий"]},
  {key:"IY",title:"IЯ · Интеграция ядра",items:["Сохранение позиции","Признание противоречивых мотивов","Восстановление целенаправленного действия"]},
  {key:"Cm",title:"Cm · Контейнер смыслов",items:["Различение интерпретаций","Удержание неопределенности","Интеграция смысловых позиций"]},
  {key:"Q",title:"Q · Качество отклика",items:["Прогноз результата","Распознавание расхождения","Коррекция по обратной связи"]},
  {key:"T",title:"T · Текучесть",items:["Смена стратегии","Отказ от неэффективной стратегии","Перенос способа в новую ситуацию"]}
]);
export const PLATES=Object.freeze(["РЕСУРС","ВЛАСТЬ","ОТНОШЕНИЯ","РЕЗУЛЬТАТ"]);
const SCALE=[0,0.25,0.5,0.75,1];
export function score(input) {
 if(!input||!PLATES.includes(input.plate))throw Error("Укажите допустимую плиту");
 if(input.consent!==true)throw Error("Нужно явное согласие");
 if(!Array.isArray(input.responses)||input.responses.length!==15||input.responses.some(x=>x!==null&&!SCALE.includes(x)))throw Error("Ожидаются 15 ответов: 0..1 с шагом 0.25 либо null");
 const factors={},missing=[];
 FACTORS.forEach((f,i)=>{const v=input.responses.slice(i*3,i*3+3);if(v.includes(null)){factors[f.key]=null;missing.push(f.key)}else factors[f.key]=Math.round(v.reduce((a,b)=>a+b,0)/3*10000)/10000});
 return {schema:"SC5Assessment.v1",version:"0.2.0-research",assessmentId:input.assessmentId||("sc5-"+crypto.randomUUID()),timestamp:input.timestamp||new Date().toISOString(),plate:input.plate,context:String(input.context||"").slice(0,500),cycleId:input.cycleId||null,phase:input.phase||null,responses:[...input.responses],factors,complete:missing.length===0,missing,method:"self-report-unvalidated",researchOnly:true,consent:true};
}
function validTimestamp(value){
 if(typeof value!=="string")return false;
 const parts=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
 if(!parts||!Number.isFinite(Date.parse(value)))return false;
 const [,year,month,day,hour,minute,second]=parts.map(Number);
 const lastDay=new Date(0);lastDay.setUTCFullYear(year,month,0);
 return month>=1&&month<=12&&day>=1&&day<=lastDay.getUTCDate()&&hour<24&&minute<60&&second<60;
}
export function validateRecord(r){
 if(!r||r.schema!=="SC5Assessment.v1"||r.version!=="0.2.0-research"||r.method!=="self-report-unvalidated"||r.researchOnly!==true||r.consent!==true||typeof r.assessmentId!=="string"||!r.assessmentId.trim()||r.assessmentId.length>120||!validTimestamp(r.timestamp))throw Error("Недопустимые метаданные записи");
 if(r.cycleId!==null&&r.cycleId!==undefined&&(typeof r.cycleId!=="string"||!/^[a-zA-Z0-9_-]{8,100}$/.test(r.cycleId)))throw Error("Неверный cycleId");
 if(r.phase!==null&&r.phase!==undefined&&!["before","after"].includes(r.phase))throw Error("Недопустимая фаза");
 const n=score({...r,consent:true,assessmentId:r.assessmentId,timestamp:r.timestamp});
 if(!r.factors||Object.keys(r.factors).length!==FACTORS.length||r.complete!==n.complete||FACTORS.some(f=>r.factors[f.key]!==n.factors[f.key])||JSON.stringify(r.missing)!==JSON.stringify(n.missing))throw Error("Несоответствие расчетов SC-5");
 return true;
}
export function toChronosInput(r) {
 validateRecord(r);
 if(!r.complete)throw Error("Неполный профиль не передается в Chronos");
 return {ts:r.timestamp,plate:r.plate,note:r.context,metrics:{alpha:r.factors.alpha,IY:r.factors.IY,Cm:r.factors.Cm,Q:r.factors.Q,T:r.factors.T},metadata:{source:"SC-5",assessmentId:r.assessmentId,researchOnly:true}};
}
export function summarizeChronos(records){
 const valid=[...records].filter(r=>{validateRecord(r);return r.complete}).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)||(a.assessmentId<b.assessmentId?-1:a.assessmentId>b.assessmentId?1:0));
 const first=valid[0],last=valid.at(-1);
 if(!first)return {count:0,delta:null,warning:"Нет полных измерений"};
 if(valid.some(r=>(r.cycleId??null)!==(first.cycleId??null)||r.plate!==first.plate||r.context!==first.context))return {count:valid.length,delta:null,researchOnly:true,warning:"Общее изменение не вычисляется: разные циклы, плиты или контексты"};
 const delta=Object.fromEntries(FACTORS.map(f=>[f.key,first===last?0:Math.round((last.factors[f.key]-first.factors[f.key])*10000)/10000]));
 return {count:valid.length,delta,first:first.timestamp,last:last.timestamp,method:"descriptive-temporal-difference",researchOnly:true,warning:"Разность самоотчетов: не клиническое изменение и не прогноз"};
}
export function importDataset(text) {
 if(text.length>1_000_000)throw Error("Размер импорта превышает 1 МБ");
 const data=JSON.parse(text);
 if(!data||data.schema!=="SC5Dataset.v1"||!Array.isArray(data.records)||data.records.length>1000)throw Error("Неверный набор");
 const ids=new Set();
 for(const r of data.records){validateRecord(r);if(ids.has(r.assessmentId))throw Error("Дублирование ID");ids.add(r.assessmentId)}
 return data.records;
}
export function exportDataset(records){
 for(const r of records)validateRecord(r);
 return JSON.stringify({schema:"SC5Dataset.v1",exportedAt:new Date().toISOString(),records},null,2);
}

// Парные наблюдения сопоставляются только по одному cycleId; другие циклы не смешиваются.
export function compareCycle(records,cycleId){
 if(typeof cycleId!=="string"||!cycleId)return {status:"unlinked"};
 const selected=records.filter(r=>{validateRecord(r);return r.cycleId===cycleId&&r.complete});
 const before=selected.filter(r=>r.phase==="before").sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
 const after=selected.filter(r=>r.phase==="after").sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
 if(before.length!==1||after.length!==1)return {status:"incomplete-pair",before:before.length,after:after.length};
 if(before[0].plate!==after[0].plate)return {status:"different-plates"};
 if(before[0].context!==after[0].context)return {status:"different-contexts"};
 if(Date.parse(after[0].timestamp)<Date.parse(before[0].timestamp))return {status:"invalid-order"};
 return {status:"paired",cycleId,delta:Object.fromEntries(FACTORS.map(f=>[f.key,Math.round((after[0].factors[f.key]-before[0].factors[f.key])*10000)/10000])),researchOnly:true};
}
