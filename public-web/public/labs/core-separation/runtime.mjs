import { CONTEXTS, NODES, RESPONSES } from "./catalog.mjs";
export { createPassport, integrateReturn } from "./core/passport.mjs";
export { detectInvariant } from "./core/invariant-engine.mjs";
export { validateOplus } from "./core/oplus-gate.mjs";
export { STORAGE_KEY, safeJournal } from "./core/storage.mjs";
export { compileSeparationLanguage, languageFromPassport } from "./core/tzar-language.mjs";

const clean = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");
const words = (value) => clean(value).split(" ").filter(Boolean);

export function nodeFor(lawId, contextId) {
  return NODES.find((node) => node.lawId === lawId && node.contextId === contextId) ?? null;
}

export function responseFor(code) {
  return RESPONSES.find((response) => response.code === code) ?? null;
}

export function validateEpisode({ contextId, episode }) {
  const errors = [];
  if (!CONTEXTS.some((context) => context.id === contextId)) errors.push("CONTEXT_REQUIRED");
  if (words(episode).length < 5) errors.push("EPISODE_INCOMPLETE");
  return errors;
}
