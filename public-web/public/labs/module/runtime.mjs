import { compileTzarLanguage } from "../tzar-language-001.mjs";

export const MODULE_SCHEMA = "architectonica.module-passport/1.2.0";
export const LEGACY_MODULE_SCHEMA = "architectonica.module-passport/1.1.0";
export const MATERIALIZATION_RECEIPT_SCHEMA = "architectonica.materialization-receipt/0.1.0";

export const GEOMETRIES = Object.freeze(["Euclid", "Lobachevsky", "Riemann", "Projective", "Supra"]);
export const POINTS = Object.freeze(["Вход", "Порог", "Сдвиг", "Выход"]);
export const ARTIFACT_KINDS = Object.freeze(["document", "message", "publication", "agreement", "booking", "prototype", "other"]);
export const RETURN_KINDS = Object.freeze(["none", "partial", "direct", "contradiction"]);

const cleanText = (value, field, max = 1600) => {
  if (typeof value !== "string") throw new Error(`${field}_REQUIRED`);
  const clean = value.trim();
  if (!clean || clean.length > max) throw new Error(`${field}_REQUIRED`);
  return clean;
};

const optionalText = (value, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
const makeId = (prefix, environment = {}) => {
  const now = environment.now ?? Date.now();
  const uuid = environment.uuid?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
  return `${prefix}-${String(uuid).replace(/[^a-zA-Z0-9-]/gu, "").slice(0, 64)}`;
};

export function wordCount(value) {
  return String(value || "").trim().split(/\s+/u).filter(Boolean).length;
}

/** Read both the current passport and immutable 1.1 journal records. */
export function canOpenPassport(value) {
  if (!value || typeof value !== "object" || ![MODULE_SCHEMA, LEGACY_MODULE_SCHEMA].includes(value.schema)) return false;
  if (![value.id, value.createdAt, value.intent, value.invariant, value.induction, value.inversion, value.nextAction, value.formula?.notation,
    value.language?.layers?.publicStatement, value.language?.layers?.trueRequest, value.language?.formula].every((item) => typeof item === "string")) return false;
  const outcome = new Map([["preserved", "conduct"], ["review", "review"], ["rupture", "hold"]]).get(value.axisVerdict);
  if (!(value.id && outcome && value.outcome === outcome
    && value.language?.modelId === "TZAR-LANGUAGE-001" && value.language?.profile === "module"
    && value.language?.tensor?.Q === null)) return false;
  if (value.schema === LEGACY_MODULE_SCHEMA) return true;
  return [value.object, value.targetRelation, value.context, value.tacticalAction, value.geometry, value.point]
    .every((item) => typeof item === "string" && item.length > 0)
    && value.intent === value.object
    && GEOMETRIES.includes(value.geometry)
    && POINTS.includes(value.point);
}

export function canOpenMaterializationReceipt(value) {
  return Boolean(value && typeof value === "object"
    && value.schema === MATERIALIZATION_RECEIPT_SCHEMA
    && typeof value.id === "string" && value.id
    && typeof value.passportId === "string" && value.passportId
    && typeof value.object === "string" && value.object
    && ARTIFACT_KINDS.includes(value.artifact?.kind)
    && [value.artifact?.statement, value.artifact?.completionMarker, value.artifact?.evidencePointer].every((item) => typeof item === "string" && item)
    && RETURN_KINDS.includes(value.externalReturn?.kind)
    && [value.externalReturn?.trace, value.externalReturn?.integrationDecision].every((item) => typeof item === "string" && item)
    && value.evidenceStatus?.verified === false
    && value.q === null);
}

export function validateDraft(draft, catalog) {
  const errors = [];
  const object = draft.object ?? draft.intent;
  if (wordCount(object) < 3) errors.push("OBJECT_INCOMPLETE");
  if (wordCount(draft.targetRelation) < 2) errors.push("TARGET_RELATION_INCOMPLETE");
  if (wordCount(draft.context) < 2) errors.push("CONTEXT_INCOMPLETE");
  if (wordCount(draft.invariant) < 2) errors.push("INVARIANT_INCOMPLETE");
  if (wordCount(draft.tacticalAction) < 2) errors.push("TACTICAL_ACTION_INCOMPLETE");
  if (!catalog.az.some((item) => item.id === draft.azId)) errors.push("AZ_REQUIRED");
  if (!catalog.buki.some((item) => item.id === draft.bukaId)) errors.push("BUKA_REQUIRED");
  if (!catalog.transmissions.some((item) => item.id === draft.txId)) errors.push("TRANSMISSION_REQUIRED");
  if (wordCount(draft.induction) < 2) errors.push("INDUCTION_INCOMPLETE");
  if (wordCount(draft.inversion) < 2) errors.push("INVERSION_INCOMPLETE");
  if (!GEOMETRIES.includes(draft.geometry)) errors.push("GEOMETRY_REQUIRED");
  if (!POINTS.includes(draft.point)) errors.push("POINT_REQUIRED");
  if (!["preserved", "review", "rupture"].includes(draft.axis)) errors.push("AXIS_REQUIRED");
  return errors;
}

export function buildPassport(draft, catalog, environment = {}) {
  const errors = validateDraft(draft, catalog);
  if (errors.length) {
    const error = new Error(`Module draft is incomplete: ${errors.join(", ")}`);
    error.codes = errors;
    throw error;
  }
  const object = cleanText(draft.object ?? draft.intent, "OBJECT", 500);
  const targetRelation = cleanText(draft.targetRelation, "TARGET_RELATION", 1200);
  const context = cleanText(draft.context, "CONTEXT", 1200);
  const invariant = cleanText(draft.invariant, "INVARIANT", 1200);
  const tacticalAction = cleanText(draft.tacticalAction, "TACTICAL_ACTION", 1200);
  const induction = cleanText(draft.induction, "INDUCTION", 1200);
  const inversion = cleanText(draft.inversion, "INVERSION", 1200);
  const az = catalog.az.find((item) => item.id === draft.azId);
  const buka = catalog.buki.find((item) => item.id === draft.bukaId);
  const transmission = catalog.transmissions.find((item) => item.id === draft.txId);
  const now = environment.now || (() => new Date().toISOString());
  const outcome = draft.axis === "preserved" ? "conduct" : draft.axis === "review" ? "review" : "hold";
  const language = compileTzarLanguage({
    object,
    subjectTrace: induction,
    innerImage: inversion,
    coreNeed: targetRelation,
    supra: invariant,
    nextExperiment: tacticalAction,
    riemann: "фактическое появление выбранной формы в заявленном контексте",
    observedQ: null,
  }, {
    profile: "module",
    voice: "subject",
    targetRelation,
    context,
    subjectConfirmed: true,
    azBias: { [az.id]: 1000 },
    bukaBias: { [buka.id]: 1000 },
    txBias: { [transmission.id]: 1000 },
  });
  return {
    schema: MODULE_SCHEMA,
    id: makeId("module", environment),
    createdAt: now(),
    producer: "living-materialization-module",
    laboratory: "gdeya",
    lifecycleState: "stable",
    sourceTacticId: optionalText(draft.sourceTacticId, 100) || null,
    object,
    intent: object,
    targetRelation,
    context,
    invariant,
    tacticalAction,
    geometry: draft.geometry,
    point: draft.point,
    formula: {
      notation: `${az.title} × ${buka.symbol} ${buka.title} → ${transmission.title}`,
      az: { id: az.id, title: az.title, tag: az.tag },
      buka: { id: buka.id, symbol: buka.symbol, title: buka.title, tag: buka.tag },
      transmission: { id: transmission.id, title: transmission.title, symbol: transmission.symbol },
    },
    induction,
    inversion,
    axisVerdict: draft.axis,
    outcome,
    nextAction: tacticalAction,
    language,
    evidence: ["user-declared-object", "user-declared-target-relation", "user-declared-context", "user-selected-az", "user-selected-buka", "user-selected-transmission", "user-declared-axis"],
    boundary: "The passport records an authored choice; O, R_g, C and I remain separate, Q=null until independently observed, and the module does not diagnose, predict, authorize, or prove an invariant.",
    storage: "local-browser-only",
  };
}

export function createMaterializationReceipt(passport, input, environment = {}) {
  if (!canOpenPassport(passport)) throw new Error("PASSPORT_INVALID");
  if (passport.outcome !== "conduct") throw new Error("AXIS_NOT_PRESERVED");
  if (!ARTIFACT_KINDS.includes(input?.artifactKind)) throw new Error("ARTIFACT_KIND_REQUIRED");
  if (!RETURN_KINDS.includes(input?.returnKind)) throw new Error("RETURN_KIND_REQUIRED");
  const timestamp = new Date(environment.now ?? Date.now()).toISOString();
  return {
    schema: MATERIALIZATION_RECEIPT_SCHEMA,
    id: makeId("material", environment),
    createdAt: timestamp,
    producer: "living-materialization-module",
    passportId: passport.id,
    sourceTacticId: passport.sourceTacticId,
    object: passport.object,
    targetRelation: passport.targetRelation,
    context: passport.context,
    invariant: passport.invariant,
    geometry: passport.geometry,
    point: passport.point,
    formula: passport.formula,
    artifact: {
      kind: input.artifactKind,
      statement: cleanText(input.artifactStatement, "ARTIFACT_STATEMENT", 1600),
      completionMarker: cleanText(input.completionMarker, "COMPLETION_MARKER", 1200),
      evidencePointer: cleanText(input.evidencePointer, "EVIDENCE_POINTER", 1600),
      status: "self-reported-produced",
    },
    externalReturn: {
      kind: input.returnKind,
      trace: cleanText(input.externalTrace, "EXTERNAL_TRACE", 1600),
      integrationDecision: cleanText(input.integrationDecision, "INTEGRATION_DECISION", 1600),
    },
    evidenceStatus: {
      artifact: "self-reported",
      externalReturn: "self-reported",
      verified: false,
    },
    q: null,
    boundary: "This receipt preserves a self-reported artifact and return. It is not independent verification of effectiveness, authorship, rights, delivery, or outcome.",
    storage: "local-browser-only",
  };
}
