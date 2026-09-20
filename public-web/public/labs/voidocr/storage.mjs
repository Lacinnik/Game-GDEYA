export const STORAGE_KEY = "architectonica.voidocr.traces.v1";

export function persistTrace(storage, trace) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const previous = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(previous)) return { ok: false, reason: "INVALID_JOURNAL" };
    const encoded = JSON.stringify([trace, ...previous].slice(0, 100));
    storage.setItem(STORAGE_KEY, encoded);
    if (storage.getItem(STORAGE_KEY) !== encoded) return { ok: false, reason: "WRITE_NOT_VERIFIED" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "STORAGE_UNAVAILABLE_OR_CORRUPT" };
  }
}
