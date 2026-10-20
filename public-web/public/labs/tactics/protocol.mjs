export const TACTICS_PLAN_SCHEMA = "architectonica.tactics-plan/0.1.0";
export const TACTICS_RECEIPT_SCHEMA = "architectonica.tactics-receipt/0.1.0";

export const ENVIRONMENTS = Object.freeze({
  m1: Object.freeze({ id: "m1", code: "Мₘ¹", label: "среда шага", min_minutes: 0.5, max_minutes: 5 }),
  m2: Object.freeze({ id: "m2", code: "Мₘ²", label: "среда мини-задачи", min_minutes: 5, max_minutes: 25 }),
  m3: Object.freeze({ id: "m3", code: "Мₘ³", label: "среда микро-цикла", min_minutes: 25, max_minutes: 90 }),
  m4: Object.freeze({ id: "m4", code: "Мₘ⁴", label: "среда ритма", min_minutes: 1440, max_minutes: 10080 }),
});

const SCORE_VALUES = new Set([0, 0.25, 0.5, 0.75, 1]);
const text = (value, field, max = 1600) => {
  if (typeof value !== "string") throw new Error(`${field.toUpperCase()}_REQUIRED`);
  const clean = value.trim();
  if (!clean || clean.length > max) throw new Error(`${field.toUpperCase()}_REQUIRED`);
  return clean;
};
const score = (value, field) => {
  if (typeof value === "string" && value.trim() === "") throw new Error(`${field.toUpperCase()}_SCALE`);
  const parsed = typeof value === "number" ? value : Number(value);
  if (!SCORE_VALUES.has(parsed)) throw new Error(`${field.toUpperCase()}_SCALE`);
  return parsed;
};
const boundedNumber = (value, field, min, max) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error(`${field.toUpperCase()}_RANGE`);
  return parsed;
};
const round = (value) => Math.round(value * 10000) / 10000;
const makeId = (prefix, options = {}) => {
  const now = options.now ?? Date.now();
  const uuid = options.uuid?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
  return `${prefix}-${String(uuid).replace(/[^a-zA-Z0-9-]/gu, "").slice(0, 64)}`;
};

export function tacticalEmptiness({ noise, local_density: localDensity, focus }) {
  return round((1 - score(noise, "noise")) * score(localDensity, "local_density") * score(focus, "focus"));
}

export function tacticalVolume({ scope, time_load: timeLoad, energy }) {
  return round(score(scope, "scope") * score(timeLoad, "time_load") * score(energy, "energy"));
}

export function timeFitsEnvironment(environment, plannedMinutes) {
  const definition = ENVIRONMENTS[environment];
  if (!definition) throw new Error("ENVIRONMENT_REQUIRED");
  const minutes = boundedNumber(plannedMinutes, "planned_minutes", 0.5, 10080);
  return minutes >= definition.min_minutes && minutes <= definition.max_minutes;
}

function protocolStatus(pM, environmentFit) {
  if (pM < 0.25) return "hold-empty-space";
  if (!environmentFit) return "reshape-environment";
  return "ready-for-micro-action";
}

