import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { TOWER_ORDER, TOWERS } from '../src/data/towers.js';
import { PROTOCOL, seedsOf, styleWeights, protocolHash, hashOf } from '../experiments/protocol.js';
import { METRIC_COLUMNS } from '../experiments/metrics.js';

test('the protocol is frozen all the way down and has the registered shape', () => {
  const frozen = (o) => Object.isFrozen(o) && Object.values(o).every((v) => (v && typeof v === 'object' ? frozen(v) : true));
  assert.ok(frozen(PROTOCOL));
  assert.equal(PROTOCOL.version, 3); // approved reversal (Phase 9A-1): amendment A2 bumped the version
  assert.equal(PROTOCOL.waves, 15);
  assert.equal(PROTOCOL.startLives, config.game.startLives);
  assert.deepEqual([...PROTOCOL.styles], ['balancedR', 'noLance', 'noMortar', 'noPoison', 'noSniper']); // approved reversal (A2); noFrost was dropped by calibration stage 3
  assert.deepEqual([...PROTOCOL.modes], ['static', 'adaptive', 'random']);
  assert.equal(PROTOCOL.primaryMetric, 'livesLost');
  assert.deepEqual(PROTOCOL.stats, { seed: 20261019, signFlipResamples: 100000, bootstrapResamples: 10000, exactMaxN: 16, alpha: 0.05, alignmentThreshold: 1.15 });
  assert.ok(config.game.allowedTotals.includes(PROTOCOL.waves));
});

test('seed sets have the registered sizes; held-out is disjoint, calibration is inside tuning, no set touches the seeds of earlier tests', () => {
  const cal = seedsOf('calibration');
  const tun = seedsOf('tuning');
  const held = seedsOf('heldout');
  assert.deepEqual([cal.length, tun.length, held.length], [10, 30, 60]);
  assert.ok(cal.every((s) => tun.includes(s)));
  assert.ok(held.every((s) => !tun.includes(s)));
  for (const set of [cal, tun, held]) {
    assert.equal(new Set(set).size, set.length);
    assert.ok(set.every((s) => Number.isInteger(s) && s > 5), 'seeds 1..5 belong to the balance tests');
  }
  assert.deepEqual([tun[0], tun.at(-1), held[0], held.at(-1)], [1001, 1030, 2001, 2060]);
  for (const bad of ['nope', '', undefined, 'Tuning']) assert.throws(() => seedsOf(bad), RangeError);
});

test('hypotheses: unique ids, known families, metrics exist, modes valid', () => {
  const ids = PROTOCOL.hypotheses.map((h) => h.id);
  assert.deepEqual(ids, ['P1', 'P2', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'T2', 'T0', 'C1']);
  assert.equal(new Set(ids).size, ids.length);
  for (const h of PROTOCOL.hypotheses) {
    assert.ok(['primary', 'secondary', 'descriptive'].includes(h.family), h.id);
    assert.ok(['metric', 'contrast'].includes(h.kind), h.id);
    if (h.kind === 'metric') assert.ok(METRIC_COLUMNS.includes(h.metric), `${h.id}: ${h.metric}`);
    assert.ok(PROTOCOL.modes.includes(h.modeA) && (h.modeB === null ? h.kind === 'contrast' : PROTOCOL.modes.includes(h.modeB) && h.modeA !== h.modeB));
    assert.ok((h.id === 'T0' ? ['twosided'] : ['greater', 'less']).includes(h.direction));
    assert.ok(h.label.length > 10);
  }
  assert.deepEqual(PROTOCOL.hypotheses.filter((h) => h.family === 'primary').map((h) => h.id), ['P1', 'P2']);
  assert.ok(PROTOCOL.hypotheses.filter((h) => h.family === 'primary').every((h) => h.metric === PROTOCOL.primaryMetric));
});

test('tilt predictions reference real enemy ids and every style has an entry', () => {
  assert.deepEqual(Object.keys(PROTOCOL.tiltPredictions), [...PROTOCOL.styles]);
  assert.equal(PROTOCOL.tiltPredictions.balancedR, null);
  for (const [style, types] of Object.entries(PROTOCOL.tiltPredictions)) {
    if (types === null) continue;
    assert.ok(types.length >= 1 && types.every((t) => ENEMY_ORDER.includes(t)), style);
  }
});

