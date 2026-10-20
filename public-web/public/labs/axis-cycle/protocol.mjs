export const AXIS_HANDOFF_SCHEMA = "architectonica.axis-handoff/1.0.0";
export const AXIS_RETURN_SCHEMA = "architectonica.axis-return/1.0.0";
export const AXIS_RECEIPT_SCHEMA = "architectonica.axis-receipt/1.0.0";
export const ECOSYSTEM_EXCHANGE_SCHEMA = "architectonica.ecosystem-exchange/1.0.0";

const MAX_TOKEN_LENGTH = 16000;
const LIMITS = {
  object: 500,
  subject_manifestation: 1200,
  reflected_image: 1200,
  target_relation: 1200,
  context: 1200,
  next_action: 1200,
  invariant: 1200,
  observation: 2000,
};

const clean = (value) => typeof value === "string" ? value.trim() : "";
const validText = (value, key, minimum = 3) => {
  const text = clean(value);
  return text.length >= minimum && text.length <= LIMITS[key];
};
const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const validId = (value) => typeof value === "string" && value.length >= 8 && value.length <= 200;
const uuid = () => globalThis.crypto?.randomUUID?.() || `axis-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function encodeEnvelope(value) {
  const json = JSON.stringify(value);
  const token = bytesToBase64(new TextEncoder().encode(json)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  if (token.length > MAX_TOKEN_LENGTH) throw new Error("AXIS_TOKEN_TOO_LARGE");
  return token;
}

export function decodeEnvelope(token) {
  if (typeof token !== "string" || token.length < 8 || token.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+$/u.test(token)) throw new Error("INVALID_AXIS_TOKEN");
  const base64 = token.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(token.length / 4) * 4, "=");
  return JSON.parse(new TextDecoder().decode(base64ToBytes(base64)));
}

export function createAxisHandoff(input, environment = {}) {
  for (const key of ["object", "subject_manifestation", "reflected_image", "target_relation", "context", "next_action", "invariant"]) {
    if (!validText(input?.[key], key)) throw new Error(`INVALID_${key.toUpperCase()}`);
  }
  const now = environment.now ?? Date.now();
  if (!Number.isFinite(now)) throw new Error("INVALID_TIME");
  return {
    schema: AXIS_HANDOFF_SCHEMA,
    id: (environment.uuid ?? uuid)(),
    created_at: new Date(now).toISOString(),
    producer: "gdeya",
    recipient: "reson-field-check",
    object: clean(input.object),
    subject_manifestation: clean(input.subject_manifestation),
    reflected_image: clean(input.reflected_image),
    target_relation: clean(input.target_relation),
    context: clean(input.context),
    next_action: clean(input.next_action),
    invariant: clean(input.invariant),
    q: null,
    evidence_status: "self-reported-draft",
  };
}

export function validateAxisHandoff(value) {
  if (!value || value.schema !== AXIS_HANDOFF_SCHEMA || value.producer !== "gdeya" || value.recipient !== "reson-field-check"
    || !validId(value.id) || !validDate(value.created_at) || value.q !== null || value.evidence_status !== "self-reported-draft") return false;
  return ["object", "subject_manifestation", "reflected_image", "target_relation", "context", "next_action", "invariant"]
    .every((key) => validText(value[key], key));
}

export function validateAxisReturn(value, handoff = null) {
  if (!value || value.schema !== AXIS_RETURN_SCHEMA || value.producer !== "reson-field-check" || value.recipient !== "gdeya-axis"
    || !validId(value.id) || !validId(value.handoff_id) || !validDate(value.created_at) || value.q !== null
    || typeof value.allow !== "boolean" || typeof value.links_verified !== "boolean" || !validText(value.object, "object")) return false;
  if (!value.field_decision_id || !["ok", "trust", "missing-metrics", "metrics"].includes(value.gate)) return false;
  if (handoff && (!validateAxisHandoff(handoff) || value.handoff_id !== handoff.id || value.object !== handoff.object)) return false;
  return true;
}

export function createAxisReceipt(handoff, returned, input, environment = {}) {
  if (!validateAxisHandoff(handoff) || !validateAxisReturn(returned, handoff)) throw new Error("AXIS_CHAIN_MISMATCH");
  const observation = clean(input?.observation);
  const observedQ = input?.observed_q === "" || input?.observed_q == null ? null : Number(input.observed_q);
  if (observedQ !== null && (!Number.isFinite(observedQ) || observedQ < 0 || observedQ > 1 || !validText(observation, "observation", 8))) throw new Error("OBSERVATION_REQUIRED");
  const now = environment.now ?? Date.now();
  return {
    schema: AXIS_RECEIPT_SCHEMA,
    id: (environment.uuid ?? uuid)(),
    created_at: new Date(now).toISOString(),
    handoff,
    field_return: returned,
    observed_return: observation || null,
    q: observedQ,
    evidence_status: observedQ === null ? "return-not-observed" : "self-reported-observation",
    evidence: input?.evidence && typeof input.evidence === "object" ? sanitizeEvidence(input.evidence) : { class: observedQ === null ? "none" : "self-reported", references: [], verified: false },
  };
}

const EVIDENCE_CLASSES = new Set(["none", "self-reported", "documented", "independent-observation"]);
const safeReference = (value) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 500
  && !/^(javascript|data):/iu.test(value.trim());

function sanitizeEvidence(value) {
  const evidenceClass = EVIDENCE_CLASSES.has(value.class) ? value.class : "none";
  const references = Array.isArray(value.references) ? value.references.filter(safeReference).slice(0, 12).map((reference) => reference.trim()) : [];
  return {
    class: evidenceClass,
    observer_role: typeof value.observer_role === "string" ? value.observer_role.trim().slice(0, 120) : null,
    observed_at: validDate(value.observed_at) ? value.observed_at : null,
    references,
    note: typeof value.note === "string" ? value.note.trim().slice(0, 1000) : null,
    verified: false,
  };
}

export function createExchangeRecord(record, environment = {}) {
  if (!record || typeof record !== "object" || typeof record.schema !== "string" || !validId(record.id)) throw new Error("INVALID_EXCHANGE_RECORD");
  const now = environment.now ?? Date.now();
  const product = record.producer === "reson-field-check" || record.schema === "reson.collective-meta-decision/1.1.0" ? "reson-field-check" : "gdeya-axis";
  return {
    schema: ECOSYSTEM_EXCHANGE_SCHEMA,
    id: (environment.uuid ?? uuid)(),
    created_at: new Date(now).toISOString(),
    source: { ecosystem: "architectonica", product, repository: product === "reson-field-check" ? "reason-" : "Game-GDEYA", record_schema: record.schema, record_id: record.id },
    payload: record,
    evidence_class: record.evidence?.class ?? (record.evidence_status === "self-reported-observation" ? "self-reported" : "none"),
    verified: false,
  };
}

export function validateExchangeRecord(value) {
  return Boolean(value && value.schema === ECOSYSTEM_EXCHANGE_SCHEMA && validId(value.id) && validDate(value.created_at)
    && value.source?.ecosystem === "architectonica" && typeof value.source.product === "string"
    && typeof value.source.record_schema === "string" && value.payload?.schema === value.source.record_schema
    && value.payload?.id === value.source.record_id && EVIDENCE_CLASSES.has(value.evidence_class) && value.verified === false);
}

export function readExchangeRecord(value) {
  if (validateExchangeRecord(value)) return value;
  if (value?.schema === AXIS_RECEIPT_SCHEMA && validId(value.id)) return createExchangeRecord(value);
  if (validateAxisHandoff(value)) return createExchangeRecord(value);
  if (validateAxisReturn(value)) return createExchangeRecord(value);
  throw new Error("UNSUPPORTED_EXCHANGE_RECORD");
}

export function readExchangeRecords(value) {
  const values = value?.schema === "architectonica.exchange-journal/1.0.0" && Array.isArray(value.entries) ? value.entries : [value];
  if (values.length > 100) throw new Error("EXCHANGE_BATCH_TOO_LARGE");
  return values.map(readExchangeRecord);
}

export function fragmentValue(hash, key) {
  const params = new URLSearchParams(String(hash || "").replace(/^#/u, ""));
  return params.get(key);
}
