import { modeById } from "./catalog.mjs";

export const DIAGNOSTIC_SCHEMA = "architectonica.diagnostic-passport/0.1.0";
export const SCALE = Object.freeze([0, 0.25, 0.5, 0.75, 1]);

const cleanText = (value, field, max = 1800) => {
  if (typeof value !== "string") throw new Error(`${field.toUpperCase()}_REQUIRED`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(`${field.toUpperCase()}_REQUIRED`);
  return cleaned;
};
const score = (value, field) => {
  if (typeof value === "string" && !value.trim()) throw new Error(`${field.toUpperCase()}_SCALE`);
  const parsed = typeof value === "number" ? value : Number(value);
  if (!SCALE.includes(parsed)) throw new Error(`${field.toUpperCase()}_SCALE`);
  return parsed;
};
const round = (value) => Math.round(value * 1000) / 1000;
const makeId = (options = {}) => {
  const now = options.now ?? Date.now();
  const raw = options.uuid?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
  return `diagnostic-${String(raw).replace(/[^a-zA-Z0-9-]/gu, "").slice(0, 64)}`;
};

function compileScale(mode, answers = {}) {
  const sections = mode.sections.map((section) => {
    const items = section.questions.map((question) => ({ id:question.id, prompt:question.text, value:score(answers[question.id], question.id), evidence_status:"self-reported" }));
    return { id:section.id, label:section.label, score:round(items.reduce((sum, item) => sum + item.value, 0) / items.length), answers:items };
  });
  const minimum = Math.min(...sections.map((section) => section.score));
  return {
    method:"equal-weight-visible-average",
    sections,
    routing_hypothesis:{ status:"hypothesis", lowest_sections:sections.filter((section) => section.score === minimum).map(({id,label,score:value}) => ({id,label,score:value})), interpretation:"Начать проверку с минимального самоотчётного сектора; это не диагноз и не вероятность результата." },
  };
}

function compilePath(mode, answers = {}) {
  return {
    method:"authored-four-step-path",
    steps:mode.path.map((step) => ({ id:step.id, label:step.label, prompt:step.prompt, statement:cleanText(answers[step.id], step.id) })),
    routing_hypothesis:{ status:"authored-route", interpretation:"Маршрут фиксирует формулировки пользователя и не вычисляет правильность решения." },
  };
}

export function buildDiagnosticPassport(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("INPUT_REQUIRED");
  const mode = modeById(input.mode);
  if (!mode) throw new Error("MODE_REQUIRED");
  return {
    schema:DIAGNOSTIC_SCHEMA,
    id:makeId(options),
    created_at:new Date(options.now ?? Date.now()).toISOString(),
    producer:"architectonica-diagnostic-studio",
    mode:{ id:mode.id, product_id:mode.productId, title:mode.title, source_status:mode.sourceStatus },
    tensor:{
      O:cleanText(input.object,"object",600),
      S:cleanText(input.subjectManifestation,"subject_manifestation"),
      I:cleanText(input.reflectedImage,"reflected_image"),
      Rg:cleanText(input.targetRelation,"target_relation"),
      C:cleanText(input.context,"context"),
      Q:null,
    },
    invariant:cleanText(input.invariant,"invariant"),
    observation:{
      window:cleanText(input.observationWindow,"observation_window",1200),
      evidence_pointer:cleanText(input.evidencePointer,"evidence_pointer",1200),
      evidence_status:"self-reported-unverified",
    },
    instrument:mode.path ? compilePath(mode,input.answers) : compileScale(mode,input.answers),
    next_action:{ statement:cleanText(input.nextAction,"next_action",1200), status:"authored" },
    verified:false,
    diagnosis:false,
    calibrated_probability:false,
    q:null,
    boundary:"A diagnostic passport is a structured self-report and routing hypothesis. It does not diagnose a person or organization and does not prove an outcome.",
    storage:"local-browser-only",
  };
}

export function validateDiagnosticPassport(passport) {
  if (!passport || passport.schema !== DIAGNOSTIC_SCHEMA || passport.q !== null || passport.tensor?.Q !== null) return false;
  if (passport.verified !== false || passport.diagnosis !== false || passport.calibrated_probability !== false) return false;
  if (!modeById(passport.mode?.id) || ![passport.tensor.O,passport.tensor.S,passport.tensor.I,passport.tensor.Rg,passport.tensor.C,passport.invariant].every((value) => typeof value === "string" && value.length > 0)) return false;
  if (passport.instrument?.method === "equal-weight-visible-average") return passport.instrument.sections.every((section) => SCALE.some((value) => value === section.score) || (section.score > 0 && section.score < 1));
  return passport.instrument?.method === "authored-four-step-path" && passport.instrument.steps.every((step) => typeof step.statement === "string" && step.statement.length > 0);
}