export function createTacticalPlan(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("INPUT_REQUIRED");
  const environment = text(input.environment, "environment", 2).toLowerCase();
  if (!ENVIRONMENTS[environment]) throw new Error("ENVIRONMENT_REQUIRED");
  const scores = {
    noise: score(input.noise, "noise"),
    local_density: score(input.local_density, "local_density"),
    focus: score(input.focus, "focus"),
    scope: score(input.scope, "scope"),
    time_load: score(input.time_load, "time_load"),
    energy: score(input.energy, "energy"),
  };
  const plannedMinutes = boundedNumber(input.planned_minutes, "planned_minutes", 0.5, 10080);
  const feedbackWindow = boundedNumber(input.feedback_window_min, "feedback_window_min", 3, 45);
  const pM = tacticalEmptiness(scores);
  const vM = tacticalVolume(scores);
  const environmentFit = timeFitsEnvironment(environment, plannedMinutes);

  return {
    schema: TACTICS_PLAN_SCHEMA,
    id: makeId("tactic", options),
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    producer: "architectonica-tactics",
    evidence_status: {
      authored_inputs: "self-reported",
      indices: "derived-from-visible-inputs",
      outcome: "unknown",
    },
    object: text(input.object, "object", 500),
    target_relation: text(input.target_relation, "target_relation", 1200),
    context: text(input.context, "context", 1200),
    invariant: text(input.invariant, "invariant", 1200),
    metric_basis: text(input.metric_basis, "metric_basis", 1600),
    tactical_environment: {
      ...ENVIRONMENTS[environment],
      planned_minutes: plannedMinutes,
      fit: environmentFit,
    },
    inputs: scores,
    derived: {
      tactical_emptiness_p_m: pM,
      tactical_volume_v_m: vM,
      protocol_status: protocolStatus(pM, environmentFit),
      calibrated_probability: false,
    },
    algebra: {
      a1_micro_decision: text(input.micro_decision, "micro_decision", 800),
      a2_micro_vector: text(input.micro_vector, "micro_vector", 800),
      a3_micro_rhythm: `${ENVIRONMENTS[environment].code} · ${plannedMinutes} мин`,
      a4_micro_collapse: text(input.micro_collapse, "micro_collapse", 800),
    },
    action: {
      statement: text(input.action, "action", 1200),
      completion_signal: text(input.completion_signal, "completion_signal", 800),
      feedback_window_min: feedbackWindow,
      post_action_pause_sec: 10,
    },
    source_states: {
      i9_action: "planned",
      i10_correction: null,
      i11_recognition: null,
      i12_synthesis: null,
    },
    q: null,
  };
}

export function validateTacticalPlan(plan) {
  if (!plan || typeof plan !== "object" || plan.schema !== TACTICS_PLAN_SCHEMA || plan.q !== null) return false;
  if (![plan.object, plan.target_relation, plan.context, plan.invariant, plan.metric_basis].every((value) => typeof value === "string" && value.length > 0)) return false;
  if (!plan.tactical_environment || !ENVIRONMENTS[plan.tactical_environment.id]) return false;
  if (!plan.inputs || !Object.values(plan.inputs).every((value) => SCORE_VALUES.has(value))) return false;
  if (!plan.derived || plan.derived.calibrated_probability !== false) return false;
  if (!plan.algebra || !plan.action || !plan.source_states) return false;
  return Number.isFinite(plan.derived.tactical_emptiness_p_m) && Number.isFinite(plan.derived.tactical_volume_v_m);
}

export function createTacticalReceipt(plan, input, options = {}) {
  if (!validateTacticalPlan(plan)) throw new Error("PLAN_INVALID");
  if (!input || typeof input !== "object") throw new Error("OBSERVATION_REQUIRED");
  const elapsedMinutes = boundedNumber(input.elapsed_minutes, "elapsed_minutes", 0.1, 10080);
  return {
    schema: TACTICS_RECEIPT_SCHEMA,
    id: makeId("tactic-return", options),
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    producer: "architectonica-tactics",
    plan_id: plan.id,
    object: plan.object,
    observed: {
      action_result: text(input.action_result, "action_result", 2000),
      elapsed_minutes: elapsedMinutes,
      i10_correction: text(input.correction, "correction", 1200),
      i11_recognition: text(input.recognition, "recognition", 1200),
      i12_synthesis: text(input.synthesis, "synthesis", 1200),
    },
    evidence_status: "self-reported-observation",
    q: null,
  };
}

export function validateTacticalReceipt(receipt, plan) {
  return Boolean(
    validateTacticalPlan(plan)
    && receipt
    && receipt.schema === TACTICS_RECEIPT_SCHEMA
    && receipt.plan_id === plan.id
    && receipt.object === plan.object
    && receipt.q === null
    && receipt.evidence_status === "self-reported-observation"
    && receipt.observed
    && [receipt.observed.action_result, receipt.observed.i10_correction, receipt.observed.i11_recognition, receipt.observed.i12_synthesis].every((value) => typeof value === "string" && value.length > 0)
  );
}
