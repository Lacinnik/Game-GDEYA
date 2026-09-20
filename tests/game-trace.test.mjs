import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameTrace } from '../app/game-trace.mjs';

const fixture = () => ({ intent: 'Сохранить исходный замысел', invariant: 'Не подменять объект', mode: 'quick', source: ['I'], metrics: { alpha: 56, iy: 58, cm: 52, q: 54, t: 57 }, gradient: 8, coherence: 55, log: [{ quality: 0.7, deltas: { alpha: 3, iy: 2, cm: 1, q: 4, t: 5 } }] });
test('game trace separates simulated score from unobserved Q', () => {
  const data = createGameTrace(fixture());
  assert.equal(data.schema, 'gdeya.subject-core.game-trace.v2');
  assert.equal(data.q, null);
  assert.equal(data.returnObservation, null);
  assert.equal(data.evidenceStatus, 'simulation');
  assert.equal(data.simulation.metrics.qSim, 54);
  assert.equal(data.simulation.log[0].deltas.qSim, 4);
  assert.equal('q' in data.simulation.metrics, false);
  assert.equal(data.compatibility.sepPassport, false);
  assert.equal(data.compatibility.externalAuthorization, false);
});
test('even maximum game scores cannot create an observed return', () => {
  const input = fixture(); input.metrics.q = 100; input.coherence = 100;
  assert.equal(createGameTrace(input).q, null);
});
test('trace conversion preserves author inputs and does not mutate game state', () => {
  const input = fixture(), before = JSON.stringify(input), output = createGameTrace(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(output.intent, input.intent);
  assert.equal(output.invariant, input.invariant);
  assert.deepEqual(JSON.parse(JSON.stringify(output)), output);
});
test('both metric panels label the game Q as simulated and export the bounded schema', () => {
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.equal((source.match(/label="Qsim"/g) || []).length, 2);
  assert.doesNotMatch(source, /<Metric label="Q"/);
  assert.match(source, /createGameTrace\(/);
  assert.match(source, /не психологическая диагностика/);
});
