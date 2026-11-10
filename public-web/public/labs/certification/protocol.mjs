import { CERTIFICATION_STAGES, DRAFT_COMPETENCIES, REVIEW_RECOMMENDATIONS, REVIEW_STATUSES } from "./catalog.mjs";

export const CERTIFICATION_DOSSIER_SCHEMA = "architectonica.certification-dossier/0.1.0";
export const SUPERVISED_CASE_SCHEMA = "architectonica.supervised-case/0.1.0";
export const SUPERVISION_REVIEW_SCHEMA = "architectonica.supervision-review/0.1.0";
export const AUTHORIZATION_PACKAGE_SCHEMA = "architectonica.authorization-package/0.1.0";
export const MINIMUM_SUPERVISED_CASES = 3;

const SAFETY_FLAG_KEYS = Object.freeze(["access_granted", "canon_approved", "certificate_issued", "outcome_confirmed", "reviewer_identity_verified", "role_assigned"]);
const SOURCE_REFERENCE_KEYS = Object.freeze(["access_policy", "canon", "competencies", "ethics", "legal_review"]);
const CLOSED_INCIDENT_STATES = new Set(["none", "resolved"]);

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

const hasExactFalseFields = (value, keys) => Boolean(value && typeof value === "object"
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
  && keys.every((key) => value[key] === false));

const validText = (value, max = 2400) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
const validInstant = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const validDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const dateNotAfter = (value, now) => validDateOnly(value) && value <= new Date(now).toISOString().slice(0, 10);
const uniqueStrings = (values, minimum = 0) => Array.isArray(values) && values.length >= minimum
  && values.every((value) => validText(value, 200)) && new Set(values).size === values.length;
const sameStringSet = (left, right) => uniqueStrings(left) && uniqueStrings(right)
  && left.length === right.length && left.every((value) => right.includes(value));

