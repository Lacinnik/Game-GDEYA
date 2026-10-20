import { FRONTIER_TRACKS, frontierTrackByMode } from "./catalog.mjs";

export const FRONTIER_BLUEPRINT_SCHEMA = "architectonica.frontier-blueprint/0.1.0";
export const FRONTIER_RECEIPT_SCHEMA = "architectonica.frontier-receipt/0.1.0";

const cleanText = (value, field, max = 2400) => {
  if (typeof value !== "string") throw new Error(`${field.toUpperCase()}_REQUIRED`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(`${field.toUpperCase()}_REQUIRED`);
  return cleaned;
};

const makeId = (prefix, options = {}) => {
  const now = options.now ?? Date.now();
  const raw = options.uuid?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
  return `${prefix}-${String(raw).replace(/[^a-zA-Z0-9-]/gu, "").slice(0, 64)}`;
};

function calculateProgress(track, receipts) {
  const documented = new Set(receipts.map((receipt) => receipt.step_id)).size;
  const completed = new Set(receipts.filter((receipt) => receipt.completion_state === "done").map((receipt) => receipt.step_id)).size;
  return { documented_steps: documented, completed_steps: completed, total_steps: track.steps.length, ratio: documented / track.steps.length, status: "prototype-trace-only" };
}

export function buildFrontierBlueprint(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("INPUT_REQUIRED");
  const track = frontierTrackByMode(String(input.mode ?? ""));
  if (!track) throw new Error("TRACK_REQUIRED");
  if (input.authorshipAck !== true || input.boundaryAck !== true || input.localAck !== true) throw new Error("ACKNOWLEDGEMENTS_REQUIRED");
  const answers = Object.fromEntries(track.questions.map((question) => [question.key, cleanText(input.answers?.[question.key], question.key)]));
  const receipts = [];
  return {
    schema: FRONTIER_BLUEPRINT_SCHEMA,
    id: makeId("frontier-blueprint", options),
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    updated_at: new Date(options.now ?? Date.now()).toISOString(),
    producer: "architectonica-frontier-studio",
    track: { id: track.id, mode: track.mode, code: track.code, title: track.title, category: track.category, source_stage: track.sourceStage },
    tensor: {
      O: cleanText(input.object, "object", 800),
      S: cleanText(input.subjectManifestation, "subject_manifestation"),
      I: cleanText(input.reflectedImage, "reflected_image"),
      Rg: cleanText(input.targetRelation, "target_relation"),
      C: cleanText(input.context, "context"),
      Q: null,
    },
    invariant: cleanText(input.invariant, "invariant"),
    first_scenario: {
      title: cleanText(input.scenarioTitle, "scenario_title", 800),
      participant: cleanText(input.participant, "participant", 1200),
      duration: cleanText(input.duration, "duration", 600),
      success_signal: cleanText(input.successSignal, "success_signal", 1600),
      stop_condition: cleanText(input.stopCondition, "stop_condition", 1600),
    },
    answers,
    steps: track.steps.map((step, index) => ({ id: `step-${index + 1}`, order: index + 1, ...step })),
    guardrails: [...track.guardrails],
    receipts,
    progress: calculateProgress(track, receipts),
    flags: { prototype_validated: false, outcome_confirmed: false, diagnosis: false, access_granted: false },
    evidence_status: "self-reported-prototype-plan",
    q: null,
    storage: "local-browser-only",
  };
}

export function buildFrontierReceipt(blueprint, input, options = {}) {
  if (!validateFrontierBlueprint(blueprint)) throw new Error("BLUEPRINT_INVALID");
  const step = blueprint.steps.find((candidate) => candidate.id === input?.stepId);
  if (!step) throw new Error("STEP_REQUIRED");
  const completionState = String(input.completionState ?? "");
  if (!["done", "partial", "stopped", "skipped"].includes(completionState)) throw new Error("COMPLETION_STATE_REQUIRED");
  const evidenceStatus = String(input.evidenceStatus ?? "");
  if (!["observed", "derived", "hypothesis", "unknown"].includes(evidenceStatus)) throw new Error("EVIDENCE_STATUS_REQUIRED");
  return {
    schema: FRONTIER_RECEIPT_SCHEMA,
    id: makeId("frontier-receipt", options),
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    blueprint_id: blueprint.id,
    product_id: blueprint.track.id,
    step_id: step.id,
    step_title: step.title,
    completion_state: completionState,
    evidence_status: evidenceStatus,
    observed_trace: cleanText(input.observedTrace, "observed_trace"),
    interpretation: cleanText(input.interpretation, "interpretation"),
    evidence_pointer: cleanText(input.evidencePointer, "evidence_pointer", 1600),
    next_action: cleanText(input.nextAction, "next_action"),
    participant_reviewed: input.participantReviewed === true,
    outcome_confirmed: false,
    prototype_validated: false,
    q: null,
  };
}

export function attachFrontierReceipt(blueprint, receipt, options = {}) {
  if (!validateFrontierBlueprint(blueprint) || !validateFrontierReceipt(receipt)) throw new Error("RECEIPT_INVALID");
  if (receipt.blueprint_id !== blueprint.id || receipt.product_id !== blueprint.track.id) throw new Error("RECEIPT_SCOPE_MISMATCH");
  const receipts = [receipt, ...blueprint.receipts.filter((item) => item.step_id !== receipt.step_id)];
  const track = frontierTrackByMode(blueprint.track.mode);
  return { ...blueprint, updated_at: new Date(options.now ?? Date.now()).toISOString(), receipts, progress: calculateProgress(track, receipts), flags: { ...blueprint.flags, prototype_validated: false, outcome_confirmed: false }, q: null };
}

export function validateFrontierReceipt(receipt) {
  return Boolean(receipt && receipt.schema === FRONTIER_RECEIPT_SCHEMA && receipt.q === null && receipt.outcome_confirmed === false && receipt.prototype_validated === false && ["done", "partial", "stopped", "skipped"].includes(receipt.completion_state) && ["observed", "derived", "hypothesis", "unknown"].includes(receipt.evidence_status));
}

export function validateFrontierBlueprint(blueprint) {
  const track = frontierTrackByMode(blueprint?.track?.mode);
  if (!track || blueprint.schema !== FRONTIER_BLUEPRINT_SCHEMA || blueprint.track.id !== track.id) return false;
  if (blueprint.q !== null || blueprint.tensor?.Q !== null || blueprint.flags?.prototype_validated !== false || blueprint.flags?.outcome_confirmed !== false) return false;
  if (blueprint.steps?.length !== track.steps.length || track.questions.some((question) => !blueprint.answers?.[question.key])) return false;
  if (!Array.isArray(blueprint.receipts) || blueprint.receipts.some((receipt) => !validateFrontierReceipt(receipt))) return false;
  return JSON.stringify(blueprint.progress) === JSON.stringify(calculateProgress(track, blueprint.receipts));
}

export const FRONTIER_PRODUCT_IDS = Object.freeze(FRONTIER_TRACKS.map((track) => track.id));

