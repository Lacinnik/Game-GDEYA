// A recognition attempt may fill only its original, still unchanged field, once.
export function createDictationGuard() {
  let active = null;
  return {
    begin(context) { active = { context }; return active; },
    cancel() { active = null; },
    accept(token, context, transcript) {
      if (!token || token !== active || token.context !== context) return null;
      if (typeof transcript !== 'string' || !transcript.trim()) return null;
      active = null;
      return transcript.trim();
    },
  };
}
