import { programById,requestTypeById,transmissionById } from "./catalog.mjs";

export const GUIDE_SESSION_SCHEMA="architectonica.guide-session/0.1.0";
export const GUIDE_RECEIPT_SCHEMA="architectonica.guide-receipt/0.1.0";
export const EVIDENCE_STATUSES=Object.freeze(["observed","derived","hypothesis","unknown"]);

function cleanText(value,field,max=1800){
  if(typeof value!=="string")throw new Error(`${field.toUpperCase()}_REQUIRED`);
  const cleaned=value.trim();
  if(!cleaned||cleaned.length>max)throw new Error(`${field.toUpperCase()}_REQUIRED`);
  return cleaned;
}

function makeId(prefix,options={}){
  const now=options.now??Date.now();
  const raw=options.uuid?.()??globalThis.crypto?.randomUUID?.()??`${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
  return `${prefix}-${String(raw).replace(/[^a-zA-Z0-9-]/gu,"").slice(0,64)}`;
}

function progress(session){
  const documented=new Set(session.receipts.map((receipt)=>receipt.step_id)).size;
  return {documented_steps:documented,total_steps:session.steps.length,ratio:Math.round((documented/session.steps.length)*1000)/1000,status:"authored-trace-only"};
}

function buildReflection(tensor,lens,requestType){
  return {
    object:`Объект сохранён дословно: «${tensor.O}».`,
    distinction:`Наблюдаемый след «${tensor.S}» отделён от образа «${tensor.I}».`,
    relation:`Рабочая цель: «${tensor.Rg}». Контекст: «${tensor.C}».`,
    prompt:lens.action,
    request_route:requestType.description,
    status:"generated-reflection-not-truth",
  };
}

function validateReceipt(receipt,session){
  return receipt?.schema===GUIDE_RECEIPT_SCHEMA
    && receipt.session_id===session.id
    && session.steps.some((step)=>step.id===receipt.step_id)
    && EVIDENCE_STATUSES.includes(receipt.evidence_status)
    && [receipt.authored_response,receipt.observed_trace,receipt.interpretation,receipt.next_action,receipt.evidence_pointer].every((value)=>typeof value==="string"&&value.length>0)
    && receipt.prediction===false&&receipt.diagnosis===false&&receipt.verified===false&&receipt.outcome_confirmed===false&&receipt.q===null;
}

export function buildGuideSession(input,options={}){
  if(!input||typeof input!=="object")throw new Error("INPUT_REQUIRED");
  const program=programById(input.program);if(!program)throw new Error("PROGRAM_REQUIRED");
  const requestType=requestTypeById(input.requestType);if(!requestType)throw new Error("REQUEST_TYPE_REQUIRED");
  const lens=transmissionById(input.lens);if(!lens)throw new Error("LENS_REQUIRED");
  if(input.authorshipAck!==true||input.noPredictionAck!==true||input.localStorageAck!==true)throw new Error("BOUNDARY_ACK_REQUIRED");
  const tensor={O:cleanText(input.object,"object",600),S:cleanText(input.subjectManifestation,"subject_manifestation"),I:cleanText(input.reflectedImage,"reflected_image"),Rg:cleanText(input.targetRelation,"target_relation"),C:cleanText(input.context,"context"),Q:null};
  const session={
    schema:GUIDE_SESSION_SCHEMA,id:makeId("guide",options),created_at:new Date(options.now??Date.now()).toISOString(),producer:"architectonica-digital-guide-studio",
    program:{id:program.id,product_id:program.productId,title:program.title,source_status:program.sourceStatus},
    request_type:{id:requestType.id,label:requestType.label},lens:{id:lens.id,title:lens.title,symbol:lens.symbol,action:lens.action},tensor,
    invariant:cleanText(input.invariant,"invariant"),opening_question:cleanText(input.openingQuestion,"opening_question",1200),first_action:cleanText(input.firstAction,"first_action",1200),evidence_policy:cleanText(input.evidencePolicy,"evidence_policy",1200),human_handoff:cleanText(input.humanHandoff,"human_handoff",1200),
    boundary_ack:{authorship:true,no_prediction:true,local_storage:true,recorded_at:new Date(options.now??Date.now()).toISOString()},
    reflection:buildReflection(tensor,lens,requestType),steps:program.steps.map((step)=>({...step})),receipts:[],progress:null,
    evidence_status:"self-reported-unverified",assistant_authority:false,prediction:false,diagnosis:false,verified:false,outcome_confirmed:false,q:null,storage:"local-browser-only",
    boundary:"The guide reflects authored inputs and offers prompts. It does not predict, diagnose, decide for the user, contact third parties, or confirm an outcome.",
  };
  session.progress=progress(session);return session;
}

export function buildGuideReceipt(session,input,options={}){
  if(!validateGuideSession(session))throw new Error("SESSION_INVALID");
  const step=session.steps.find((candidate)=>candidate.id===input?.stepId);if(!step)throw new Error("STEP_REQUIRED");
  if(!EVIDENCE_STATUSES.includes(input?.evidenceStatus))throw new Error("EVIDENCE_STATUS_REQUIRED");
  return {schema:GUIDE_RECEIPT_SCHEMA,id:makeId("guide-receipt",options),session_id:session.id,created_at:new Date(options.now??Date.now()).toISOString(),step_id:step.id,step_title:step.title,evidence_status:input.evidenceStatus,authored_response:cleanText(input.authoredResponse,"authored_response"),observed_trace:cleanText(input.observedTrace,"observed_trace"),interpretation:cleanText(input.interpretation,"interpretation"),next_action:cleanText(input.nextAction,"next_action"),evidence_pointer:cleanText(input.evidencePointer,"evidence_pointer",1200),prediction:false,diagnosis:false,verified:false,outcome_confirmed:false,q:null};
}

export function attachGuideReceipt(session,receipt){
  if(!validateGuideSession(session)||!validateReceipt(receipt,session))throw new Error("RECEIPT_INVALID");
  const next={...session,receipts:[receipt,...session.receipts.filter((item)=>item.step_id!==receipt.step_id)]};next.progress=progress(next);return next;
}

export function validateGuideSession(session){
  if(!session||session.schema!==GUIDE_SESSION_SCHEMA||!programById(session.program?.id)||!requestTypeById(session.request_type?.id)||!transmissionById(session.lens?.id))return false;
  if(session.tensor?.Q!==null||session.q!==null||session.assistant_authority!==false||session.prediction!==false||session.diagnosis!==false||session.verified!==false||session.outcome_confirmed!==false)return false;
  if(session.boundary_ack?.authorship!==true||session.boundary_ack?.no_prediction!==true||session.boundary_ack?.local_storage!==true)return false;
  if(![session.tensor.O,session.tensor.S,session.tensor.I,session.tensor.Rg,session.tensor.C,session.invariant,session.opening_question,session.first_action,session.evidence_policy,session.human_handoff].every((value)=>typeof value==="string"&&value.length>0))return false;
  if(!Array.isArray(session.steps)||!Array.isArray(session.receipts)||session.steps.length!==programById(session.program.id).steps.length)return false;
  return session.receipts.every((receipt)=>validateReceipt(receipt,session));
}