test('A2: ablation styles have exact weights, predictions equal the strongVs of the missing tower, old styles are unchanged', () => {
  const missing = { noLance: 'lance', noMortar: 'mortar', noFrost: 'frost', noPoison: 'poison', noSniper: 'sniper' };
  for (const [style, tower] of Object.entries(missing)) {
    for (const fw of [0.3, undefined, 'ignored']) { // focusWeight is ignored and not validated
      const w = styleWeights(style, fw);
      assert.deepEqual(w, TOWER_ORDER.map((t) => (t === tower ? 0 : 0.25)));
      assert.equal(w.reduce((a, b) => a + b, 0), 1);
    }
    if (PROTOCOL.styles.includes(style)) assert.deepEqual([...PROTOCOL.tiltPredictions[style]], [...TOWERS[tower].strongVs]);
    else assert.equal(style, 'noFrost'); // dropped by calibration stage 3: its prediction would have been strongVs of frost
    assert.deepEqual(TOWERS[tower].strongVs.length, 1);
  }
  assert.deepEqual(styleWeights('lanceHeavy', 0.3), [0.3, 0.175, 0.175, 0.175, 0.175]); // golden vectors of the archived focus styles
  assert.deepEqual(styleWeights('sniperHeavy', 0.5), [0.125, 0.125, 0.125, 0.125, 0.5]);
  assert.deepEqual(styleWeights('balancedR', 0.3), [0.2, 0.2, 0.2, 0.2, 0.2]);
});

test('styleWeights sums to 1, puts the focus tower on top and validates its input', () => {
  const focus = { lanceHeavy: 'lance', mortarHeavy: 'mortar', poisonHeavy: 'poison', sniperHeavy: 'sniper' };
  for (const fw of [0.2, 0.3, 0.5, 0.7]) {
    for (const style of ['balancedR', 'lanceHeavy', 'mortarHeavy', 'poisonHeavy', 'sniperHeavy']) {
      const w = styleWeights(style, fw);
      assert.equal(w.length, TOWER_ORDER.length);
      assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-12, `${style} ${fw}`);
      if (focus[style]) {
        const i = TOWER_ORDER.indexOf(focus[style]);
        assert.equal(w[i], fw);
        assert.ok(w.every((x, j) => j === i || x < w[i] || fw === 0.2), `${style}: focus on top`);
        for (let j = 0; j < w.length; j++) if (j !== i) assert.ok(Math.abs(w[j] - (1 - fw) / 4) < 1e-12);
      } else {
        assert.ok(w.every((x) => Math.abs(x - 0.2) < 1e-12));
      }
    }
  }
  assert.ok(styleWeights('mortarHeavy', 0.4)[TOWER_ORDER.indexOf('frost')] > 0, 'frost keeps a share');
  assert.throws(() => styleWeights('nope', 0.4), RangeError);
  for (const bad of [0.19, 0.71, NaN, '0.4', undefined]) assert.throws(() => styleWeights('lanceHeavy', bad), RangeError);
});

test('protocolHash is deterministic and changes with any knob', () => {
  assert.match(protocolHash(), /^[0-9a-f]{64}$/);
  assert.equal(protocolHash(), protocolHash());
  assert.equal(protocolHash(), hashOf(PROTOCOL));
  const copy = JSON.parse(JSON.stringify(PROTOCOL));
  assert.equal(hashOf(copy), protocolHash());
  copy.botKnobs.tilePool = 5;
  assert.notEqual(hashOf(copy), protocolHash());
  const reordered = JSON.parse(JSON.stringify(PROTOCOL));
  assert.equal(hashOf(Object.fromEntries(Object.entries(reordered).reverse())), protocolHash(), 'key order does not matter');
});

test('amendment A1 is registered and is part of the hash', () => {
  assert.deepEqual(PROTOCOL.amendments.map((a) => a.id), ['A1', 'A2']);
  const a1 = PROTOCOL.amendments[0];
  assert.deepEqual([...a1.affects], ['tilt_*', 'tiltAligned', 'tiltObserved', 'T1']);
  assert.equal(a1.madeAfterSeeingTuningResults, true);
  assert.equal(a1.madeBeforeHeldout, true);
  assert.ok(a1.summary.length > 20);
  assert.equal(PROTOCOL.hypotheses.some((h) => h.id === 'T1'), false); // retired by A2
  const a2 = PROTOCOL.amendments[1];
  assert.deepEqual([...a2.affects], ['styles', 'tiltPredictions', 'calibration', 'botKnobs', 'T1', 'T2', 'T0']);
  assert.equal(a2.madeAfterSeeingTuningResults && a2.madeBeforeHeldout, true);
  const without = JSON.parse(JSON.stringify(PROTOCOL));
  delete without.amendments;
  assert.notEqual(hashOf(without), protocolHash());
});
