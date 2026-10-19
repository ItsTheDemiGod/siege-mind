import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverageTable, chooseFixedWave, FIXED_WAVE_CANDIDATES, FIXED_WAVE_RULE } from '../experiments/fixedWave.js';

const MODES = ['adaptive', 'prior'];
const cov = (byWave) => Object.fromEntries(Object.entries(byWave).map(([W, perMode]) => [W, Object.fromEntries(Object.entries(perMode).map(([m, c]) => [m, { observed: c * 100, populationUnits: 100, coverage: c }]))]));
const flat = (c) => Object.fromEntries(FIXED_WAVE_CANDIDATES.map((W) => [W, { adaptive: c, prior: c }]));

test('candidates are the eligible waves in [9, 15]', () => {
  assert.deepEqual([...FIXED_WAVE_CANDIDATES], [9, 11, 12, 13, 14, 15]);
  assert.match(FIXED_WAVE_RULE, /smallest eligible wave >= 9/);
});

test('coverageTable counts population units with a non-null tilt at W, per mode', () => {
  const tw = (W) => { const a = Array(15).fill(null); a[W - 1] = { armoredGrunt: 1 }; return a; };
  const rows = [
    { mode: 'adaptive', style: 'a', seed: 1, tiltByWave: tw(9) }, { mode: 'adaptive', style: 'a', seed: 2, tiltByWave: tw(11) }, { mode: 'adaptive', style: 'b', seed: 1, tiltByWave: tw(9) },
    { mode: 'prior', style: 'a', seed: 1, tiltByWave: tw(9) }, { mode: 'prior', style: 'a', seed: 2, tiltByWave: tw(9) },
  ];
  const t = coverageTable(rows, { modes: MODES, waves: [9, 11], population: ['a|1', 'a|2'] }); // b|1 is outside the population
  assert.deepEqual(t[9].adaptive, { observed: 1, populationUnits: 2, coverage: 0.5 });
  assert.deepEqual(t[11].adaptive, { observed: 1, populationUnits: 2, coverage: 0.5 });
  assert.deepEqual(t[9].prior, { observed: 2, populationUnits: 2, coverage: 1 });
  assert.deepEqual(t[11].prior.coverage, 0);
  assert.equal(coverageTable([], { modes: MODES, waves: [9], population: [] })[9].adaptive.coverage, 0);
  assert.deepEqual(coverageTable(rows, { modes: MODES, waves: [9, 11], population: ['a|1', 'a|2'] }), t);
});

test('chooseFixedWave: the first candidate qualifies, a later one qualifies, none qualifies, ties, the 0.75 boundary', () => {
  const first = chooseFixedWave(cov(flat(0.9)), { modes: MODES });
  assert.deepEqual([first.chosen, first.metRule], [9, true]);
  const later = chooseFixedWave(cov({ ...flat(0.9), 9: { adaptive: 0.9, prior: 0.5 }, 11: { adaptive: 0.6, prior: 0.95 }, 12: { adaptive: 0.8, prior: 0.8 } }), { modes: MODES });
  assert.deepEqual([later.chosen, later.metRule, later.minCoverageByWave[9], later.minCoverageByWave[11]], [12, true, 0.5, 0.6]);
  const none = chooseFixedWave(cov({ ...flat(0.5), 13: { adaptive: 0.7, prior: 0.7 }, 14: { adaptive: 0.74, prior: 0.9 } }), { modes: MODES });
  assert.deepEqual([none.chosen, none.metRule], [14, false]);
  const tie = chooseFixedWave(cov({ ...flat(0.4), 12: { adaptive: 0.6, prior: 0.7 }, 14: { adaptive: 0.6, prior: 0.9 } }), { modes: MODES });
  assert.deepEqual([tie.chosen, tie.metRule], [12, false], 'ties go to the smaller wave');
  assert.equal(chooseFixedWave(cov({ ...flat(0.5), 11: { adaptive: 0.75, prior: 0.75 } }), { modes: MODES }).chosen, 11, 'exactly 0.75 qualifies');
  assert.equal(chooseFixedWave(cov({ ...flat(0.5), 11: { adaptive: 0.7499, prior: 0.9 } }), { modes: MODES }).metRule, false);
  assert.equal(chooseFixedWave(cov(flat(0.8)), { modes: MODES, minCoverage: 0.85 }).metRule, false);
  assert.equal(first.rule, FIXED_WAVE_RULE);
  assert.deepEqual(chooseFixedWave(cov(flat(0.9)), { modes: MODES }), first);
});
