import { CONTEXTS, LAWS } from '../catalog.mjs';
import { scoreContour, interceptionOf } from './scorer.mjs';
export const STORAGE_KEY = 'gdeya.sep7x7.passports.v1';
const text = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 20000;
const date = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
const fail = () => { throw new Error('Некорректный паспорт SEP. Данные не изменены.'); };
export function validatePassport(p) {
  if (!p || p.schema !== 'gdeya.sep7x7.passport.v1' || !text(p.id) || !date(p.createdAt)) fail();
  const context = CONTEXTS.find(c => c.id === p.context?.id);
  if (!context || p.context.name !== context.name) fail();
  for (const key of ['object', 'subjectTrace', 'reflectedImage', 'targetRelation']) if (!text(p[key])) fail();
  if (!text(p.oplus?.action) || !text(p.oplus?.criterion) || p.oplus.status !== 'CONDUCT') fail();
  if (!Array.isArray(p.answers) || p.answers.length !== LAWS.length) fail();
  if (new Set(p.answers.map(a => a?.lawId)).size !== LAWS.length) fail();
  let scored;
  try { scored = scoreContour(Object.fromEntries(p.answers.map(a => [a?.lawId, a?.response]))); } catch { fail(); }
  for (const expected of scored) {
    const answer = p.answers.find(a => a?.lawId === expected.lawId);
    if (!answer || answer.nodeId !== `SEP(${expected.lawId},${context.id})`) fail();
    for (const key of ['law', 'state', 'stateName', 'stateDescription']) if (answer[key] !== expected[key]) fail();
  }
  const interception = interceptionOf(scored);
  for (const key of ['lawId', 'law', 'state', 'stateName', 'stateDescription']) if (p.interception?.[key] !== interception[key]) fail();
  if (p.q === null) {
    if (p.return !== null || p.evidenceStatus !== 'hypothesis') fail();
  } else {
    const r = p.return;
    if ((p.q !== 0 && p.q !== 1) || !r || !date(r.observedAt) || typeof r.actionPreserved !== 'boolean') fail();
    if (p.q !== (r.actionPreserved ? 1 : 0) || p.evidenceStatus !== 'observed') fail();
    if (typeof r.otherReacted !== 'boolean' || (r.relationPreserved !== null && typeof r.relationPreserved !== 'boolean')) fail();
    if (typeof r.newForm !== 'string' || typeof r.tension !== 'string') fail();
  }
  return p;
}
export function safeJournal(value) {
  if (!Array.isArray(value) || value.length > 70) throw new Error('Журнал должен содержать не более 70 паспортов.');
  value.forEach(validatePassport);
  if (new Set(value.map(p => p.id)).size !== value.length) throw new Error('Повторяющиеся ID паспортов.');
  return value;
}
export function readJournal(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  return safeJournal(raw === null ? [] : JSON.parse(raw));
}
export function writeJournal(journal, storage = localStorage) {
  const encoded = JSON.stringify(safeJournal(journal));
  readJournal(storage);
  storage.setItem(STORAGE_KEY, encoded);
  if (storage.getItem(STORAGE_KEY) !== encoded) throw new Error('Сохранение журнала не подтверждено.');
}
export function upsertPassport(passport, storage = localStorage, expectedPassport) {
  validatePassport(passport);
  const journal = readJournal(storage);
  if (expectedPassport !== undefined) {
    const current = journal.find(item => item.id === passport.id);
    if (expectedPassport?.id !== passport.id || !current || JSON.stringify(current) !== JSON.stringify(expectedPassport)) {
      throw new Error('Паспорт изменён или удалён после открытия. Скопируйте введённый возврат, обновите страницу и откройте актуальную карту.');
    }
  }
  writeJournal([passport, ...journal.filter(item => item.id !== passport.id)], storage);
}
export function mergeJournal(incoming, storage = localStorage) {
  safeJournal(incoming);
  const byId = new Map(readJournal(storage).map(p => [p.id, p]));
  for (const passport of incoming) {
    if (byId.has(passport.id) && JSON.stringify(byId.get(passport.id)) !== JSON.stringify(passport)) throw new Error('Конфликт ID: импорт не заменяет существующий паспорт.');
    byId.set(passport.id, passport);
  }
  const merged = [...byId.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  writeJournal(merged, storage);
  return merged;
}
export function destroyJournal(storage = localStorage) {
  storage.removeItem(STORAGE_KEY);
  if (storage.getItem(STORAGE_KEY) !== null) throw new Error('Удаление журнала не подтверждено.');
}
