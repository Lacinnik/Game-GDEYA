export const MODULE_SCHEMA = "architectonica.module-passport/1.0.0";

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
    evidence: ["user-declared-intent", "user-selected-az", "user-selected-buka", "user-selected-transmission", "user-declared-axis"],
    boundary: "The passport records an authored choice; it does not diagnose, predict, authorize, or prove an invariant.",
    storage: "local-browser-only",
  };
}