const caseFingerprint = (entry) => JSON.stringify([entry.practice_date, entry.case_title, entry.object, entry.observed_trace, entry.evidence_pointer]);
const eligibleCases = (cases) => {
  const seen = new Set();
  return cases.filter((entry) => {
    if (entry.participant_consent !== true || entry.evidence_status !== "observed" || !CLOSED_INCIDENT_STATES.has(entry.incident_state)) return false;
    const fingerprint = caseFingerprint(entry);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
};

function reviewSupportsAuthorization(dossier, review) {
  if (!review || review.recommendation !== "ready-for-authorized-review") return false;
  if (!review.assessments?.every((assessment) => assessment.status === "observed")) return false;
  if (!uniqueStrings(review.case_ids, MINIMUM_SUPERVISED_CASES)) return false;
  const eligibleById = new Map(eligibleCases(dossier.cases).map((entry) => [entry.id, entry]));
  return review.case_ids.every((id) => {
    const supervisedCase = eligibleById.get(id);
    return supervisedCase && review.review_date >= supervisedCase.practice_date;
  });
}

function readinessFor(dossier) {
  const eligible = eligibleCases(dossier.cases);
  const latestReview = dossier.reviews[0] ?? null;
  const reasons = [];
  if (eligible.length < MINIMUM_SUPERVISED_CASES) reasons.push("THREE_ELIGIBLE_CASES_REQUIRED");
  if (!latestReview) reasons.push("CURRENT_SUPERVISION_REVIEW_REQUIRED");
  else if (latestReview.recommendation !== "ready-for-authorized-review") reasons.push("CURRENT_RECOMMENDATION_NOT_READY");
  else if (!latestReview.assessments.every((assessment) => assessment.status === "observed")) reasons.push("ALL_COMPETENCIES_MUST_BE_OBSERVED");
  else if (!reviewSupportsAuthorization(dossier, latestReview)) reasons.push("REVIEW_CASE_SNAPSHOT_INVALID");
  return {
    ready: reasons.length === 0,
    reasons,
    eligible_case_ids: eligible.map((entry) => entry.id),
    qualifying_case_ids: latestReview && reviewSupportsAuthorization(dossier, latestReview) ? [...latestReview.case_ids] : [],
    qualifying_review_id: latestReview && reviewSupportsAuthorization(dossier, latestReview) ? latestReview.id : null,
  };
}

function progressFor(dossier) {
  const eligible = eligibleCases(dossier.cases).length;
  const readiness = readinessFor(dossier);
  return {
    eligible_cases: eligible,
    required_cases: MINIMUM_SUPERVISED_CASES,
    supervised_practice_complete: eligible >= MINIMUM_SUPERVISED_CASES,
    supervision_recommends_review: readiness.ready,
    status: readiness.ready ? "ready-to-assemble-review-package" : "practice-in-progress",
  };
}

export function getAuthorizationReadiness(dossier) {
  if (!validateCertificationDossier(dossier)) return { ready:false, reasons:["DOSSIER_INVALID"], eligible_case_ids:[], qualifying_case_ids:[], qualifying_review_id:null };
  return readinessFor(dossier);
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
  const now = options.now ?? Date.now();
  if (!dateNotAfter(input.practiceDate, now)) throw new Error("PRACTICE_DATE_INVALID");
  return {
    schema: SUPERVISED_CASE_SCHEMA,
    id: makeId("supervised-case", options),
    dossier_id: dossier.id,
    created_at: new Date(now).toISOString(),
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
    verification: { consent_verified:false, evidence_verified:false, supervisor_identity_verified:false },
    q: null,
  };
}

export function attachSupervisedCase(dossier, supervisedCase, options = {}) {
  if (!validateCertificationDossier(dossier) || !validateSupervisedCase(supervisedCase) || supervisedCase.dossier_id !== dossier.id) throw new Error("CASE_SCOPE_MISMATCH");
  if (dossier.cases.some((entry) => entry.id === supervisedCase.id)) throw new Error("CASE_ID_DUPLICATE");
  if (dossier.cases.some((entry) => caseFingerprint(entry) === caseFingerprint(supervisedCase))) throw new Error("CASE_RECORD_DUPLICATE");
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
  const now = options.now ?? Date.now();
  if (!dateNotAfter(input.reviewDate, now)) throw new Error("REVIEW_DATE_INVALID");
  const eligible = eligibleCases(dossier.cases);
  if (recommendation === "ready-for-authorized-review" && eligible.length < MINIMUM_SUPERVISED_CASES) throw new Error("READY_RECOMMENDATION_REQUIRES_CASES");
  if (recommendation === "ready-for-authorized-review" && assessments.some((assessment) => assessment.status !== "observed")) throw new Error("READY_RECOMMENDATION_REQUIRES_OBSERVED_COMPETENCIES");
  if (recommendation === "ready-for-authorized-review" && eligible.some((entry) => input.reviewDate < entry.practice_date)) throw new Error("REVIEW_PRECEDES_CASE");
  return {
    schema: SUPERVISION_REVIEW_SCHEMA,
    id: makeId("supervision-review", options),
    dossier_id: dossier.id,
    created_at: new Date(now).toISOString(),
    reviewer: { declared_name: cleanText(input.reviewerName, "reviewer_name", 300), declared_role: cleanText(input.reviewerRole, "reviewer_role", 500), identity_verified: false, authority_verified:false },
    review_date: cleanText(input.reviewDate, "review_date", 80),
    case_ids: (recommendation === "ready-for-authorized-review" ? eligible : dossier.cases).map((entry) => entry.id),
    assessments,
    recommendation,
    review_note: cleanText(input.reviewNote, "review_note"),
    authorization_decision: null,
    verification: { reviewer_identity_verified:false, reviewer_authority_verified:false, assessment_basis_verified:false },
    flags: safetyFlags(),
    q: null,
  };
}

export function attachSupervisionReview(dossier, review, options = {}) {
  if (!validateCertificationDossier(dossier) || !validateSupervisionReview(review) || review.dossier_id !== dossier.id) throw new Error("REVIEW_SCOPE_MISMATCH");
  if (!review.case_ids.every((id) => dossier.cases.some((entry) => entry.id === id))) throw new Error("REVIEW_CASE_SCOPE_MISMATCH");
  if (dossier.reviews.some((entry) => entry.id === review.id)) throw new Error("REVIEW_ID_DUPLICATE");
  if (review.recommendation === "ready-for-authorized-review" && !reviewSupportsAuthorization(dossier, review)) throw new Error("REVIEW_READINESS_INVALID");
  const next = { ...dossier, updated_at: new Date(options.now ?? Date.now()).toISOString(), reviews: [review, ...dossier.reviews], flags: safetyFlags(), q: null };
  next.progress = progressFor(next);
  return next;
}

export function buildAuthorizationPackage(dossier, input, options = {}) {
  if (!validateCertificationDossier(dossier)) throw new Error("DOSSIER_INVALID");
  const readiness = readinessFor(dossier);
  if (!readiness.ready) throw new Error("READINESS_GATES_INCOMPLETE");
  return {
    schema: AUTHORIZATION_PACKAGE_SCHEMA,
    id: makeId("authorization-package", options),
    dossier_id: dossier.id,
    created_at: new Date(options.now ?? Date.now()).toISOString(),
    status: "ready-for-authorized-review",
    case_ids: readiness.qualifying_case_ids,
    review_ids: [readiness.qualifying_review_id],
    source_references: {
      canon: cleanText(input.canonReference, "canon_reference"),
      competencies: cleanText(input.competencyReference, "competency_reference"),
      ethics: cleanText(input.ethicsReference, "ethics_reference"),
      access_policy: cleanText(input.accessPolicyReference, "access_policy_reference"),
      legal_review: cleanText(input.legalReviewReference, "legal_review_reference"),
    },
    requested_decision: cleanText(input.requestedDecision, "requested_decision"),
    readiness_scope: "technical-package-only",
    verification: {
      canon_author_approved:false,
      competency_frame_approved:false,
      ethics_policy_approved:false,
      access_policy_approved:false,
      legal_review_verified:false,
      reviewer_identity_verified:false,
      reviewer_authority_verified:false,
    },
    decision: null,
    flags: safetyFlags(),
    q: null,
  };
}

export function attachAuthorizationPackage(dossier, authorizationPackage, options = {}) {
  if (!validateCertificationDossier(dossier) || !validateAuthorizationPackage(authorizationPackage) || authorizationPackage.dossier_id !== dossier.id) throw new Error("PACKAGE_SCOPE_MISMATCH");
  const readiness = readinessFor(dossier);
  if (!readiness.ready || !sameStringSet(authorizationPackage.case_ids, readiness.qualifying_case_ids) || !sameStringSet(authorizationPackage.review_ids, [readiness.qualifying_review_id])) throw new Error("PACKAGE_EVIDENCE_SCOPE_MISMATCH");
  if (dossier.authorization_packages.some((entry) => entry.id === authorizationPackage.id)) throw new Error("PACKAGE_ID_DUPLICATE");
  return { ...dossier, updated_at: new Date(options.now ?? Date.now()).toISOString(), authorization_packages: [authorizationPackage, ...dossier.authorization_packages], flags: safetyFlags(), q: null };
}

export function validateSupervisedCase(entry) {
  const verificationValid = entry?.verification === undefined || hasExactFalseFields(entry.verification, ["consent_verified", "evidence_verified", "supervisor_identity_verified"]);
  return Boolean(entry && entry.schema === SUPERVISED_CASE_SCHEMA && validText(entry.id, 200) && validText(entry.dossier_id, 200) && validInstant(entry.created_at)
    && validText(entry.case_title, 600) && validDateOnly(entry.practice_date) && validText(entry.participant_scope) && entry.participant_consent === true
    && validText(entry.consent_trace) && validText(entry.object) && validText(entry.observed_trace) && validText(entry.candidate_reflection)
    && validText(entry.supervisor_reference) && validText(entry.evidence_pointer) && entry.result_confirmed === false && entry.q === null
    && ["observed", "derived", "hypothesis", "unknown"].includes(entry.evidence_status) && ["none", "open", "resolved", "escalated"].includes(entry.incident_state) && verificationValid);
}

export function validateSupervisionReview(review) {
  const assessmentIds = review?.assessments?.map((item) => item.competency_id);
  const verificationValid = review?.verification === undefined || hasExactFalseFields(review.verification, ["assessment_basis_verified", "reviewer_authority_verified", "reviewer_identity_verified"]);
  return Boolean(review && review.schema === SUPERVISION_REVIEW_SCHEMA && validText(review.id, 200) && validText(review.dossier_id, 200) && validInstant(review.created_at)
    && review.q === null && review.authorization_decision === null && validText(review.reviewer?.declared_name, 300) && validText(review.reviewer?.declared_role, 500)
    && review.reviewer.identity_verified === false && (review.reviewer.authority_verified === undefined || review.reviewer.authority_verified === false)
    && validDateOnly(review.review_date) && uniqueStrings(review.case_ids) && REVIEW_RECOMMENDATIONS.includes(review.recommendation)
    && review.assessments?.length === DRAFT_COMPETENCIES.length && sameStringSet(assessmentIds, DRAFT_COMPETENCIES.map((item) => item.id))
    && review.assessments.every((item) => REVIEW_STATUSES.includes(item.status) && validText(item.basis)) && validText(review.review_note)
    && hasExactFalseFields(review.flags, SAFETY_FLAG_KEYS) && verificationValid);
}

export function validateAuthorizationPackage(entry) {
  const verificationKeys = ["access_policy_approved", "canon_author_approved", "competency_frame_approved", "ethics_policy_approved", "legal_review_verified", "reviewer_authority_verified", "reviewer_identity_verified"];
  const verificationValid = entry?.verification === undefined || hasExactFalseFields(entry.verification, verificationKeys);
  return Boolean(entry && entry.schema === AUTHORIZATION_PACKAGE_SCHEMA && validText(entry.id, 200) && validText(entry.dossier_id, 200) && validInstant(entry.created_at)
    && entry.status === "ready-for-authorized-review" && entry.decision === null && entry.q === null && uniqueStrings(entry.case_ids, MINIMUM_SUPERVISED_CASES)
    && uniqueStrings(entry.review_ids, 1) && hasExactFalseFields(entry.flags, SAFETY_FLAG_KEYS)
    && sameStringSet(Object.keys(entry.source_references ?? {}), SOURCE_REFERENCE_KEYS) && SOURCE_REFERENCE_KEYS.every((key) => validText(entry.source_references[key]))
    && validText(entry.requested_decision) && (entry.readiness_scope === undefined || entry.readiness_scope === "technical-package-only") && verificationValid);
}

export function validateCertificationDossier(dossier) {
  if (!dossier || dossier.schema !== CERTIFICATION_DOSSIER_SCHEMA || !validText(dossier.id, 200) || !validInstant(dossier.created_at) || !validInstant(dossier.updated_at)
    || dossier.q !== null || dossier.tensor?.Q !== null || dossier.candidate?.identity_verified !== false || !validText(dossier.candidate?.declared_name, 300)
    || !validText(dossier.candidate?.declared_role, 500)) return false;
  if (!hasExactFalseFields(dossier.flags, SAFETY_FLAG_KEYS) || dossier.stages?.length !== CERTIFICATION_STAGES.length
    || !sameStringSet(dossier.stages.map((stage) => stage.id), CERTIFICATION_STAGES.map((stage) => stage.id))) return false;
  if (!Array.isArray(dossier.cases) || dossier.cases.some((entry) => !validateSupervisedCase(entry) || entry.dossier_id !== dossier.id)
    || new Set(dossier.cases.map((entry) => entry.id)).size !== dossier.cases.length) return false;
  if (!Array.isArray(dossier.reviews) || dossier.reviews.some((entry) => !validateSupervisionReview(entry) || entry.dossier_id !== dossier.id
    || !entry.case_ids.every((id) => dossier.cases.some((supervisedCase) => supervisedCase.id === id)))
    || new Set(dossier.reviews.map((entry) => entry.id)).size !== dossier.reviews.length) return false;
  if (!Array.isArray(dossier.authorization_packages) || dossier.authorization_packages.some((entry) => !validateAuthorizationPackage(entry) || entry.dossier_id !== dossier.id
    || !entry.case_ids.every((id) => dossier.cases.some((supervisedCase) => supervisedCase.id === id))
    || !entry.review_ids.every((id) => dossier.reviews.some((review) => review.id === id)))
    || new Set(dossier.authorization_packages.map((entry) => entry.id)).size !== dossier.authorization_packages.length) return false;
  return JSON.stringify(dossier.progress) === JSON.stringify(progressFor(dossier));
}
