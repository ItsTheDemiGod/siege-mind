import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HINTS, HINT_GEOMETRY } from '../src/ui/tutorialText.js';

test('there are exactly four hints with unique ids and texts of at most 140 characters', () => {
  assert.equal(HINTS.length, 4);
  assert.deepEqual(HINTS.map((h) => h.id), ['build', 'start', 'upgrade', 'director']);
  assert.equal(new Set(HINTS.map((h) => h.id)).size, 4);
  for (const h of HINTS) assert.ok(h.text.length > 20 && h.text.length <= 140, `${h.id}: ${h.text.length}`);
  assert.ok(Object.isFrozen(HINTS) && Object.isFrozen(HINTS[0]) && Object.isFrozen(HINT_GEOMETRY));
});

test('the geometry constants are the specified ones', () => {
  assert.deepEqual({ ...HINT_GEOMETRY }, { width: 300, margin: 16, maxHeight: 96, topOffset: 8, left: 16, autoHideSeconds: 14, delaySeconds: 0.8 });
});

test('the hints name the real keys', () => {
  const all = HINTS.map((h) => h.text).join(' ');
  for (const k of ['Enter', 'Space', 'Delete', ' I ']) assert.ok(all.includes(k), k);
});
