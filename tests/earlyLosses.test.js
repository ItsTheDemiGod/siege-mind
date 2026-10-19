import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earlyLossReport, formatEarlyLosses, earlyLossesToMarkdown } from '../experiments/earlyLosses.js';

const row = (style, mode, seed, finalWave, won = 0) => ({ style, mode, seed, finalWave, won });
/** Two styles, three seeds, three modes: seed 1 of style a and seed 2 of style b end early (wave 3) in every mode. */
function rows(extra = []) {
  const out = [];
  for (const mode of ['static', 'adaptive', 'random']) {
    for (const seed of [1, 2, 3]) {
      out.push(row('a', mode, seed, seed === 1 ? 3 : 15, seed === 1 ? 0 : 1));
      out.push(row('b', mode, seed, seed === 2 ? 3 : 10, 0));
    }
  }
  return [...out, ...extra];
}

test('counts by mode and by style x mode, and identical early-ending units', () => {
  const r = earlyLossReport(rows());
  assert.deepEqual(r.byMode, { adaptive: { units: 6, endedEarly: 2, won: 2 }, random: { units: 6, endedEarly: 2, won: 2 }, static: { units: 6, endedEarly: 2, won: 2 } });
  assert.deepEqual(r.byStyleMode.filter((x) => x.style === 'a'), [
    { style: 'a', mode: 'adaptive', units: 3, endedEarly: 1 }, { style: 'a', mode: 'random', units: 3, endedEarly: 1 }, { style: 'a', mode: 'static', units: 3, endedEarly: 1 },
  ]);
  assert.equal(r.identical, true);
  assert.deepEqual(r.mismatches, []);
  assert.equal(r.threshold, 5);
});

test('a unit that ends early in only some modes makes identical false and is listed', () => {
  const data = rows().map((x) => (x.style === 'a' && x.mode === 'adaptive' && x.seed === 3 ? { ...x, finalWave: 4 } : x));
  const r = earlyLossReport(data);
  assert.equal(r.identical, false);
  assert.deepEqual(r.mismatches, [{ unit: 'a/3', modes: ['adaptive'] }]);
  assert.equal(r.byMode.adaptive.endedEarly, 3);
  assert.match(formatEarlyLosses(r), /WARNING.*invariant is violated/);
  assert.match(earlyLossesToMarkdown(r), /\*\*WARNING:\*\*/);
  assert.match(formatEarlyLosses(earlyLossReport(rows())), /expected/);
});

test('another threshold changes what counts as early', () => {
  const r = earlyLossReport(rows(), { threshold: 11 });
  assert.equal(r.threshold, 11);
  assert.equal(r.byMode.static.endedEarly, 4); // wave 3 twice and wave 10 twice (style b seeds 1 and 3)
  assert.equal(earlyLossReport(rows(), { threshold: 3 }).byMode.static.endedEarly, 0);
});

test('a missing mode is handled and the output is deterministic', () => {
  const data = rows().filter((x) => x.mode !== 'random');
  const r = earlyLossReport(data);
  assert.deepEqual(Object.keys(r.byMode), ['adaptive', 'static']);
  assert.equal(r.identical, true);
  assert.deepEqual(earlyLossReport(data), r);
  assert.equal(formatEarlyLosses(r), formatEarlyLosses(earlyLossReport(data)));
  assert.equal(earlyLossesToMarkdown(r), earlyLossesToMarkdown(earlyLossReport(data)));
  assert.deepEqual(earlyLossReport([]).byMode, {});
  assert.equal(earlyLossReport([]).identical, true);
});
