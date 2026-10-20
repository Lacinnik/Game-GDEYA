export const CREATOR_ACCESS_SCHEMA = "architectonica.creator-access-request/0.1.0";

export const ROLES = Object.freeze({
  creator: Object.freeze({ label: "Творец", function: "смысловая мера и причинная линия" }),
  architect: Object.freeze({ label: "Архитектор", function: "структура, цикл и проверка согласованности" }),
  bridge: Object.freeze({ label: "Связка Творец ↔ Архитектор", function: "переход от смысла к структуре" }),
  research: Object.freeze({ label: "Исследовательский доступ", function: "изучение ограниченного корпуса без присвоения роли" }),
});

const cleanText = (value, field, max = 1800) => {
  if (typeof value !== "string") throw new Error(`${field.toUpperCase()}_REQUIRED`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(`${field.toUpperCase()}_REQUIRED`);
  return cleaned;
};

const makeId = (options = {}) => {
  const now = options.now ?? Date.now();
  const raw = options.uuid?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
  return `creator-request-${String(raw).replace(/[^a-zA-Z0-9-]/gu, "").slice(0, 64)}`;
};

export function buildCreatorAccessRequest(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("INPUT_REQUIRED");
  const role = String(input.role ?? "");
  if (!(role in ROLES)) throw new Error("ROLE_REQUIRED");
  if (input.consent !== true || input.confidentiality !== true || input.nonAssignment !== true) throw new Error("ACKNOWLEDGEMENTS_REQUIRED");
  return {
    schema: CREATOR_ACCESS_SCHEMA,
    id: makeId(options),
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    producer: "architect-creator-gate",
    tensor: {
      O: cleanText(input.object, "object", 600),
      S: cleanText(input.subjectManifestation, "subject_manifestation"),
      I: cleanText(input.reflectedImage, "reflected_image"),
      Rg: cleanText(input.targetRelation, "target_relation"),
      C: cleanText(input.context, "context"),
      Q: null,
    },
    invariant: cleanText(input.invariant, "invariant"),
    requested_contour: { id: role, ...ROLES[role] },
    purpose: cleanText(input.purpose, "purpose"),
    prior_trace: cleanText(input.priorTrace, "prior_trace"),
    contribution: cleanText(input.contribution, "contribution"),
    requested_material: cleanText(input.requestedMaterial, "requested_material"),
    boundaries: cleanText(input.boundaries, "boundaries"),
    sponsor_or_reference: cleanText(input.sponsorReference, "sponsor_reference", 1000),
    acknowledgements: {
      voluntary_consent: true,
      confidentiality_acknowledged: true,
      role_not_self_assigned: true,
    },
    review: {
      required: true,
      authority: "author-or-explicitly-authorized-reviewer",
      decision: null,
      access_granted: false,
    },
    evidence_status: "self-reported-unverified-request",
    verified: false,
    q: null,
    boundary: "This file is an access request. It does not authenticate identity, assign a role, expose protected material, or grant access.",
    storage: "local-browser-only",
  };
}

export function validateCreatorAccessRequest(request) {
  return Boolean(
    request
    && request.schema === CREATOR_ACCESS_SCHEMA
    && request.q === null
    && request.tensor?.Q === null
    && request.verified === false
    && request.review?.required === true
    && request.review?.decision === null
    && request.review?.access_granted === false
    && request.requested_contour?.id in ROLES
    && Object.values(request.acknowledgements ?? {}).every((value) => value === true)
  );
}
