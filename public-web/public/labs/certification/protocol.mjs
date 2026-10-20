import { CERTIFICATION_STAGES, DRAFT_COMPETENCIES, REVIEW_RECOMMENDATIONS, REVIEW_STATUSES } from "./catalog.mjs";

export const CERTIFICATION_DOSSIER_SCHEMA = "architectonica.certification-dossier/0.1.0";
export const SUPERVISED_CASE_SCHEMA = "architectonica.supervised-case/0.1.0";
export const SUPERVISION_REVIEW_SCHEMA = "architectonica.supervision-review/0.1.0";
export const AUTHORIZATION_PACKAGE_SCHEMA = "architectonica.authorization-package/0.1.0";
export const MINIMUM_SUPERVISED_CASES = 3;

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

const safetyFlags = () => ({
  certificate_issued: false,
  access_granted: false,
  role_assigned: false,
  reviewer_identity_verified: false,
  canon_approved: false,
  outcome_confirmed: false,
});

const eligibleCaseCount = (cases) => cases.filter((entry) => entry.participant_consent === true && entry.evidence_status === "observed" && entry.incident_state !== "open").length;

function progressFor(dossier) {
  const eligible = eligibleCaseCount(dossier.cases);
  const reviewReady = dossier.reviews.some((review) => review.recommendation === "ready-for-authorized-review");
  return {
    eligible_cases: eligible,
    required_cases: MINIMUM_SUPERVISED_CASES,
    supervised_practice_complete: eligible >= MINIMUM_SUPERVISED_CASES,
    supervision_recommends_review: reviewReady,
    status: eligible >= MINIMUM_SUPERVISED_CASES && reviewReady ? "ready-to-assemble-review-package" : "practice-in-progress",
  };
}

export function buildCertificationDossier(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("INPUT_REQUIRED");
  if (![input.authorshipAck, input.consentAck, input.boundaryAck, input.authorizationAck].every((value) => value === true)) throw new Error("ACKNOWLEDGEMENTS_REQUIRED");
  const now = options.now ?? Date.now();
  const dossier = {
    schema: CERTIFICATION_DOSSIER_SCHEMA,
    id: makeId("certification-dossier", options),
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    producer: "architectonica-certification-readiness-studio",
    candidate: {
      declared_name: cleanText(input.candidateName, "candidate_name", 300),
      declared_role: cleanText(input.candidateRole, "candidate_role", 500),
      identity_verified: false,
    },
    tensor: {
      O: cleanText(input.object, "object", 1000),
      S: cleanText(input.subjectManifestation, "subject_manifestation"),
      I: cleanText(input.reflectedImage, "reflected_image"),
      Rg: cleanText(input.targetRelation, "target_relation"),
      C: cleanText(input.context, "context"),
      Q: null,
    },
    invariant: cleanText(input.invariant, "invariant"),
    requested_scope: cleanText(input.requestedScope, "requested_scope"),
    method_scope: cleanText(input.methodScope, "method_scope"),
    prerequisite_trace: cleanText(input.prerequisiteTrace, "prerequisite_trace"),
    supervision_plan: cleanText(input.supervisionPlan, "supervision_plan"),
    draft_framework: {
      canon_reference: cleanText(input.canonReference, "canon_reference"),
      competency_version: cleanText(input.competencyVersion, "competency_version", 500),
      ethics_reference: cleanText(input.ethicsReference, "ethics_reference"),
      canonical_status: "unapproved-reference",
      competencies: DRAFT_COMPETENCIES.map((item) => ({ ...item })),
    },
    stages: CERTIFICATION_STAGES.map((stage) => ({ ...stage, decision_state: "unresolved" })),
    acknowledgements: { authorship: true, consent_and_withdrawal: true, role_boundary: true, authorized_decision_required: true },
    cases: [],
    reviews: [],
    authorization_packages: [],
    progress: null,
    flags: safetyFlags(),
    evidence_status: "candidate-declared-readiness-plan",
    q: null,
    storage: "local-browser-only",
  };
  dossier.progress = progressFor(dossier);
  return dossier;
}

