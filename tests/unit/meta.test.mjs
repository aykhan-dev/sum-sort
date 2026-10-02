// Unit tests for the meta game: combos, daily puzzle, streaks, sharing. Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comboWord, comboStep, COMBO_WORDS } from '../../src/meta.mjs';

test('combo: clean moves keep the chain, each seal grows it, anything else ends it', () => {
  let c = 0;
  c = comboStep(c, { clean: true, seals: false }); assert.equal(c, 0);
  c = comboStep(c, { clean: true, seals: true }); assert.equal(c, 1);
  c = comboStep(c, { clean: true, seals: false }); assert.equal(c, 1);
  c = comboStep(c, { clean: true, seals: true }); assert.equal(c, 2);
  c = comboStep(c, { clean: false, seals: true }); assert.equal(c, 0);   // a jar-to-jar seal starts over
});

test('combo words: silent for the first seal, then climbing, capped at the top word', () => {
  assert.equal(comboWord(0), ''); assert.equal(comboWord(1), '');
  assert.equal(comboWord(2), 'Sweet!');
  assert.equal(comboWord(6), 'Sugar rush!');
  assert.equal(comboWord(40), 'Sugar rush!');
  assert.equal(new Set(COMBO_WORDS.slice(2)).size, COMBO_WORDS.length - 2, 'every rung has its own word');
});
