import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { firstLook, formatFirstLook, firstLookToMarkdown, NOTES, FIXED_WAVES } from '../experiments/firstLook.js';
import { parseFirstLookArgs } from '../experiments/firstLookCli.js';

const protocol = {
  ...PROTOCOL,
  styles: ['noLance', 'noMortar'],
  tiltPredictions: { noLance: ['armoredGrunt'], noMortar: ['swarmling'] },
  stats: { ...PROTOCOL.stats, bootstrapResamples: 300, signFlipResamples: 2000 },
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const tilt = (o = {}) => ({ ...Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1])), ...o });

// 2 styles x 3 seeds x 3 modes. noMortar/3 is lost at wave 3 in every mode (outside the population).
const STATIC_LIVES = { 'noLance|1': 4, 'noLance|2': 6, 'noLance|3': 10, 'noMortar|1': 2, 'noMortar|2': 8, 'noMortar|3': 20 };
const ADAPTIVE_EXTRA = { 'noLance|1': 2, 'noLance|2': 2, 'noLance|3': 2, 'noMortar|1': 4, 'noMortar|2': 0 };

function tiltByWave(mode, style, seed) {
  const a = Array(15).fill(null);
  if (mode === 'adaptive') {
    const own = style === 'noLance' ? tilt({ armoredGrunt: 1.5 }) : tilt({ swarmling: 1.2 });
    a[6] = own; // wave 7: every population unit observed
    if (!(style === 'noMortar' && seed === 2)) a[8] = own; // wave 9: noMortar/2 is missing (coverage 3 of 5)
  }
  if (mode === 'random') a[6] = tilt({ armoredGrunt: 1.3, swarmling: 1.1 }); // the same for every style of a seed
  return a;
}

function makeRows() {
  const rows = [];
  for (const seed of [1, 2, 3]) for (const style of protocol.styles) for (const mode of ['static', 'adaptive', 'random']) {
    const key = `${style}|${seed}`;
    const early = key === 'noMortar|3';
    const extra = mode === 'adaptive' ? ADAPTIVE_EXTRA[key] : mode === 'random' ? 1 : 0;
    rows.push({
      style, mode, seed, livesLost: early ? 20 : STATIC_LIVES[key] + extra, won: early ? 0 : 1, finalWave: early ? 3 : 15, leakFraction: 0.1, penetration: 0.5,
      tiltByWave: tiltByWave(mode, style, seed),
    });
  }
  return rows;
}
const rows = makeRows();
const result = firstLook(rows, protocol);

test('population: units whose static game reached wave 5, with the excluded count', () => {
  assert.deepEqual(result.modes, ['static', 'adaptive', 'random']);
  assert.deepEqual(result.population, { units: 5, excluded: 1, totalUnits: 6, seeds: 3, allSeeds: 3, minWave: 5 });
});

test('descriptive values on the population are hand-computed', () => {
  const lives = result.descriptive.livesLost.byMode.static;
  assert.equal(lives.n, 5);
  near(lives.mean, 6); // 4, 6, 10, 2, 8
  near(lives.sd, Math.sqrt(10)); // sum of squares 40 over n - 1
  near(result.descriptive.livesLost.byMode.adaptive.mean, 6 + (2 + 2 + 2 + 4 + 0) / 5);
  near(result.descriptive.livesLost.byStyleMode.noMortar.random.mean, 6); // 3, 9
  assert.equal(result.descriptive.won.byMode.static.mean, 1);
  assert.equal(result.descriptive.won.byMode.static.wilson.length, 2);
  assert.equal(result.descriptive.finalWave.byMode.random.mean, 15);
});

test('paired differences: seed-level means over the population styles, exact', () => {
  const p = (a, b, metric) => result.pairs.find((x) => x.a === a && x.b === b && x.metric === metric);
  const ad = p('adaptive', 'static', 'livesLost'); // seed 1: mean(2, 4) = 3, seed 2: mean(2, 0) = 1, seed 3: 2 (only noLance)
  near(ad.meanDiff, 2);
  assert.equal(ad.n, 3);
  near(ad.pRaw, 0.25); // exact two-sided sign-flip of three positive differences: 2 / 8
  const rs = p('random', 'static', 'livesLost');
  assert.equal(rs, undefined, 'only the pairs of the plan are reported');
  const ar = p('adaptive', 'random', 'livesLost'); // seed 1: mean(2 - 1, 4 - 1) = 2, seed 2: mean(1, -1) = 0, seed 3: 1
  near(ar.meanDiff, 1);
  assert.equal(p('adaptive', 'static', 'won').meanDiff, 0);
  assert.equal(p('adaptive', 'static', 'won').pRaw, 1);
  assert.equal(result.pairs.some((x) => x.a === 'adaptive2'), false, 'pairs with absent modes are skipped');
  assert.equal(result.pairs.filter((x) => x.a === 'adaptive').length, 6);
});

