import { LAWS, RESPONSES, STATES } from "../catalog.mjs";

export function responseState(code) { return RESPONSES.find((response) => response.code === code)?.state ?? null; }

export function scoreContour(answers) {
  const scored = LAWS.map((law) => ({ lawId: law.id, law: law.name, state: responseState(answers[law.id]) }));
  if (scored.some((item) => item.state == null)) throw new Error("ANSWERS_INCOMPLETE");
  return scored.map((item) => ({ ...item, stateName: STATES[item.state].name }));
}

export function interceptionOf(scored) { return [...scored].sort((a, b) => a.state - b.state || a.lawId.localeCompare(b.lawId))[0] ?? null; }
