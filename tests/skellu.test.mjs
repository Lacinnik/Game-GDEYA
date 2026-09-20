import test from 'node:test';
import assert from 'node:assert/strict';
import { createDictationGuard } from '../app/dictation-guard.mjs';
import { readFileSync } from 'node:fs';

test('one recognition attempt accepts exactly one nonempty result', () => {
  const guard=createDictationGuard(),token=guard.begin('setup:intent:');
  assert.equal(guard.accept(token,'setup:intent:','  '),null);
  assert.equal(guard.accept(token,'setup:intent:',' Моя мысль '),'Моя мысль');
  assert.equal(guard.accept(token,'setup:intent:','повтор'),null);
});
test('changed field or game step rejects late speech', () => {
  const guard=createDictationGuard(),token=guard.begin('game:1:state:');
  for(const context of ['game:2:state:','game:1:reflection:','game:1:state:ручной текст']) assert.equal(guard.accept(token,context,'поздний ответ'),null);
});
test('cancelled and replaced attempts cannot write results', () => {
  const guard=createDictationGuard(),old=guard.begin('intent');guard.cancel();
  assert.equal(guard.accept(old,'intent','старый'),null);
  const current=guard.begin('intent');
  assert.equal(guard.accept(old,'intent','старый'),null);
  assert.equal(guard.accept(current,'intent','новый'),'новый');
});
test('absent, forged and non-text recognition results are ignored', () => {
  const guard=createDictationGuard(),token=guard.begin('intent');
  assert.equal(guard.accept(null,'intent','text'),null);
  assert.equal(guard.accept({context:'intent'},'intent','text'),null);
  assert.equal(guard.accept(token,'intent',{}),null);
});
test('UI wires cancellation, hidden-tab stop and truthful keyboard fallback', () => {
  const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
  assert.match(page,/dictationGuardRef.current.accept/);
  assert.match(page,/document.hidden/);
  assert.match(page,/onClick=\{closeSkellu\}/);
  assert.match(page,/Поле выбрано/);
  assert.doesNotMatch(page,/Открыта системная диктовка/);
});
