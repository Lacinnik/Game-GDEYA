import {ChronosAI, type ChronosEventInput, type SequenceAnalysisResult} from "../public-web/chronos/chronos_ai_module";

const PLATES=new Set(["РЕСУРС","ВЛАСТЬ","ОТНОШЕНИЯ","РЕЗУЛЬТАТ"]);
const KEYS=["alpha","IY","Cm","Q","T"] as const;
const KEY="gdeya.sc5.research.v1";
type Row={assessmentId:string;timestamp:string;cycleId:string|null;plate:string;schema:string;complete:boolean;consent:boolean;factors:Record<string,unknown>};
const isRow=(x:unknown):x is Row=>typeof x==="object"&&x!==null&&
 "schema" in x&&x.schema==="SC5Assessment.v1"&&"consent" in x&&x.consent===true&&
 "complete" in x&&x.complete===true&&"cycleId" in x&&typeof x.cycleId==="string"&&
 "timestamp" in x&&typeof x.timestamp==="string"&&Number.isFinite(Date.parse(x.timestamp))&&
 "assessmentId" in x&&typeof x.assessmentId==="string"&&
 "plate" in x&&typeof x.plate==="string"&&PLATES.has(x.plate)&&
 "factors" in x&&typeof x.factors==="object"&&x.factors!==null;

export async function runAuthorialChronosForCycle(cycleId:string):Promise<SequenceAnalysisResult>{
 if(!/^cycle-[a-zA-Z0-9_-]{8,100}$/.test(cycleId))throw Error("Недопустимый идентификатор цикла");
 const raw=localStorage.getItem(KEY);
 if(!raw||raw.length>1_000_000)throw Error("Локальная история SC-5 недоступна или слишком велика");
 const dataset:unknown=JSON.parse(raw);
 if(!dataset||typeof dataset!=="object"||!("schema" in dataset)||dataset.schema!=="SC5Dataset.v1"||
 !("records" in dataset)||!Array.isArray(dataset.records)||dataset.records.length>1000)throw Error("Неверный формат истории SC-5");
 const rows=dataset.records.filter((r:unknown)=>isRow(r)&&r.cycleId===cycleId) as Row[];
 if(rows.length<2)throw Error("Для Chronos требуется минимум два полных измерения SC-5 одного цикла");
 const ids=new Set<string>();
 const events:ChronosEventInput[]=rows.map(r=>{
  if(ids.has(r.assessmentId))throw Error("Дублирующий идентификатор события");
  ids.add(r.assessmentId);
  const metrics:Record<string,number>={};
  for(const k of KEYS){const v=r.factors[k];if(typeof v!=="number"||!Number.isFinite(v)||v<0||v>1)throw Error("Неполная или неверная метрика "+k);metrics[k]=v}
  return {ts:new Date(r.timestamp).toISOString(),userId:cycleId,plate:r.plate as ChronosEventInput["plate"],metrics,metadata:{assessmentId:r.assessmentId,source:"SC5-self-report-unvalidated"}};
 });
 events.sort((a,b)=>String(a.ts).localeCompare(String(b.ts))||String(a.metadata?.assessmentId).localeCompare(String(b.metadata?.assessmentId)));
 const engine=new ChronosAI();
 return engine.analyzeSequence(events,cycleId);
}
