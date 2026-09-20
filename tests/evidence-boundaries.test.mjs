import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTzarLanguage, compileProductLanguage } from '../public-web/public/labs/tzar-language-001.mjs';
import { persistTrace, STORAGE_KEY } from '../public-web/public/labs/voidocr/storage.mjs';
import { readFile } from 'node:fs/promises';

test('missing coordinates remain null for every product profile', async () => {
  const { profiles } = JSON.parse(await readFile(new URL('../public-web/public/platform/tzar-language.profiles.json', import.meta.url)));
  for (const profile of profiles) {
    const result = compileProductLanguage(profile, { O: 'Письмо с новой задачей' });
    assert.equal(result.status, 'HOLD-DATA', profile.id);
    assert.equal(result.tensor.S, null);
    assert.equal(result.tensor.I, null);
    assert.equal(result.tensor.Q, null);
    assert.equal(result.tensor.evidence.S, 'unknown');
    assert.doesNotMatch(result.layers.publicStatement, /Моё действительное движение|Наблюдаемый след исполнения/);
  }
});
test('generic compiler does not manufacture a goal or context', () => {
  const result = compileTzarLanguage({object: 'Документ', coreNeed: 'Намерение'});
  assert.equal(result.tensor.R_g, null);
  assert.equal(result.tensor.C, null);
  assert.equal(result.tensor.S, null);
  assert.equal(compileTzarLanguage({}).status, 'HOLD-INPUT');
});
test('binary Q cannot be manufactured by numeric coercion', () => {
  for (const q of ['', ' ', false, true, [], '0', '1', NaN, 0.5]) {
    assert.throws(() => compileTzarLanguage({ observedQ: q }), /Q_MUST_BE_OBSERVED_BINARY/);
  }
  for (const q of [null, 0, 1]) assert.equal(compileTzarLanguage({observedQ:q}).tensor.Q, q);
});
function memory(raw = null) {
  return { getItem: () => raw, setItem: (key, value) => { assert.equal(key, STORAGE_KEY); raw = value; } };
}
test('VoidOCR preserves existing journal and verifies a saved trace', () => {
  const storage = memory('[{"id":"older"}]');
  assert.equal(persistTrace(storage, {id:'new'}).ok, true);
  assert.deepEqual(JSON.parse(storage.getItem()), [{id:'new'}, {id:'older'}]);
});
test('VoidOCR does not overwrite corrupted journals', () => {
  for (const raw of ['{broken', '{}', 'null']) {
    const storage = memory(raw);
    assert.equal(persistTrace(storage, {id:'new'}).ok, false);
    assert.equal(storage.getItem(), raw);
  }
});
test('VoidOCR closes on denied reads, denied writes, or a silent failed write', () => {
  for (const storage of [
    {getItem(){throw new Error('denied');}},
    {getItem(){return null;},setItem(){throw new Error('quota');}},
    {getItem(){return null;},setItem(){}},
  ]) assert.equal(persistTrace(storage, {id:'new'}).ok, false);
});
