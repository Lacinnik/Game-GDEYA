import { metaCanActivate } from "./vendor/meta_core_v2.js";
import { compileTzarLanguage } from "../tzar-language-001.mjs";
import { inspectHandoff } from "./handoff.mjs?v=meta-metrics-20260922-r1";

export const PLATES = Object.freeze({resource:"РЕСУРС",power:"ВЛАСТЬ",relations:"ОТНОШЕНИЯ",result:"РЕЗУЛЬТАТ"});
const validText = value => typeof value === "string" && value.trim().length >= 3 && value.length <= 12000;
const estimate = value => [0, 0.25, 0.5, 0.75, 1].includes(value);

export function evaluateTransition(envelope, draft, sourceStorage, now = Date.now()) {
  const source=inspectHandoff(envelope,sourceStorage,now);
  const checks=[];
  const finish=(status,gate,reason,runtime=null) => ({
    schema:"architectonica.meta-evaluation/0.1.0-candidate",status,gate,reason,
    handoffId:envelope?.id ?? null,sourceTraceId:source.ok?source.envelope.trace.id:null,
    object:source.ok?source.envelope.trace.trigger:null,
    checkedAt:Number.isFinite(now)?new Date(now).toISOString():null,checks,
    input:structuredClone(draft ?? {}),runtime,
    observedQ:validText(draft?.observation) && [0,1].includes(draft?.observedQ)?draft.observedQ:null,
    evidence:{source:"unsigned-local-declaration",metrics:"operator-declared",return:"user-reported-not-independently-verified"},
    execution:{performed:false,scope:"local-draft-only"},
    boundary:"PASS_INTERNAL is a local technical check, not authority, consent, diagnosis or empirical efficacy.",
  });
  const hold=(gate,reason)=>{checks.push({gate,pass:false,reason});return finish("HOLD_PROTOCOL",gate,reason);};
  if (!source.ok) return hold("handoff",source.reason);
  checks.push({gate:"handoff",pass:true,reason:"local-journal-match-only"});
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return hold("input","DRAFT_REQUIRED");
  // No source ALLOW bypasses STOP or the receiver's own checks.
  if (draft.stop !== false || !["low","medium","high","critical"].includes(draft.risk) || draft.risk === "critical") return hold("neg","STOP_OR_UNKNOWN_CRITICAL_RISK");
  checks.push({gate:"neg",pass:true,reason:"explicit local risk declaration"});
  if (!["personal","org","public","unknown"].includes(draft.context) || draft.context === "unknown") return hold("gov/context","CONTEXT_REQUIRED");
  if (!["draft","local"].includes(draft.impact)) return hold("gov/impact","ONLY_LOCAL_REVERSIBLE_DRAFTS");
  if (!validText(draft.owner) || draft.confirmed !== true) return hold("gov/confirmation","OWNER_AND_RECEIVER_CONFIRMATION_REQUIRED");
  if (draft.context === "org" && draft.responsible !== true) return hold("gov/responsibility","RESPONSIBLE_PARTY_REQUIRED");
  checks.push({gate:"gov",pass:true,reason:"declaration only; no delegated authority"});
  if (draft.context === "public") return hold("meta/context","PUBLIC_DEFAULT_DENY");
  if (!["love","measure","materialize"].includes(draft.phase)) return hold("meta/phase","PHASE_REQUIRED");
  if (!validText(draft.action) || !validText(draft.invariant)) return hold("meta/task","ACTION_AND_INVARIANT_REQUIRED");
  checks.push({gate:"meta",pass:true,reason:"explicit phase and local task"});
  if (![0,1].includes(draft.observedQ) || !validText(draft.observation)) return hold("demons/evidence","OBSERVED_RETURN_REQUIRED");
  const keys=["alpha","IY","Cm","T"];
  if (keys.some(key=>!estimate(draft.metrics?.[key])) || !validText(draft.metricBasis)) return hold("demons/metrics","EXPLICIT_METRICS_AND_BASIS_REQUIRED");
  // The original Q thresholds consume only a separately reported binary return.
  // VoidOCR stability is NEVER mapped into Q or other metrics.
  const runtime=metaCanActivate({
    plate:PLATES[source.envelope.trace.quadrant],metrics:{...draft.metrics,Q:draft.observedQ},
    phase:draft.phase,context:draft.context,impact:draft.impact,owner:draft.owner,
    explicit:{responsible:draft.responsible === true},risk:draft.risk,ts:new Date(now).toISOString(),
  });
  checks.push({gate:runtime.gate,pass:runtime.allow,reason:runtime.reason});
  const report=finish(runtime.allow?"PASS_INTERNAL":"HOLD_PROTOCOL",runtime.gate,runtime.reason || "LOCAL_CHECK_PASSED",runtime);
  report.language=compileTzarLanguage({
    object:source.envelope.trace.trigger,subjectTrace:draft.owner,innerImage:draft.action,
    coreNeed:draft.action,supra:draft.invariant,nextExperiment:draft.action,riemann:draft.observation,
    observedQ:draft.observedQ,
  },{profile:"meta-core-v2",voice:"system",targetRelation:draft.action,context:draft.context,subjectConfirmed:true});
  return report;
}
