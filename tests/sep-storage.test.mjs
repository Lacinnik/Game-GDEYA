import test from 'node:test';
import assert from 'node:assert/strict';
import { LAWS, RESPONSES, CONTEXTS } from '../public-web/public/labs/core-separation/catalog.mjs';
import { createPassport, integrateReturn } from '../public-web/public/labs/core-separation/core/passport.mjs';
import { STORAGE_KEY, safeJournal, readJournal, writeJournal, mergeJournal, upsertPassport } from '../public-web/public/labs/core-separation/core/storage.mjs';
const fixture = () => createPassport({ contextId: CONTEXTS[0].id, episode: 'Я сохраняю решение после ответа другого', answers: Object.fromEntries(LAWS.map(l => [l.id, RESPONSES[0].code])), action: 'Сообщить моё решение без доказательства', criterion: 'Решение сохраняется после ответа другого', languageConfirmed: true });
function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) }; }

test('valid current passports and self-reported returns round-trip', () => {
  const s = storage(), p = fixture();
  upsertPassport(p,s); assert.deepEqual(readJournal(s),[p]);
  const returned = integrateReturn(p,{actionPreserved:true,otherReacted:true,newForm:'Ответ получен',tension:''});
  upsertPassport(returned,s); assert.equal(readJournal(s)[0].q,1);
});
test('new passports cannot collide within the same second', () => { assert.notEqual(fixture().id, fixture().id); });
test('schema-only, missing answers and forged coordinates are rejected as whole packages', () => {
  for (const mutate of [p=>{delete p.answers;},p=>{p.answers[0].nodeId='SEP(L1,C99)';},p=>{p.answers[0].state=6;},p=>{p.interception.lawId='L99';},p=>{p.context.name='fake';}]) {
    const bad=fixture(); mutate(bad); assert.throws(()=>safeJournal([fixture(),bad]));
  }
  assert.throws(()=>safeJournal([{schema:'gdeya.sep7x7.passport.v1'}]));
});
test('Q cannot be coerced or invented without a matching return', () => {
  for(const q of [true,'1',1,0,undefined]) { const p=fixture();p.q=q;assert.throws(()=>safeJournal([p])); }
  const p=integrateReturn(fixture(),{actionPreserved:true});p.q=0;assert.throws(()=>safeJournal([p]));
});
test('damaged journals block writes and retain original bytes', () => {
  for(const raw of ['{bad','{}','[{"schema":"gdeya.sep7x7.passport.v1"}]']) {
    const s=storage();s.setItem(STORAGE_KEY,raw);
    assert.throws(()=>upsertPassport(fixture(),s));assert.equal(s.getItem(STORAGE_KEY),raw);
  }
});
test('denied reads, quota and silent writes cannot report success', () => {
  const p=fixture();
  assert.throws(()=>writeJournal([p],{getItem(){throw Error('denied');},setItem(){assert.fail('must not write');}}));
  assert.throws(()=>writeJournal([p],{getItem:()=>null,setItem(){throw Error('quota');}}));
  assert.throws(()=>writeJournal([p],{getItem:()=>null,setItem(){}}),/не подтверждено/);
});
test('import merges existing passports and duplicate import is idempotent', () => {
  const s=storage(),a=fixture(),b=fixture();upsertPassport(a,s);
  mergeJournal([b],s);mergeJournal([b],s);
  assert.equal(readJournal(s).length,2);assert.ok(readJournal(s).some(p=>p.id===a.id));
});
test('conflicting IDs reject all incoming data without partial merge', () => {
  const s=storage(),a=fixture();upsertPassport(a,s);const before=s.getItem(STORAGE_KEY);
  const conflict=structuredClone(a);conflict.object='Другая запись с тем же ID';
  assert.throws(()=>mergeJournal([fixture(),conflict],s),/Конфликт ID/);
  assert.equal(s.getItem(STORAGE_KEY),before);
});
test('capacity never silently drops the oldest passport', () => {
  const s=storage();writeJournal(Array.from({length:70},fixture),s);const before=s.getItem(STORAGE_KEY);
  assert.throws(()=>upsertPassport(fixture(),s));assert.equal(s.getItem(STORAGE_KEY),before);
});
