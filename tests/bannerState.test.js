import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeBanner, describePreview } from '../src/ui/bannerState.js';
import { compositionItems } from '../src/ui/compositionItems.js';
import { config } from '../src/data/config.js';

const started = (o = {}) => ({ wave: 7, name: null, fixed: false, hpMult: 3.67, composition: { fastRunner: 12, armoredGrunt: 5 }, ...o });

test('compositionItems: ENEMY_ORDER, display names, zero units skipped', () => {
  const items = compositionItems({ shieldedBruiser: 3, armoredGrunt: 5, swarmling: 0, fastRunner: 12 });
  assert.deepEqual(items, [
    { type: 'armoredGrunt', label: 'Armored Grunt', units: 5 },
    { type: 'fastRunner', label: 'Fast Runner', units: 12 },
    { type: 'shieldedBruiser', label: 'Shielded Bruiser', units: 3 },
  ]);
  assert.deepEqual(compositionItems({}), []);
});

test('describeBanner: normal wave', () => {
  const b = describeBanner(started(), 30);
  assert.deepEqual([b.kicker, b.title, b.fixed, b.final, b.hpLine, b.seconds], ['WAVE 7 / 30', 'Wave 7', false, false, 'Enemy HP ×3.7', config.ui.bannerSeconds]);
  assert.deepEqual(b.items.map((i) => [i.type, i.units]), [['armoredGrunt', 5], ['fastRunner', 12]]);
});

test('describeBanner: names, set pieces and the final wave', () => {
  const named = describeBanner(started({ wave: 8, name: 'Iron Skin' }), 30);
  assert.equal(named.title, 'Iron Skin');
  const fixed = describeBanner(started({ wave: 10, name: 'The Vanguard', fixed: true }), 30);
  assert.deepEqual([fixed.kicker, fixed.fixed, fixed.final, fixed.seconds], ['SET PIECE · WAVE 10 / 30', true, false, config.ui.bannerFixedSeconds]);
  const final = describeBanner(started({ wave: 30, name: 'The Siege', fixed: true }), 30);
  assert.deepEqual([final.kicker, final.final, final.seconds], ['FINAL WAVE', true, config.ui.bannerFinalSeconds]); // final beats fixed
  const quickFinal = describeBanner(started({ wave: 15 }), 15);
  assert.deepEqual([quickFinal.kicker, quickFinal.title, quickFinal.seconds], ['FINAL WAVE', 'Wave 15', config.ui.bannerFinalSeconds]);
});

test('describeBanner: hp line has one decimal', () => {
  assert.equal(describeBanner(started({ hpMult: 1 }), 30).hpLine, 'Enemy HP ×1.0');
  assert.equal(describeBanner(started({ hpMult: 27.249 }), 30).hpLine, 'Enemy HP ×27.2');
});

test('describePreview: null handling, titles, items, final flag', () => {
  assert.equal(describePreview(null, 30), null);
  const p = describePreview({ wave: 8, name: 'Iron Skin', fixed: false, isFinal: false, hpMult: 4.25, items: [{ type: 'shieldedBruiser', units: 3, picks: 3 }, { type: 'armoredGrunt', units: 9, picks: 9 }] }, 30);
  assert.equal(p.title, 'Wave 8 · Iron Skin');
  assert.deepEqual(p.items.map((i) => i.type), ['armoredGrunt', 'shieldedBruiser']);
  assert.equal(p.hpLine, 'Enemy HP ×4.3');
  assert.equal(p.final, false);
  const plain = describePreview({ wave: 15, name: null, fixed: false, isFinal: true, hpMult: 9, items: [] }, 15);
  assert.deepEqual([plain.title, plain.final], ['Wave 15', true]);
});
