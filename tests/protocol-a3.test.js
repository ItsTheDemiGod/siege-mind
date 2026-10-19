// Amendment A3 (protocol version 4): the confirmatory block, the held-out size and the helpers that go with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from '../src/data/config.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { isAdaptiveEligible, isTypeUnlocked } from '../src/data/waves.js';
import { PROTOCOL, PROTOCOL_PREVIOUS_HASHES, seedsOf, protocolHash } from '../experiments/protocol.js';
import { METRIC_COLUMNS } from '../experiments/metrics.js';
import { ALL_MODES, allowedModesFor } from '../experiments/modes.js';
import { unitsFor } from '../experiments/runExperiment.js';
import { parseExperimentArgs, main } from '../experiments/runExperimentCli.js';
import { checkProtocolHash } from '../experiments/analyzeCli.js';
import { requiredN } from '../experiments/stats.js';

const C = PROTOCOL.confirmatory;

test('the exploratory v3 hypothesis family is unchanged (golden)', () => {
  const golden = JSON.parse(readFileSync(fileURLToPath(new URL('./golden/protocol-v3-hypotheses.json', import.meta.url)), 'utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(PROTOCOL.hypotheses)), golden);
  assert.deepEqual([...PROTOCOL.modes], ['static', 'adaptive', 'random']);
});

test('held-out seeds: 2001-2150, disjoint from the tuning set, the calibration seeds and seeds 1-5', () => {
  const held = seedsOf('heldout');
  assert.equal(held.length, 150);
  assert.deepEqual([held[0], held.at(-1)], [2001, 2150]);
  assert.equal(new Set(held).size, 150);
  for (const other of ['tuning', 'calibration']) assert.ok(held.every((s) => !seedsOf(other).includes(s)), other);
  assert.ok(held.every((s) => s > 5));
});

test('the confirmatory block is deep-frozen and has the registered structure', () => {
  const frozen = (o) => Object.isFrozen(o) && Object.values(o).every((v) => (v && typeof v === 'object' ? frozen(v) : true));
  assert.ok(frozen(C));
  assert.deepEqual([...C.modes], ['static', 'random', 'prior', 'adaptive', 'adaptive2', 'counter']);
  for (const m of PROTOCOL.modes) assert.ok(C.modes.includes(m));
  for (const m of C.modes) assert.ok(ALL_MODES.includes(m));
  assert.deepEqual(C.population, { rule: 'static-reached', minStaticFinalWave: 5, description: C.population.description });
  assert.equal(C.alpha, 0.05);
  assert.equal(C.correction, 'holm');
  assert.deepEqual(C.hypotheses.map((h) => [h.id, h.direction]), [['K1', 'greater'], ['K2', 'greater'], ['K3', 'greater']]);
  assert.deepEqual(C.hypotheses.map((h) => h.kind), ['metric', 'contrast', 'contrast']);
  assert.deepEqual([C.hypotheses[1].mode, C.hypotheses[1].wave, C.hypotheses[2].mode, C.hypotheses[2].wave], ['adaptive', 9, 'adaptive2', 9]);
  assert.deepEqual([C.hypotheses[0].modeA, C.hypotheses[0].modeB, C.hypotheses[0].metric], ['random', 'static', 'livesLost']);
  assert.equal(C.fixedWave.coverageRuleMet, false);
  assert.equal(C.fixedWave.trainingCoverageAtPrimary, 0.7);
  assert.equal(C.estimands.pairs.length, 8);
  for (const [a, b] of C.estimands.pairs) assert.ok(C.modes.includes(a) && C.modes.includes(b) && a !== b);
  for (const m of C.estimands.metrics) assert.ok(METRIC_COLUMNS.includes(m), m);
  for (const m of C.estimands.contrastModes) assert.ok(C.modes.includes(m));
  assert.deepEqual([...C.estimands.contrastWaves], [5, 9, 13]);
  assert.ok(C.estimands.contrastWaves.every((w) => isAdaptiveEligible(w, config.director)));
  assert.ok(C.estimands.contrastWaves.at(-1) > C.fixedWave.primary, 'wave 13 is later than the primary wave (descriptive only)');
  assert.deepEqual([C.fixedWave.primary, C.fixedWave.secondary, C.hypotheses[1].wave, C.hypotheses[2].wave], [9, 5, 9, 9]);
  assert.match(C.estimands.reporting, /no p-values/);
  assert.equal(C.sensitivity.length, 3);
});

test('fixed waves are eligible; 9 is the first eligible wave with every predicted type unlocked and wave 5 unlocks exactly two', () => {
  const predicted = [...new Set(Object.values(PROTOCOL.tiltPredictions).flat().filter(Boolean))];
  assert.equal(predicted.length, 4);
  const eligible = Array.from({ length: 15 }, (_, i) => i + 1).filter((w) => isAdaptiveEligible(w, config.director));
  const allUnlocked = (w) => predicted.every((t) => isTypeUnlocked(t, w));
  assert.equal(eligible.find(allUnlocked), C.fixedWave.primary);
  assert.ok(isAdaptiveEligible(C.fixedWave.primary, config.director) && isAdaptiveEligible(C.fixedWave.secondary, config.director));
  assert.equal(predicted.filter((t) => isTypeUnlocked(t, C.fixedWave.secondary)).length, 2);
  assert.ok(predicted.every((t) => ENEMY_ORDER.includes(t)));
});

test('amendment A3, the protocol hash and the previous-version hash', () => {
  const a3 = PROTOCOL.amendments.find((a) => a.id === 'A3');
  assert.deepEqual([...a3.affects], ['seedSets.heldout', 'confirmatory', 'modes for heldout']);
  assert.equal(a3.madeAfterSeeingTuningResults && a3.madeBeforeHeldout, true);
  assert.match(a3.notes, /1021-1030 are not pristine/);
  assert.equal(PROTOCOL_PREVIOUS_HASHES[3], '592e7934cb1d165e373a656b127b050beb836d941517656f3b9d9f984b59efa3');
  assert.notEqual(protocolHash(), PROTOCOL_PREVIOUS_HASHES[3]);
  assert.ok(Object.isFrozen(PROTOCOL_PREVIOUS_HASHES));
  assert.equal('PROTOCOL_PREVIOUS_HASHES' in PROTOCOL, false);
});

test('allowedModesFor per set; the held-out run needs exactly the six modes and the protocol styles', () => {
  assert.deepEqual([...allowedModesFor('heldout')], [...C.modes]);
  assert.deepEqual([...allowedModesFor('tuning')], [...ALL_MODES]);
  assert.deepEqual([...allowedModesFor('calibration')], [...PROTOCOL.modes]);
  assert.throws(() => allowedModesFor('nope'), RangeError);
  const units = unitsFor({ set: 'heldout' });
  assert.equal(units.length, 150 * 5 * 6);
  assert.deepEqual(units.slice(0, 7).map((u) => `${u.seed}/${u.style}/${u.mode}`), ['2001/balancedR/static', '2001/balancedR/random', '2001/balancedR/prior', '2001/balancedR/adaptive', '2001/balancedR/adaptive2', '2001/balancedR/counter', '2001/noLance/static']);
  for (const modes of [['static'], [...PROTOCOL.modes], C.modes.slice(0, 5), [...C.modes].reverse(), ['static', 'adaptive', 'random', 'adaptive2', 'counter', 'prior']]) {
    assert.throws(() => unitsFor({ set: 'heldout', modes }), RangeError, modes.join());
  }
  assert.throws(() => unitsFor({ set: 'heldout', styles: ['balancedR'] }), RangeError);
  assert.deepEqual(parseExperimentArgs(['--set=heldout', '--final', '--yes']).modes, [...C.modes]);
  assert.throws(() => parseExperimentArgs(['--set=heldout', '--modes=static,adaptive']), /not allowed/);
  assert.equal(unitsFor({ set: 'tuning' }).length, 30 * 5 * 3, 'tuning unaffected');
});

test('held-out gate with stubs: the six modes pass, the lock is written BEFORE the runner, one runner call with 4500 units; subsets are refused', async () => {
  const calls = [];
  const sizes = [];
  const deps = {
    identityOf: () => ({ codeHash: 'c0de', gitCommit: 'abc', gitDirty: false }), readLock: () => null, writeLock: (k, l) => calls.push(`lock:${k}:${l.runIndex}`),
    unitsFor, runExperiment: ({ units }) => { calls.push('run'); sizes.push(units.length); return []; }, writeResults: () => { calls.push('write'); return { json: 'a', csv: 'b' }; },
    now: () => 'now', clock: () => 0, log: () => {}, error: () => {},
  };
  assert.equal(await main(['--set=heldout', '--final', '--yes'], deps), 0);
  assert.deepEqual(calls, ['lock:heldout:1', 'run', 'write']);
  assert.deepEqual(sizes, [4500]);
  for (const extra of [['--modes=static,adaptive,random'], ['--styles=balancedR'], ['--modes=adaptive2']]) {
    const c2 = [];
    const d2 = { ...deps, writeLock: () => c2.push('lock'), runExperiment: () => { c2.push('run'); return []; } };
    assert.equal(await main(['--set=heldout', '--final', '--yes', ...extra], d2), 2, extra.join());
    assert.deepEqual(c2, []);
  }
});

test('checkProtocolHash truth table', () => {
  const prev = { 3: 'old3' };
  assert.deepEqual(checkProtocolHash('now', 'now', prev, false), { ok: true, note: null });
  assert.deepEqual(checkProtocolHash('old3', 'now', prev, false), { ok: true, note: 'rows were produced under protocol version 3' });
  assert.deepEqual(checkProtocolHash('other', 'now', prev, false), { ok: false, note: null });
  assert.deepEqual(checkProtocolHash('other', 'now', prev, true), { ok: true, note: null });
  assert.deepEqual(checkProtocolHash(undefined, 'now', prev, false), { ok: false, note: null });
  assert.deepEqual(checkProtocolHash('old3', 'now', {}, false), { ok: false, note: null });
  assert.equal(checkProtocolHash('now', 'now', prev, true).note, null);
});

test('requiredN accepts the Holm level 0.016667 (hand computed) and keeps the old behavior', () => {
  assert.equal(requiredN({ sd: 1, effect: 0.5, alpha: 0.016667 }), Math.ceil(((2.394 + 0.841621) * 2) ** 2)); // 42
  assert.equal(requiredN({ sd: 1, effect: 0.5, alpha: 0.016667 }), 42);
  assert.equal(requiredN({ sd: 1, effect: 0.5, alpha: 0.016667, power: 0.9 }), Math.ceil(((2.394 + 1.281552) * 2) ** 2));
  assert.equal(requiredN({ sd: 1, effect: 0.5 }), 32);
  assert.throws(() => requiredN({ sd: 1, effect: 1, alpha: 0.01 }), RangeError);
});
