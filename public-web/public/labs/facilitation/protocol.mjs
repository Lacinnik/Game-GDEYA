import { programById } from "./catalog.mjs";

export const FACILITATION_PLAN_SCHEMA = "architectonica.facilitation-plan/0.1.0";
export const FACILITATION_NOTE_SCHEMA = "architectonica.facilitation-note/0.1.0";
export const EVIDENCE_STATUSES = Object.freeze(["observed","derived","hypothesis","unknown"]);

function cleanText(value, field, max = 1800) {
  if (typeof value !== "string") throw new Error(`${field.toUpperCase()}_REQUIRED`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(`${field.toUpperCase()}_REQUIRED`);
  return cleaned;
}

function makeId(prefix, options = {}) {
  const now = options.now ?? Date.now();
  const raw = options.uuid?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
  return `${prefix}-${String(raw).replace(/[^a-zA-Z0-9-]/gu, "").slice(0,64)}`;
}

function progress(plan) {
  const documented = new Set(plan.notes.map((note) => note.phase_id)).size;
  return { documented_phases:documented, total_phases:plan.phases.length, ratio:Math.round((documented / plan.phases.length) * 1000) / 1000, status:"facilitation-trace-only" };
}

function validateNote(note, plan) {
  const program = programById(plan.program.id);
  const requiredEntries = program.noteFields.map((field) => field.id);
  return note?.schema === FACILITATION_NOTE_SCHEMA
    && note.plan_id === plan.id
    && program.phases.some((phase) => phase.id === note.phase_id)
    && EVIDENCE_STATUSES.includes(note.evidence_status)
    && typeof note.role_scope === "string" && note.role_scope.length > 0
    && typeof note.evidence_pointer === "string" && note.evidence_pointer.length > 0
    && requiredEntries.every((field) => typeof note.entries?.[field] === "string" && note.entries[field].length > 0)
    && typeof note.participant_reviewed === "boolean"
    && note.q === null
    && note.verified === false
    && note.outcome_confirmed === false
    && note.people_scored === false;
}

export function buildFacilitationPlan(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("INPUT_REQUIRED");
  const program = programById(input.program);
  if (!program) throw new Error("PROGRAM_REQUIRED");
  if (input.voluntaryConsent !== true || input.sharedBoundaryAck !== true || input.noPeopleScoringAck !== true) throw new Error("CONSENT_REQUIRED");
  const startDate = cleanText(input.startDate,"start_date",40);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(startDate)) throw new Error("START_DATE_REQUIRED");
  const plan = {
    schema:FACILITATION_PLAN_SCHEMA,
    id:makeId("facilitation",options),
    created_at:new Date(options.now ?? Date.now()).toISOString(),
    producer:"architectonica-facilitation-studio",
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
    charter:{
      title:cleanText(input.title,"title",240),
      facilitator_role:cleanText(input.facilitatorRole,"facilitator_role",360),
      participant_roles:cleanText(input.participantRoles,"participant_roles",1200),
      start_date:startDate,
      duration:cleanText(input.duration,"duration",240),
      observation_boundary:cleanText(input.observationBoundary,"observation_boundary",1200),
      storage_policy:cleanText(input.storagePolicy,"storage_policy",1200),
      withdrawal_path:cleanText(input.withdrawalPath,"withdrawal_path",1200),
    },
    consent:{ voluntary:true, shared_boundary_ack:true, no_people_scoring_ack:true, recorded_at:new Date(options.now ?? Date.now()).toISOString() },
    phases:program.phases.map((phase) => ({...phase})),
    notes:[],
    progress:null,
    evidence_status:"self-reported-unverified",
    verified:false,
    outcome_confirmed:false,
    diagnosis:false,
    people_scored:false,
    access_granted:false,
    q:null,
    storage:"local-browser-only",
    boundary:"The plan documents a voluntary facilitation process. It does not diagnose, rank people, make employment decisions, grant access, or confirm an external outcome.",
  };
  plan.progress = progress(plan);
  return plan;
}

export function buildFacilitationNote(plan, input, options = {}) {
  if (!validateFacilitationPlan(plan)) throw new Error("PLAN_INVALID");
  const program = programById(plan.program.id);
  const phase = program.phases.find((candidate) => candidate.id === input?.phaseId);
  if (!phase) throw new Error("PHASE_REQUIRED");
  if (!EVIDENCE_STATUSES.includes(input?.evidenceStatus)) throw new Error("EVIDENCE_STATUS_REQUIRED");
  const entries = Object.fromEntries(program.noteFields.map((field) => [field.id,cleanText(input.entries?.[field.id],field.id)]));
  return {
    schema:FACILITATION_NOTE_SCHEMA,
    id:makeId("facilitation-note",options),
    plan_id:plan.id,
    created_at:new Date(options.now ?? Date.now()).toISOString(),
    phase_id:phase.id,
    phase_label:phase.label,
    role_scope:cleanText(input.roleScope,"role_scope",600),
    evidence_status:input.evidenceStatus,
    entries,
    evidence_pointer:cleanText(input.evidencePointer,"evidence_pointer",1200),
    participant_reviewed:input.participantReviewed === true,
    verified:false,
    outcome_confirmed:false,
    people_scored:false,
    q:null,
  };
}

export function attachFacilitationNote(plan, note) {
  if (!validateFacilitationPlan(plan) || !validateNote(note,plan)) throw new Error("NOTE_INVALID");
  const notes = [note,...plan.notes.filter((item) => item.phase_id !== note.phase_id)];
  const next = {...plan,notes};
  next.progress = progress(next);
  return next;
}

export function validateFacilitationPlan(plan) {
  if (!plan || plan.schema !== FACILITATION_PLAN_SCHEMA || !programById(plan.program?.id)) return false;
  if (plan.q !== null || plan.tensor?.Q !== null || plan.verified !== false || plan.outcome_confirmed !== false || plan.diagnosis !== false || plan.people_scored !== false || plan.access_granted !== false) return false;
  if (plan.consent?.voluntary !== true || plan.consent?.shared_boundary_ack !== true || plan.consent?.no_people_scoring_ack !== true) return false;
  if (![plan.tensor.O,plan.tensor.S,plan.tensor.I,plan.tensor.Rg,plan.tensor.C,plan.invariant,plan.charter?.title,plan.charter?.facilitator_role,plan.charter?.participant_roles,plan.charter?.start_date,plan.charter?.duration,plan.charter?.observation_boundary,plan.charter?.storage_policy,plan.charter?.withdrawal_path].every((value) => typeof value === "string" && value.length > 0)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(plan.charter.start_date)) return false;
  if (!Array.isArray(plan.phases) || !Array.isArray(plan.notes) || plan.phases.length !== programById(plan.program.id).phases.length) return false;
  return plan.notes.every((note) => validateNote(note,plan));
}
