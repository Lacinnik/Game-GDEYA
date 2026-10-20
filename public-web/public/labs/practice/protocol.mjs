import { programById } from "./catalog.mjs";

export const PRACTICE_PLAN_SCHEMA = "architectonica.practice-plan/0.1.0";
export const PRACTICE_RECEIPT_SCHEMA = "architectonica.practice-receipt/0.1.0";
export const RECEIPT_STATES = Object.freeze(["attempted", "completed-self-reported", "paused"]);

function cleanText(value, field, max = 1800) {
  if (typeof value !== "string") throw new Error(`${field.toUpperCase()}_REQUIRED`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(`${field.toUpperCase()}_REQUIRED`);
  return cleaned;
}

function makeId(prefix, options = {}) {
  const now = options.now ?? Date.now();
  const raw = options.uuid?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
  return `${prefix}-${String(raw).replace(/[^a-zA-Z0-9-]/gu, "").slice(0, 64)}`;
}

function progress(plan) {
  const reported = new Set(plan.receipts.map((receipt) => receipt.unit_id)).size;
  return { reported_units:reported, total_units:plan.units.length, ratio:Math.round((reported / plan.units.length) * 1000) / 1000, status:"activity-trace-only" };
}

export function buildPracticePlan(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("INPUT_REQUIRED");
  const program = programById(input.program);
  if (!program) throw new Error("PROGRAM_REQUIRED");
  const startDate = cleanText(input.startDate,"start_date",40);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(startDate)) throw new Error("START_DATE_REQUIRED");
  const plan = {
    schema:PRACTICE_PLAN_SCHEMA,
    id:makeId("practice",options),
    created_at:new Date(options.now ?? Date.now()).toISOString(),
    producer:"architectonica-practice-studio",
    program:{ id:program.id, product_id:program.productId, title:program.title, source_status:program.sourceStatus },
    tensor:{
      O:cleanText(input.object,"object",600),
      S:cleanText(input.subjectManifestation,"subject_manifestation"),
      I:cleanText(input.reflectedImage,"reflected_image"),
      Rg:cleanText(input.targetRelation,"target_relation"),
      C:cleanText(input.context,"context"),
      Q:null,
    },
    invariant:cleanText(input.invariant,"invariant"),
    schedule:{ start_date:startDate, status:"authored-plan" },
    evidence_policy:cleanText(input.evidencePolicy,"evidence_policy",1200),
    first_action:cleanText(input.firstAction,"first_action",1200),
    completion_signal:cleanText(input.completionSignal,"completion_signal",1200),
    units:program.units.map((unit) => ({...unit})),
    receipts:[],
    progress:null,
    verified:false,
    outcome_confirmed:false,
    diagnosis:false,
    q:null,
    boundary:"The plan and its receipts are local self-reported activity traces. They do not prove effectiveness, diagnose a person, or confirm an external outcome.",
    storage:"local-browser-only",
  };
  plan.progress = progress(plan);
  return plan;
}

export function buildPracticeReceipt(plan, input, options = {}) {
  if (!validatePracticePlan(plan)) throw new Error("PLAN_INVALID");
  const program = programById(plan.program.id);
  const unit = program.units.find((candidate) => candidate.id === input?.unitId);
  if (!unit) throw new Error("UNIT_REQUIRED");
  if (!RECEIPT_STATES.includes(input?.state)) throw new Error("STATE_REQUIRED");
  const entries = Object.fromEntries(program.receiptFields.map((item) => [item.id,cleanText(input.entries?.[item.id],item.id)]));
  return {
    schema:PRACTICE_RECEIPT_SCHEMA,
    id:makeId("receipt",options),
    plan_id:plan.id,
    created_at:new Date(options.now ?? Date.now()).toISOString(),
    unit_id:unit.id,
    unit_label:unit.label,
    state:input.state,
    entries,
    evidence_pointer:cleanText(input.evidencePointer,"evidence_pointer",1200),
    evidence_status:"self-reported-unverified",
    verified:false,
    outcome_confirmed:false,
    q:null,
  };
}

export function attachPracticeReceipt(plan, receipt) {
  if (!validatePracticePlan(plan) || receipt?.schema !== PRACTICE_RECEIPT_SCHEMA || receipt.plan_id !== plan.id || receipt.q !== null || receipt.verified !== false) throw new Error("RECEIPT_INVALID");
  const receipts = [receipt,...plan.receipts.filter((item) => item.unit_id !== receipt.unit_id)];
  const next = {...plan,receipts};
  next.progress = progress(next);
  return next;
}

export function validatePracticePlan(plan) {
  if (!plan || plan.schema !== PRACTICE_PLAN_SCHEMA || !programById(plan.program?.id)) return false;
  if (plan.q !== null || plan.tensor?.Q !== null || plan.verified !== false || plan.outcome_confirmed !== false || plan.diagnosis !== false) return false;
  if (![plan.tensor.O,plan.tensor.S,plan.tensor.I,plan.tensor.Rg,plan.tensor.C,plan.invariant,plan.first_action,plan.completion_signal].every((value) => typeof value === "string" && value.length > 0)) return false;
  if (!Array.isArray(plan.units) || !Array.isArray(plan.receipts) || plan.units.length !== programById(plan.program.id).units.length) return false;
  return plan.receipts.every((receipt) => receipt?.schema === PRACTICE_RECEIPT_SCHEMA && receipt.plan_id === plan.id && receipt.q === null && receipt.verified === false);
}
