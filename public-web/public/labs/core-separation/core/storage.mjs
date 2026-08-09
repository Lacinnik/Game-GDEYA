export const STORAGE_KEY = "gdeya.sep7x7.passports.v1";
export function safeJournal(value) { return Array.isArray(value) ? value.filter((item) => item?.schema === "gdeya.sep7x7.passport.v1") : []; }
export function readJournal(storage = localStorage) { try { return safeJournal(JSON.parse(storage.getItem(STORAGE_KEY) || "[]")); } catch { return []; } }
export function writeJournal(journal, storage = localStorage) { storage.setItem(STORAGE_KEY, JSON.stringify(safeJournal(journal).slice(0, 70))); }
export function upsertPassport(passport, storage = localStorage) { writeJournal([passport, ...readJournal(storage).filter((item) => item.id !== passport.id)], storage); }
export function destroyJournal(storage = localStorage) { storage.removeItem(STORAGE_KEY); }
