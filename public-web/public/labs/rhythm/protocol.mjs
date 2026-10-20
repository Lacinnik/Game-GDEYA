import { rhythmIntentById, rhythmProgramById } from "./catalog.mjs";

export const RHYTHM_PLAN_SCHEMA = "architectonica.rhythm-plan/0.1.0";
export const RHYTHM_CHECKIN_SCHEMA = "architectonica.rhythm-checkin/0.1.0";
export const EVIDENCE_STATUSES = Object.freeze(["observed", "derived", "hypothesis", "unknown"]);
export const COMPLETION_STATES = Object.freeze(["done", "partial", "skipped", "stopped"]);

function cleanText(value, field, max = 1800) {
  if (typeof value !== "string") throw new Error(`${field.toUpperCase()}_REQUIRED`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(`${field.toUpperCase()}_REQUIRED`);
  return cleaned;
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function makeId(prefix, options = {}) {
  const now = options.now ?? Date.now();
  const raw = options.uuid?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
  return `${prefix}-${String(raw).replace(/[^a-zA-Z0-9-]/gu, "").slice(0, 64)}`;
}

function progress(plan) {
  const documented = new Set(plan.checkins.map((entry) => entry.step_id)).size;
  const completed = new Set(plan.checkins.filter((entry) => entry.completion_state === "done").map((entry) => entry.step_id)).size;
  return {
    documented_steps: documented,
    completed_steps: completed,
    total_steps: plan.steps.length,
    ratio: Math.round((documented / plan.steps.length) * 1000) / 1000,
    status: "activity-trace-only",
  };
}

function validateCheckin(checkin, plan) {
  return checkin?.schema === RHYTHM_CHECKIN_SCHEMA
    && checkin.plan_id === plan.id
    && plan.steps.some((step) => step.id === checkin.step_id)
    && EVIDENCE_STATUSES.includes(checkin.evidence_status)
    && COMPLETION_STATES.includes(checkin.completion_state)
    && [checkin.observed_trace, checkin.interpretation, checkin.next_action, checkin.evidence_pointer].every((value) => typeof value === "string" && value.length > 0)
    && checkin.medical_assessment === false
    && checkin.outcome_confirmed === false
    && checkin.verified === false
    && checkin.q === null;
}

export function buildRhythmPlan(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("INPUT_REQUIRED");
  const program = rhythmProgramById(input.program);
  const intent = rhythmIntentById(input.intent);
  if (!program) throw new Error("PROGRAM_REQUIRED");
  if (!intent) throw new Error("INTENT_REQUIRED");
  if (!validDate(input.startDate)) throw new Error("START_DATE_REQUIRED");
  if (input.authorshipAck !== true || input.nonMedicalAck !== true || input.localScheduleAck !== true) throw new Error("BOUNDARY_ACK_REQUIRED");

  const tensor = {
    O: cleanText(input.object, "object", 600),
    S: cleanText(input.subjectManifestation, "subject_manifestation"),
    I: cleanText(input.reflectedImage, "reflected_image"),
    Rg: cleanText(input.targetRelation, "target_relation"),
    C: cleanText(input.context, "context"),
    Q: null,
  };
  const plan = {
    schema: RHYTHM_PLAN_SCHEMA,
    id: makeId("rhythm", options),
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    producer: "architectonica-rhythm-transition-studio",
    program: { id: program.id, product_id: program.productId, title: program.title, source_status: program.sourceStatus },
    intent: { id: intent.id, label: intent.label },
    tensor,
    invariant: cleanText(input.invariant, "invariant"),
    start_date: input.startDate,
    time_budget: cleanText(input.timeBudget, "time_budget", 600),
    evidence_policy: cleanText(input.evidencePolicy, "evidence_policy", 1200),
    stop_condition: cleanText(input.stopCondition, "stop_condition", 1200),
    boundary_ack: {
      authorship: true,
      non_medical: true,
      local_schedule: true,
      recorded_at: new Date(options.now ?? Date.now()).toISOString(),
    },
    steps: program.steps.map((step) => ({ ...step, due_date: addDays(input.startDate, step.dayOffset) })),
    checkins: [],
    progress: null,
    evidence_status: "self-reported-unverified",
    medical_assessment: false,
    diagnosis: false,
    automated_notification: false,
    outcome_confirmed: false,
    verified: false,
    q: null,
    storage: "local-browser-only",
    boundary: "The studio schedules authored transitions and records self-reported traces. It does not diagnose, treat, notify third parties, or confirm outcomes.",
  };
  plan.progress = progress(plan);
  return plan;
}

export function buildRhythmCheckin(plan, input, options = {}) {
  if (!validateRhythmPlan(plan)) throw new Error("PLAN_INVALID");
  const step = plan.steps.find((candidate) => candidate.id === input?.stepId);
  if (!step) throw new Error("STEP_REQUIRED");
  if (!EVIDENCE_STATUSES.includes(input?.evidenceStatus)) throw new Error("EVIDENCE_STATUS_REQUIRED");
  if (!COMPLETION_STATES.includes(input?.completionState)) throw new Error("COMPLETION_STATE_REQUIRED");
  return {
    schema: RHYTHM_CHECKIN_SCHEMA,
    id: makeId("rhythm-checkin", options),
    plan_id: plan.id,
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    step_id: step.id,
    step_title: step.title,
    due_date: step.due_date,
    evidence_status: input.evidenceStatus,
    completion_state: input.completionState,
    observed_trace: cleanText(input.observedTrace, "observed_trace"),
    interpretation: cleanText(input.interpretation, "interpretation"),
    next_action: cleanText(input.nextAction, "next_action"),
    evidence_pointer: cleanText(input.evidencePointer, "evidence_pointer", 1200),
    medical_assessment: false,
    outcome_confirmed: false,
    verified: false,
    q: null,
  };
}

export function attachRhythmCheckin(plan, checkin) {
  if (!validateRhythmPlan(plan) || !validateCheckin(checkin, plan)) throw new Error("CHECKIN_INVALID");
  const next = { ...plan, checkins: [checkin, ...plan.checkins.filter((entry) => entry.step_id !== checkin.step_id)] };
  next.progress = progress(next);
  return next;
}

export function validateRhythmPlan(plan) {
  if (!plan || plan.schema !== RHYTHM_PLAN_SCHEMA || !rhythmProgramById(plan.program?.id) || !rhythmIntentById(plan.intent?.id)) return false;
  if (plan.tensor?.Q !== null || plan.q !== null || plan.medical_assessment !== false || plan.diagnosis !== false || plan.automated_notification !== false || plan.outcome_confirmed !== false || plan.verified !== false) return false;
  if (plan.boundary_ack?.authorship !== true || plan.boundary_ack?.non_medical !== true || plan.boundary_ack?.local_schedule !== true) return false;
  if (!validDate(plan.start_date)) return false;
  if (![plan.tensor.O, plan.tensor.S, plan.tensor.I, plan.tensor.Rg, plan.tensor.C, plan.invariant, plan.time_budget, plan.evidence_policy, plan.stop_condition].every((value) => typeof value === "string" && value.length > 0)) return false;
  const source = rhythmProgramById(plan.program.id);
  if (!Array.isArray(plan.steps) || !Array.isArray(plan.checkins) || plan.steps.length !== source.steps.length) return false;
  if (!plan.steps.every((step, index) => step.id === source.steps[index].id && validDate(step.due_date))) return false;
  return plan.checkins.every((entry) => validateCheckin(entry, plan));
}
