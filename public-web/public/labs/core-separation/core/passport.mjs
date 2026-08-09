import { CONTEXTS } from "../catalog.mjs";
import { interceptionOf, scoreContour } from "./scorer.mjs";

const clean = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");

export function createPassport({ contextId, episode, answers, action, criterion, now = new Date().toISOString() }) {
  const context = CONTEXTS.find((item) => item.id === contextId);
  if (!context || clean(episode).split(" ").filter(Boolean).length < 5) throw new Error("EPISODE_INVALID");
  const scored = scoreContour(answers); const interception = interceptionOf(scored);
  return {
    schema: "gdeya.sep7x7.passport.v1", id: `SEP-${now.replace(/[^0-9]/gu, "").slice(0, 14)}-${contextId}`, createdAt: now,
    object: clean(episode), subjectTrace: clean(action), reflectedImage: "Карта семи состояний выбранного жизненного контура",
    targetRelation: "Сохранить источник действия в Ядре при влиянии значимого Другого", context: { id: context.id, name: context.name },
    answers: scored.map((item) => ({ nodeId: `SEP(${item.lawId},${contextId})`, ...item, response: answers[item.lawId] })),
    interception, oplus: { action: clean(action), criterion: clean(criterion), status: "CONDUCT" }, q: null, evidenceStatus: "hypothesis", return: null,
  };
}

export function integrateReturn(passport, observation, now = new Date().toISOString()) {
  if (passport?.schema !== "gdeya.sep7x7.passport.v1") throw new Error("PASSPORT_INVALID");
  if (typeof observation.actionPreserved !== "boolean") throw new Error("RETURN_INCOMPLETE");
  return { ...passport, q: observation.actionPreserved ? 1 : 0, evidenceStatus: "observed", return: { observedAt: now, otherReacted: Boolean(observation.otherReacted), actionPreserved: observation.actionPreserved, relationPreserved: observation.relationPreserved == null ? null : Boolean(observation.relationPreserved), newForm: clean(observation.newForm), tension: clean(observation.tension) } };
}
