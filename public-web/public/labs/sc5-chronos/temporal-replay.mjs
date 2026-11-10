import {FACTORS,validateRecord} from "./sc5-core.mjs";

// Deterministic SC-5 event replay, not the original Chronos AI predictive engine.
export const REPLAY_VERSION="SC5.TemporalReplay.v1";
export function replayAssessmentHistory(records,{cycleId=null}={}){
 if(!Array.isArray(records))throw Error("История должна быть массивом");
 if(records.length>1000)throw Error("Превышен предел 1000 записей");
 const seen=new Set(),events=[];
 for(const record of records){
  validateRecord(record);
  if(seen.has(record.assessmentId))throw Error("Повторный assessmentId");
  seen.add(record.assessmentId);
  if(cycleId!==null&&record.cycleId!==cycleId)continue;
  events.push({eventId:record.assessmentId,at:new Date(record.timestamp).toISOString(),cycleId:record.cycleId??null,plate:record.plate,phase:record.phase??null,complete:record.complete,values:Object.fromEntries(FACTORS.map(f=>[f.key,record.factors[f.key]]))});
 }
 events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||(a.eventId<b.eventId?-1:a.eventId>b.eventId?1:0));
 let prev=null;
 const trajectory=events.map(event=>{
  const delta=prev&&prev.complete&&event.complete&&prev.plate===event.plate&&prev.cycleId===event.cycleId
   ?Object.fromEntries(FACTORS.map(f=>[f.key,Math.round((event.values[f.key]-prev.values[f.key])*10000)/10000]))
   :null;
  const result={...event,delta,comparedTo:delta?prev.eventId:null};
  prev=event;
  return result;
 });
 return {schema:REPLAY_VERSION,algorithmVersion:"1.0.1-research",eventCount:events.length,trajectory,researchOnly:true,prediction:false,diagnosis:false,accessDecision:false};
}