export function buildSupervisedCase(dossier, input, options = {}) {
  if (!validateCertificationDossier(dossier)) throw new Error("DOSSIER_INVALID");
  if (input?.participantConsent !== true) throw new Error("PARTICIPANT_CONSENT_REQUIRED");
  const evidenceStatus = String(input.evidenceStatus ?? "");
  if (!["observed", "derived", "hypothesis", "unknown"].includes(evidenceStatus)) throw new Error("EVIDENCE_STATUS_REQUIRED");
  const incidentState = String(input.incidentState ?? "");
  if (!["none", "open", "resolved", "escalated"].includes(incidentState)) throw new Error("INCIDENT_STATE_REQUIRED");
  return {
    schema: SUPERVISED_CASE_SCHEMA,
    id: makeId("supervised-case", options),
    dossier_id: dossier.id,
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    case_title: cleanText(input.caseTitle, "case_title", 600),
    practice_date: cleanText(input.practiceDate, "practice_date", 80),
    participant_scope: cleanText(input.participantScope, "participant_scope"),
    participant_consent: true,
    consent_trace: cleanText(input.consentTrace, "consent_trace"),
    object: cleanText(input.object, "object"),
    observed_trace: cleanText(input.observedTrace, "observed_trace"),
    candidate_reflection: cleanText(input.candidateReflection, "candidate_reflection"),
    supervisor_reference: cleanText(input.supervisorReference, "supervisor_reference"),
    evidence_pointer: cleanText(input.evidencePointer, "evidence_pointer"),
    evidence_status: evidenceStatus,
    incident_state: incidentState,
    result_confirmed: false,
    q: null,
  };
}

export function attachSupervisedCase(dossier, supervisedCase, options = {}) {
  if (!validateCertificationDossier(dossier) || !validateSupervisedCase(supervisedCase) || supervisedCase.dossier_id !== dossier.id) throw new Error("CASE_SCOPE_MISMATCH");
  const next = { ...dossier, updated_at: new Date(options.now ?? Date.now()).toISOString(), cases: [supervisedCase, ...dossier.cases], flags: safetyFlags(), q: null };
  next.progress = progressFor(next);
  return next;
}

export function buildSupervisionReview(dossier, input, options = {}) {
  if (!validateCertificationDossier(dossier)) throw new Error("DOSSIER_INVALID");
  const recommendation = String(input?.recommendation ?? "");
  if (!REVIEW_RECOMMENDATIONS.includes(recommendation)) throw new Error("RECOMMENDATION_REQUIRED");
  const assessments = DRAFT_COMPETENCIES.map((competency) => {
    const assessment = input.assessments?.[competency.id];
    if (!REVIEW_STATUSES.includes(assessment?.status)) throw new Error("ASSESSMENT_STATUS_REQUIRED");
    return { competency_id: competency.id, status: assessment.status, basis: cleanText(assessment.basis, "assessment_basis") };
  });
  return {
    schema: SUPERVISION_REVIEW_SCHEMA,
    id: makeId("supervision-review", options),
    dossier_id: dossier.id,
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    reviewer: { declared_name: cleanText(input.reviewerName, "reviewer_name", 300), declared_role: cleanText(input.reviewerRole, "reviewer_role", 500), identity_verified: false },
    review_date: cleanText(input.reviewDate, "review_date", 80),
    case_ids: dossier.cases.map((entry) => entry.id),
    assessments,
    recommendation,
    review_note: cleanText(input.reviewNote, "review_note"),
    authorization_decision: null,
    flags: safetyFlags(),
    q: null,
  };
}

export function attachSupervisionReview(dossier, review, options = {}) {
  if (!validateCertificationDossier(dossier) || !validateSupervisionReview(review) || review.dossier_id !== dossier.id) throw new Error("REVIEW_SCOPE_MISMATCH");
  const next = { ...dossier, updated_at: new Date(options.now ?? Date.now()).toISOString(), reviews: [review, ...dossier.reviews], flags: safetyFlags(), q: null };
  next.progress = progressFor(next);
  return next;
}

