const clean = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");
const words = (value) => clean(value).split(" ").filter(Boolean);

export function validateOplus({ action, criterion, owned, consentFree, languageConfirmed }) {
  const errors = [];
  const count = words(action).length;
  if (count < 4) errors.push("ACTION_INCOMPLETE");
  if (count > 28 || /\b(и ещё|потом|затем)\b/iu.test(clean(action))) errors.push("ACTION_NOT_SINGLE");
  if (words(criterion).length < 4) errors.push("CRITERION_INCOMPLETE");
  if (!owned) errors.push("ACTION_NOT_OWNED");
  if (!consentFree) errors.push("ACTION_REQUIRES_CONSENT");
  if (!languageConfirmed) errors.push("LANGUAGE_UNCONFIRMED");
  return errors;
}

export function gateVerdict(draft) { return validateOplus(draft).length ? "REFORMULATE" : "CONDUCT"; }