test('fixed-wave contrast: exact values, coverage below 1, dropped seeds, random exactly 0 by construction', () => {
  const c = (mode, W) => result.fixedWave.find((x) => x.mode === mode && x.wave === W);
  const a7 = c('adaptive', 7);
  assert.deepEqual([a7.observedUnits, a7.popUnits, a7.coverage, a7.seeds], [5, 5, 1, 2]); // seed 3 has no reference style
  near(a7.mean, 0.35); // noLance: 1.5 - 1 = 0.5 on armoredGrunt; noMortar: 1.2 - 1 = 0.2 on swarmling
  assert.deepEqual(a7.perPair, [{ style: 'noLance', type: 'armoredGrunt', n: 2, mean: 0.5 }, { style: 'noMortar', type: 'swarmling', n: 2, mean: 0.2 }]);
  const a9 = c('adaptive', 9);
  assert.deepEqual([a9.observedUnits, a9.coverage, a9.seeds], [4, 0.8, 1]);
  near(a9.mean, 0.35);
  const r7 = c('random', 7);
  assert.deepEqual([r7.mean, r7.pRaw, r7.ci95, r7.seeds], [0, 1, [0, 0], 2]);
  const none = c('adaptive', 15);
  assert.deepEqual([none.observedUnits, none.coverage, none.mean, none.ci95, none.pRaw, none.seeds], [0, 0, null, null, null, 0]);
  assert.equal(result.fixedWave.length, FIXED_WAVES.length * 2);
  assert.equal(result.bestWave, 7);
  assert.deepEqual(result.perPairAtBest.map((x) => x.mode), ['adaptive', 'random']);
});

test('early-ends: identical units in every mode pass, a difference produces a prominent warning', () => {
  assert.equal(result.earlyEnds.identical, true);
  assert.equal(result.earlyEnds.byMode.static.endedEarly, 1);
  assert.doesNotMatch(formatFirstLook(result), /INVARIANT IS VIOLATED/);
  const broken = rows.map((r) => (r.mode === 'adaptive' && r.style === 'noLance' && r.seed === 2 ? { ...r, finalWave: 3 } : r));
  const r = firstLook(broken, protocol);
  assert.equal(r.earlyEnds.identical, false);
  assert.match(formatFirstLook(r), /WARNING: AN INVARIANT IS VIOLATED/);
  assert.match(firstLookToMarkdown(r), /INVARIANT IS VIOLATED/);
});

test('missing and duplicate units, and a missing static mode, are errors', () => {
  assert.throws(() => firstLook(rows.filter((r) => !(r.style === 'noLance' && r.mode === 'random' && r.seed === 2)), protocol), /missing unit noLance\/random\/seed 2/);
  assert.throws(() => firstLook([...rows, rows[0]], protocol), /duplicate unit noLance\/static\/seed 1/);
  assert.throws(() => firstLook(rows.filter((r) => r.mode !== 'static'), protocol), /static mode is required/);
});

test('deterministic; text and markdown contain every section, the notes and no NaN', () => {
  assert.deepEqual(firstLook(rows, protocol), result);
  const text = formatFirstLook(result);
  const md = firstLookToMarkdown(result);
  assert.equal(text, formatFirstLook(firstLook(rows, protocol)));
  for (const title of ['Population', 'Lives lost by style and mode', 'Paired mode differences in livesLost', 'Fixed-wave style contrast', 'Per (style, type) contrast', 'Units that ended before wave 5']) {
    assert.ok(text.includes(title) && md.includes(title), title);
  }
  for (const n of NOTES) assert.ok(text.includes(n) && md.includes(n), n);
  assert.ok(md.startsWith('# First look at the new arms (exploratory, training seeds)'));
  assert.ok(!/NaN|undefined|Infinity/.test(text + md));
});

test('parseFirstLookArgs', () => {
  assert.deepEqual(parseFirstLookArgs(['--in=a.json', '--out=b']), { in: 'a.json', out: 'b' });
  assert.deepEqual(parseFirstLookArgs(['--in=a.json']), { in: 'a.json', out: null });
  assert.throws(() => parseFirstLookArgs([]), /--in/);
  assert.throws(() => parseFirstLookArgs(['--in=a', '--bogus']), /unknown argument/);
});
