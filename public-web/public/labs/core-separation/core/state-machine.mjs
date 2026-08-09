export const PHASES = ["UNSEEN", "EPISODE", "DISTINGUISH", "STATE_DETECTED", "OPLUS_CANDIDATE", "GATE", "REFORMULATE", "CONDUCT", "RETURN", "INTEGRATE", "STATE_UPDATE"];

const transitions = {
  UNSEEN: ["EPISODE"], EPISODE: ["DISTINGUISH"], DISTINGUISH: ["STATE_DETECTED"],
  STATE_DETECTED: ["OPLUS_CANDIDATE"], OPLUS_CANDIDATE: ["GATE"], GATE: ["REFORMULATE", "CONDUCT"],
  REFORMULATE: ["OPLUS_CANDIDATE"], CONDUCT: ["RETURN"], RETURN: ["INTEGRATE"], INTEGRATE: ["STATE_UPDATE"], STATE_UPDATE: ["EPISODE"],
};

export function transition(current, next) {
  if (!PHASES.includes(current) || !transitions[current]?.includes(next)) throw new Error(`INVALID_TRANSITION:${current}:${next}`);
  return next;
}

export function canTransition(current, next) { return transitions[current]?.includes(next) ?? false; }
