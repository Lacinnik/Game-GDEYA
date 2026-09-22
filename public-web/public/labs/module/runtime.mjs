import { compileTzarLanguage } from "../tzar-language-001.mjs";

export const MODULE_SCHEMA = "architectonica.module-passport/1.1.0";

/** Check the readable shape without upgrading or rebuilding a saved decision. */
export function canOpenPassport(value) {
  if (!value || typeof value !== "object" || value.schema !== MODULE_SCHEMA) return false;
  if (![value.id, value.createdAt, value.intent, value.invariant, value.induction, value.inversion, value.nextAction, value.formula?.notation,
    value.language?.layers?.publicStatement, value.language?.layers?.trueRequest, value.language?.formula].every(item => typeof item === "string")) return false;
  const outcome = new Map([["preserved", "conduct"], ["review", "review"], ["rupture", "hold"]]).get(value.axisVerdict);
  return Boolean(value.id && outcome && value.outcome === outcome
    && value.language?.modelId === "TZAR-LANGUAGE-001" && value.language?.profile === "module"
    && value.language?.tensor?.Q === null);
}

export function wordCount(value) {
  return String(value || "").trim().split(/\s+/u).filter(Boolean).length;
}

export function validateDraft(draft, catalog) {
  const errors = [];
  if (wordCount(draft.intent) < 3) errors.push("INTENT_INCOMPLETE");
  if (wordCount(draft.invariant) < 2) errors.push("INVARIANT_INCOMPLETE");
  if (!catalog.az.some(item => item.id === draft.azId)) errors.push("AZ_REQUIRED");
  if (!catalog.buki.some(item => item.id === draft.bukaId)) errors.push("BUKA_REQUIRED");
  if (!catalog.transmissions.some(item => item.id === draft.txId)) errors.push("TRANSMISSION_REQUIRED");
  if (wordCount(draft.induction) < 2) errors.push("INDUCTION_INCOMPLETE");
  if (wordCount(draft.inversion) < 2) errors.push("INVERSION_INCOMPLETE");
  if (!["preserved", "review", "rupture"].includes(draft.axis)) errors.push("AXIS_REQUIRED");
  return errors;
}

export function buildPassport(draft, catalog, environment = {}) {
  const errors = validateDraft(draft, catalog);
  if (errors.length) {
    const error = new Error("Module draft is incomplete: " + errors.join(", "));
    error.codes = errors;
    throw error;
  }
  const az = catalog.az.find(item => item.id === draft.azId);
  const buka = catalog.buki.find(item => item.id === draft.bukaId);
  const transmission = catalog.transmissions.find(item => item.id === draft.txId);
  const now = environment.now || (() => new Date().toISOString());
  const uuid = environment.uuid || (() => globalThis.crypto?.randomUUID?.() || "module-" + Date.now());
  const outcome = draft.axis === "preserved" ? "conduct" : draft.axis === "review" ? "review" : "hold";
  const language = compileTzarLanguage({
    object: draft.intent,
    subjectTrace: draft.induction,
    innerImage: draft.inversion,
    coreNeed: draft.intent,
    supra: draft.invariant,
    nextExperiment: transmission.action,
    riemann: "фактическое появление выбранной формы в заявленном контексте",
    observedQ: null,
  }, {
    profile: "module",
    voice: "subject",
    targetRelation: "материализовать следующий ход, сохраняя предъявленный инвариант",
    context: "МОДУЛЬ · 49 Азов × 24 Буки × 7 Передач",
    subjectConfirmed: true,
    azBias: { [az.id]: 1000 },
    bukaBias: { [buka.id]: 1000 },
    txBias: { [transmission.id]: 1000 },
  });
  return {
    schema: MODULE_SCHEMA,
    id: uuid(),
    createdAt: now(),
    laboratory: "gdeya",
    lifecycleState: "stable",
    intent: draft.intent.trim(),
    invariant: draft.invariant.trim(),
    formula: {
      notation: az.title + " × " + buka.symbol + " " + buka.title + " → " + transmission.title,
      az: { id: az.id, title: az.title, tag: az.tag },
      buka: { id: buka.id, symbol: buka.symbol, title: buka.title, tag: buka.tag },
      transmission: { id: transmission.id, title: transmission.title, symbol: transmission.symbol },
    },
    induction: draft.induction.trim(),
    inversion: draft.inversion.trim(),
    axisVerdict: draft.axis,
    outcome,
    nextAction: transmission.action,
    language,
    evidence: ["user-declared-intent", "user-selected-az", "user-selected-buka", "user-selected-transmission", "user-declared-axis"],
    boundary: "The passport records an authored choice; the public statement and symbolic formula remain separate, Q=null until observed return, and the model does not diagnose, predict, authorize, or prove an invariant.",
    storage: "local-browser-only",
  };
}
