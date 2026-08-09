import { LAWS } from "../catalog.mjs";

export function detectInvariant(passports) {
  const byLaw = new Map();
  for (const passport of passports) {
    const lawId = passport?.interception?.lawId; const contextId = passport?.context?.id;
    if (!lawId || !contextId) continue;
    if (!byLaw.has(lawId)) byLaw.set(lawId, new Set());
    byLaw.get(lawId).add(contextId);
  }
  const match = [...byLaw.entries()].filter(([, contexts]) => contexts.size >= 3).sort((a, b) => b[1].size - a[1].size)[0];
  if (!match) return null;
  const law = LAWS.find((item) => item.id === match[0]);
  return { lawId: law.id, law: law.name, contexts: [...match[1]], status: "hypothesis" };
}
