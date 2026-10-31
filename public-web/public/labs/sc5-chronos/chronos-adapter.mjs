import {replayAssessmentHistory,REPLAY_VERSION} from "./temporal-replay.mjs";

// Boundary for a future independently verified Chronos AI implementation.
// Default path never invokes an unregistered engine or produces predictions.
export const CHRONOS_ADAPTER_VERSION="ChronosAdapter.v1";
export function prepareChronosInput(records,{cycleId=null}={}){
 const replay=replayAssessmentHistory(records,{cycleId});
 return {schema:CHRONOS_ADAPTER_VERSION,sourceSchema:REPLAY_VERSION,
   researchOnly:true,events:replay.trajectory.map(({eventId,at,cycleId,plate,phase,complete,values,delta})=>
     ({eventId,at,cycleId,plate,phase,complete,values:{...values},delta:delta?{...delta}:null}))};
}
export async function invokeChronosEngine(records,engine,{cycleId=null}={}){
 if(typeof engine!=="function")throw Error("Chronos AI engine не подключён");
 const input=prepareChronosInput(records,{cycleId});
 const output=await engine(structuredClone(input));
 if(!output||output.schema!=="ChronosEngineResult.v1"||output.sourceSchema!==CHRONOS_ADAPTER_VERSION||
    output.researchOnly!==true||output.prediction!==false||
    output.diagnosis!==false||output.accessDecision!==false||
    !Array.isArray(output.events)||output.events.length!==input.events.length||
    output.events.some((event,i)=>event!==input.events[i].eventId))
   throw Error("Несоответствие контракту Chronos Engine v1");
 return {...output,engineVerified:false};
}
