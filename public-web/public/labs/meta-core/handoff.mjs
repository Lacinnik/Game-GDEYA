import { OBSERVATION_STATES } from "../voidocr/observation.mjs?v=voidocr-observation-20260922-r1";
// Local workflow transport, NOT authentication, delegation or an access token.
export const HANDOFF_KEY = "architectonica.voidocr.meta-handoff.v1";
export const RECEIPTS_KEY = "architectonica.meta-receipts.v1";
export const SOURCE_KEY = "architectonica.voidocr.traces.v1";
export const TTL_MS = 30 * 60 * 1000; // Technical draft freshness policy, not authorial canon.
const SCHEMA = "architectonica.local-handoff/1.0.0";
const pairs = { density_shift:"resource", impulse_break:"power", distance_collapse:"relations", auto_form:"result" };
const text = (value, max = 12000) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const fail = reason => ({ ok:false, reason });

export function traceSnapshot(trace) {
  if (!trace || trace.schema !== "architectonica.voidocr-trace/1.1.0" || trace.laboratory !== "gdeya"
    || !text(trace.id,200) || !text(trace.trigger) || trace.trigger.trim().split(/\s+/u).length < 3
    || !OBSERVATION_STATES.includes(trace.pre_state) || !OBSERVATION_STATES.includes(trace.post_state)
    || !Object.hasOwn(pairs,trace.delta_type) || pairs[trace.delta_type] !== trace.quadrant
    || !Number.isInteger(trace.stability) || trace.stability < 0 || trace.stability > 3
    || trace.decision !== (trace.stability >= 2 ? "ALLOW" : "DENY")
    || typeof trace.ts !== "string" || !Number.isFinite(Date.parse(trace.ts))) return null;
  return Object.fromEntries(["schema","id","ts","laboratory","trigger","pre_state","post_state","delta_type","quadrant","stability","decision"].map(key=>[key,trace[key]]));
}

export function createHandoff(trace, { now = Date.now(), uuid = () => crypto.randomUUID() } = {}) {
  const snapshot = traceSnapshot(trace);
  if (!snapshot || snapshot.decision !== "ALLOW") throw new Error("SOURCE_NOT_ALLOWED");
  const start = Date.parse(snapshot.ts);
  if (!Number.isFinite(now) || start > now || now >= start + TTL_MS) throw new Error("SOURCE_EXPIRED_OR_FUTURE");
  return { schema:SCHEMA, id:uuid(), producer:"voidocr", recipient:"meta-core-v2", purpose:"evaluate-local-draft",
    issuedAt:new Date(now).toISOString(), expiresAt:new Date(start+TTL_MS).toISOString(), trace:snapshot };
}

function receipts(storage) {
  const raw = storage.getItem(RECEIPTS_KEY);
  const values = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(values) || values.some(item => !item || !text(item.handoffId,200) || item.schema !== "architectonica.meta-receipt/1.0.0")) throw new Error("INVALID_RECEIPTS");
  return values;
}

export function readReceipts(storage) {
  try { return {ok:true,entries:receipts(storage)}; }
  catch { return fail("STORAGE_UNAVAILABLE_OR_CORRUPT"); }
}

export function inspectHandoff(envelope, sourceStorage, now = Date.now()) {
  try {
    if (!envelope || envelope.schema !== SCHEMA || !text(envelope.id,200)
      || envelope.producer !== "voidocr" || envelope.recipient !== "meta-core-v2"
      || envelope.purpose !== "evaluate-local-draft") return fail("INVALID_HANDOFF");
    const trace = traceSnapshot(envelope.trace);
    if (!trace || trace.decision !== "ALLOW") return fail("SOURCE_NOT_ALLOWED");
    const start=Date.parse(trace.ts), issued=Date.parse(envelope.issuedAt), expires=Date.parse(envelope.expiresAt);
    if (!Number.isFinite(now) || !Number.isFinite(issued) || !Number.isFinite(expires)
      || issued < start || issued > now || expires !== start+TTL_MS || now >= expires) return fail("EXPIRED_OR_FUTURE");
    const journal = JSON.parse(sourceStorage.getItem(SOURCE_KEY) ?? "null");
    if (!Array.isArray(journal)) return fail("SOURCE_JOURNAL_UNAVAILABLE");
    const original = journal.find(item => item?.id === trace.id);
    if (JSON.stringify(traceSnapshot(original)) !== JSON.stringify(trace)) return fail("SOURCE_MISMATCH");
    if (receipts(sourceStorage).some(item=>item.handoffId === envelope.id)) return fail("ALREADY_CONSUMED");
    return { ok:true, envelope:{...envelope,trace}, evidence:"local-journal-match-only" };
  } catch { return fail("STORAGE_UNAVAILABLE_OR_CORRUPT"); }
}

export function readHandoff(sessionStorage, sourceStorage, now = Date.now()) {
  try {
    const raw=sessionStorage.getItem(HANDOFF_KEY);
    return raw === null ? fail("NO_HANDOFF") : inspectHandoff(JSON.parse(raw),sourceStorage,now);
  } catch { return fail("STORAGE_UNAVAILABLE_OR_CORRUPT"); }
}

export function sendHandoff(sessionStorage, sourceStorage, trace, environment) {
  try {
    const envelope=createHandoff(trace,environment);
    const check=inspectHandoff(envelope,sourceStorage,environment?.now);
    if (!check.ok) return check;
    const encoded=JSON.stringify(envelope);
    sessionStorage.setItem(HANDOFF_KEY,encoded);
    if (sessionStorage.getItem(HANDOFF_KEY) !== encoded) return fail("WRITE_NOT_VERIFIED");
    return { ok:true, envelope };
  } catch { return fail("HANDOFF_NOT_SAVED"); }
}

// Single-key receipt write records the decision and consumption together.
// The local client can edit this storage: it is not a cross-device replay defence.
export function saveReceipt(sessionStorage, sourceStorage, envelope, report, now = Date.now()) {
  const current=readHandoff(sessionStorage,sourceStorage,now);
  if (!current.ok) return current;
  if (JSON.stringify(current.envelope) !== JSON.stringify(envelope)) return fail("HANDOFF_CHANGED");
  if (!report || report.handoffId !== envelope.id || !["PASS_INTERNAL","HOLD_PROTOCOL"].includes(report.status)) return fail("REPORT_MISMATCH");
  try {
    const previous=receipts(sourceStorage);
    if (previous.length >= 500) return fail("RECEIPT_JOURNAL_FULL");
    const receipt={schema:"architectonica.meta-receipt/1.0.0",handoffId:envelope.id,savedAt:new Date(now).toISOString(),report};
    const encoded=JSON.stringify([...previous,receipt]);
    sourceStorage.setItem(RECEIPTS_KEY,encoded);
    if (sourceStorage.getItem(RECEIPTS_KEY) !== encoded) return fail("WRITE_NOT_VERIFIED");
    // Receipt is authoritative even when clearing the session key is denied.
    try { sessionStorage.removeItem(HANDOFF_KEY); } catch { /* consumed receipt blocks reuse */ }
    return {ok:true,receipt};
  } catch { return fail("STORAGE_UNAVAILABLE_OR_CORRUPT"); }
}
