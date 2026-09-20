import { CONTEXTS } from "../catalog.mjs";
import { interceptionOf, scoreContour } from "./scorer.mjs";
import { compileSeparationLanguage, languageFromPassport, TARGET_RELATION } from "./tzar-language.mjs";

const clean = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");

export function createPassport({ contextId, episode, answers, action, criterion, languageConfirmed = false, now = new Date().toISOString() }) {
  const context = CONTEXTS.find((item) => item.id === contextId);
  if (!context || clean(episode).split(" ").filter(Boolean).length < 5) throw new Error("EPISODE_INVALID");
  const scored = scoreContour(answers); const interception = interceptionOf(scored);
  const passport = {
    schema: "gdeya.sep7x7.passport.v1", id: `SEP-${globalThis.crypto.randomUUID()}-${contextId}`, createdAt: now,
    object: clean(episode), subjectTrace: clean(action), reflectedImage: "Карта семи состояний выбранного жизненного контура",
    targetRelation: TARGET_RELATION, context: { id: context.id, name: context.name },
    answers: scored.map((item) => ({ nodeId: `SEP(${item.lawId},${contextId})`, ...item, response: answers[item.lawId] })),
    interception, oplus: { action: clean(action), criterion: clean(criterion), status: "CONDUCT" }, q: null, evidenceStatus: "hypothesis", return: null,
  };
  passport.language = compileSeparationLanguage({ context: passport.context, episode: passport.object, interception, action: passport.oplus.action, criterion: passport.oplus.criterion, subjectConfirmed: languageConfirmed });
  return passport;
}

export function integrateReturn(passport, observation, now = new Date().toISOString()) {
  if (passport?.schema !== "gdeya.sep7x7.passport.v1") throw new Error("PASSPORT_INVALID");
  if (typeof observation.actionPreserved !== "boolean") throw new Error("RETURN_INCOMPLETE");
  const integrated = { ...passport, q: observation.actionPreserved ? 1 : 0, evidenceStatus: "observed", return: { observedAt: now, otherReacted: Boolean(observation.otherReacted), actionPreserved: observation.actionPreserved, relationPreserved: observation.relationPreserved == null ? null : Boolean(observation.relationPreserved), newForm: clean(observation.newForm), tension: clean(observation.tension) } };
  integrated.language = languageFromPassport(integrated);
  return integrated;
}