export function buildAuthorizationPackage(dossier, input, options = {}) {
  if (!validateCertificationDossier(dossier)) throw new Error("DOSSIER_INVALID");
  if (!dossier.progress.supervised_practice_complete || !dossier.progress.supervision_recommends_review) throw new Error("READINESS_GATES_INCOMPLETE");
  return {
    schema: AUTHORIZATION_PACKAGE_SCHEMA,
    id: makeId("authorization-package", options),
    dossier_id: dossier.id,
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    status: "ready-for-authorized-review",
    case_ids: dossier.cases.map((entry) => entry.id),
    review_ids: dossier.reviews.map((entry) => entry.id),
    source_references: {
      canon: cleanText(input.canonReference, "canon_reference"),
      competencies: cleanText(input.competencyReference, "competency_reference"),
      ethics: cleanText(input.ethicsReference, "ethics_reference"),
      access_policy: cleanText(input.accessPolicyReference, "access_policy_reference"),
      legal_review: cleanText(input.legalReviewReference, "legal_review_reference"),
    },
    requested_decision: cleanText(input.requestedDecision, "requested_decision"),
    decision: null,
    flags: safetyFlags(),
    q: null,
  };
}

export function attachAuthorizationPackage(dossier, authorizationPackage, options = {}) {
  if (!validateCertificationDossier(dossier) || !validateAuthorizationPackage(authorizationPackage) || authorizationPackage.dossier_id !== dossier.id) throw new Error("PACKAGE_SCOPE_MISMATCH");
  return { ...dossier, updated_at: new Date(options.now ?? Date.now()).toISOString(), authorization_packages: [authorizationPackage, ...dossier.authorization_packages], flags: safetyFlags(), q: null };
}

export function validateSupervisedCase(entry) {
  return Boolean(entry && entry.schema === SUPERVISED_CASE_SCHEMA && entry.participant_consent === true && entry.result_confirmed === false && entry.q === null && ["observed", "derived", "hypothesis", "unknown"].includes(entry.evidence_status) && ["none", "open", "resolved", "escalated"].includes(entry.incident_state));
}

export function validateSupervisionReview(review) {
  return Boolean(review && review.schema === SUPERVISION_REVIEW_SCHEMA && review.q === null && review.authorization_decision === null && review.reviewer?.identity_verified === false && REVIEW_RECOMMENDATIONS.includes(review.recommendation) && review.assessments?.length === DRAFT_COMPETENCIES.length && review.assessments.every((item) => REVIEW_STATUSES.includes(item.status)) && Object.values(review.flags ?? {}).every((value) => value === false));
}

export function validateAuthorizationPackage(entry) {
  return Boolean(entry && entry.schema === AUTHORIZATION_PACKAGE_SCHEMA && entry.status === "ready-for-authorized-review" && entry.decision === null && entry.q === null && Object.values(entry.flags ?? {}).every((value) => value === false) && Object.keys(entry.source_references ?? {}).length === 5);
}

export function validateCertificationDossier(dossier) {
  if (!dossier || dossier.schema !== CERTIFICATION_DOSSIER_SCHEMA || dossier.q !== null || dossier.tensor?.Q !== null || dossier.candidate?.identity_verified !== false) return false;
  if (!Object.values(dossier.flags ?? {}).every((value) => value === false) || dossier.stages?.length !== CERTIFICATION_STAGES.length) return false;
  if (!Array.isArray(dossier.cases) || dossier.cases.some((entry) => !validateSupervisedCase(entry))) return false;
  if (!Array.isArray(dossier.reviews) || dossier.reviews.some((entry) => !validateSupervisionReview(entry))) return false;
  if (!Array.isArray(dossier.authorization_packages) || dossier.authorization_packages.some((entry) => !validateAuthorizationPackage(entry))) return false;
  return JSON.stringify(dossier.progress) === JSON.stringify(progressFor(dossier));
}
