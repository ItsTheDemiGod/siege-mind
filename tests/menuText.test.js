import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, LENGTH_OPTIONS, ENEMY_BLURBS, HOW_TO_STEPS, MENU_LIMITS } from '../src/data/menuText.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { config } from '../src/data/config.js';

test('blurbs exist for exactly the five enemy ids and fit their limit', () => {
  assert.deepEqual(Object.keys(ENEMY_BLURBS).sort(), [...ENEMY_ORDER].sort());
  for (const [id, text] of Object.entries(ENEMY_BLURBS)) {
    assert.ok(text.length > 0 && text.length <= MENU_LIMITS.blurb, `${id}: ${text.length}`);
  }
});

test('every string is non-empty and within its length limit', () => {
  assert.ok(HOW_TO_STEPS.length >= 6);
  for (const s of HOW_TO_STEPS) assert.ok(s.length > 0 && s.length <= MENU_LIMITS.step, s);
  for (const m of MODES) assert.ok(m.label.length > 0 && m.label.length <= MENU_LIMITS.label && m.blurb.length > 0 && m.blurb.length <= MENU_LIMITS.blurb);
  for (const l of LENGTH_OPTIONS) assert.ok(l.label.length > 0 && l.blurb.length > 0 && l.blurb.length <= MENU_LIMITS.blurb);
});

test('the how-to steps cover the controls the player needs', () => {
  const text = HOW_TO_STEPS.join(' ');
  for (const needle of ['A S D F G', 'Enter', 'Delete', 'Esc', '1 2 3', 'Space', 'Gold']) assert.ok(text.includes(needle), needle);
});

test('adaptive is unavailable and static is available; everything is frozen', () => {
  assert.equal(MODES.find((m) => m.id === 'static').available, true);
  assert.equal(MODES.find((m) => m.id === 'adaptive').available, false);
  assert.ok(Object.isFrozen(MODES) && Object.isFrozen(LENGTH_OPTIONS) && Object.isFrozen(ENEMY_BLURBS) && Object.isFrozen(HOW_TO_STEPS));
});

test('length options are a subset of the allowed totals and include the quick total', () => {
  for (const l of LENGTH_OPTIONS) assert.ok(config.game.allowedTotals.includes(l.waves));
  assert.ok(LENGTH_OPTIONS.some((l) => l.waves === config.game.quickTotal));
  assert.ok(LENGTH_OPTIONS.some((l) => l.waves === config.game.totalWaves));
});
