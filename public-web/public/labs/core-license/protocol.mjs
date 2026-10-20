export const CORE_LICENSE_SCHEMA = "architectonica.core-license-dossier/0.1.0";

export const MODULES = Object.freeze({
  gdeya: "ГДЕЯ · Практический контур",
  reson: "РЕЗОН · полевая проверка",
  tactics: "Архитектоника Тактики",
  materialization: "Живой модуль материализации",
});

export const GATE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "canon", label: "Канон", authority: "автор" }),
  Object.freeze({ id: "legal", label: "Юридические заявления", authority: "автор + профильный юрист" }),
  Object.freeze({ id: "pricing", label: "Цена и модель обмена", authority: "автор" }),
  Object.freeze({ id: "access", label: "Права доступа", authority: "автор" }),
  Object.freeze({ id: "results", label: "Реальные результаты", authority: "независимое наблюдение" }),
]);

const cleanText = (value, field, max = 1800) => {
  if (typeof value !== "string") throw new Error(`${field.toUpperCase()}_REQUIRED`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(`${field.toUpperCase()}_REQUIRED`);
  return cleaned;
};

const makeId = (options = {}) => {
  const now = options.now ?? Date.now();
  const raw = options.uuid?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
  return `license-dossier-${String(raw).replace(/[^a-zA-Z0-9-]/gu, "").slice(0, 64)}`;
};

function selectedModules(input) {
  const raw = Array.isArray(input) ? input : [input].filter(Boolean);
  const unique = [...new Set(raw.map((item) => String(item)))];
  if (!unique.length || unique.some((item) => !(item in MODULES))) throw new Error("MODULES_REQUIRED");
  return unique.map((id) => ({ id, label: MODULES[id] }));
}

function compileGate(id, input = {}) {
  const definition = GATE_DEFINITIONS.find((item) => item.id === id);
  if (!definition) throw new Error("UNKNOWN_GATE");
  const status = input.status === "declared" ? "declared" : "unresolved";
  if (status === "unresolved") {
    return { ...definition, status, statement: null, reference: null, evidence_status: "none" };
  }
  return {
    ...definition,
    status,
    statement: cleanText(input.statement, `${id}_statement`, 1600),
    reference: cleanText(input.reference, `${id}_reference`, 1200),
    evidence_status: "self-reported-declaration",
  };
}

export function buildCoreLicenseDossier(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("INPUT_REQUIRED");
  const gates = Object.fromEntries(GATE_DEFINITIONS.map(({ id }) => [id, compileGate(id, input.gates?.[id])]));
  const unresolved = Object.values(gates).filter((gate) => gate.status === "unresolved").map((gate) => gate.id);
  return {
    schema: CORE_LICENSE_SCHEMA,
    id: makeId(options),
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    producer: "core-architecture-license-lab",
    object: cleanText(input.object, "object", 600),
    target_relation: cleanText(input.targetRelation, "target_relation"),
    context: cleanText(input.context, "context"),
    invariant: cleanText(input.invariant, "invariant"),
    deployment: {
      organization: cleanText(input.organization, "organization", 500),
      application: cleanText(input.application, "application"),
      responsible_party: cleanText(input.responsibleParty, "responsible_party", 600),
      included_modules: selectedModules(input.modules),
      allowed_use: cleanText(input.allowedUse, "allowed_use"),
      excluded_use: cleanText(input.excludedUse, "excluded_use"),
      implementation_boundary: cleanText(input.implementationBoundary, "implementation_boundary"),
      evidence_plan: cleanText(input.evidencePlan, "evidence_plan"),
    },
    finalization_gates: gates,
    readiness: {
      scope: "complete",
      unresolved_gates: unresolved,
      state: unresolved.length ? "scope-dossier" : "ready-for-author-review",
      license_issued: false,
    },
    evidence_status: "self-reported-unverified",
    verified: false,
    q: null,
    boundary: "This dossier prepares scope and explicit decision gates. It is not a license, legal advice, price offer, access grant, canonical declaration, or proof of results.",
    storage: "local-browser-only",
  };
}

export function validateCoreLicenseDossier(dossier) {
  if (!dossier || dossier.schema !== CORE_LICENSE_SCHEMA || dossier.q !== null || dossier.verified !== false) return false;
  if (dossier.readiness?.license_issued !== false || !["scope-dossier", "ready-for-author-review"].includes(dossier.readiness?.state)) return false;
  if (![dossier.object, dossier.target_relation, dossier.context, dossier.invariant].every((value) => typeof value === "string" && value.length > 0)) return false;
  const gates = dossier.finalization_gates;
  if (!gates || GATE_DEFINITIONS.some(({ id }) => !gates[id] || !["unresolved", "declared"].includes(gates[id].status))) return false;
  return Object.values(gates).every((gate) => gate.status === "unresolved" || (gate.statement && gate.reference && gate.evidence_status === "self-reported-declaration"));
}
