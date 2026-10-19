// Difficulty ladder (Phase 4A.2): three bots of increasing strength must land where the design says.
// STAGE C (last resort) WAS USED: no configuration in the searched space passed the original T5 (3+ loss waves AND no wave above 60%)
// together with T7 (all of seeds 2-5 win). T5 and T7 below are the approved relaxed forms T5' and T7'; T1-T4 and T6 are unchanged.
// Knobs used to meet these targets live in config (hpCurve and its parameters, towerCostGrowth, clear bonus, spawn windows); see the Decisions Log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playGame } from '../experiments/playthrough.js';
import { getBot } from '../experiments/bots.js';

const run = (name, seed = 1) => playGame({ seed, bot: getBot(name) });
const lossesByWave = (r) => r.perWave.map((w) => w.livesLost);

// One shared set of playthroughs: each game takes about a second.
const none = run('none');
const weak = run('weak');
const balanced = run('balanced');
const otherSeeds = [2, 3, 4, 5].map((s) => [s, run('balanced', s)]);

test('T1: a player who never builds loses at or before wave 3', () => {
  assert.equal(none.result, 'lost');
  assert.ok(none.wave <= 3, `lost at wave ${none.wave}`);
});

test('T2: the weak bot (12 Lances, no upgrades) loses between waves 8 and 24', () => {
  assert.equal(weak.result, 'lost');
  assert.ok(weak.wave >= 8 && weak.wave <= 24, `lost at wave ${weak.wave}`);
});

test('T3: the balanced bot wins with between 1 and 10 lives left', () => {
  assert.equal(balanced.result, 'won');
  assert.equal(balanced.wave, 30);
  assert.ok(balanced.lives >= 1 && balanced.lives <= 10, `lives left ${balanced.lives}`);
  assert.equal(balanced.stats.wavesCleared, 30);
});

test('T4: the balanced bot loses no lives in waves 1-3', () => {
  assert.deepEqual(lossesByWave(balanced).slice(0, 3), [0, 0, 0]);
});

test("T5': the balanced bot loses lives in at least 2 distinct waves (relaxed from 3 waves / 60% share, see the header)", () => {
  const losses = lossesByWave(balanced);
  assert.ok(losses.filter((n) => n > 0).length >= 2, `loss waves: ${losses.map((n, i) => (n ? `${i + 1}:${n}` : '')).filter(Boolean).join(' ')}`);
});

test('T6: the balanced bot needs between 10 and 45 game minutes', () => {
  console.log(`# balanced bot: ${balanced.minutes.toFixed(1)} min, ${balanced.lives} lives left (aim: 18-26 min)`);
  assert.ok(balanced.minutes >= 10 && balanced.minutes <= 45, `${balanced.minutes} min`);
});

test("T7': among seeds 2-5 at least 3 win with 1-14 lives left, and any seed that loses does so at wave 20 or later", () => {
  const wins = otherSeeds.filter(([, r]) => r.result === 'won' && r.lives >= 1 && r.lives <= 14);
  assert.ok(wins.length >= 3, `wins: ${otherSeeds.map(([s, r]) => `${s}:${r.result[0]}${r.wave}/${r.lives}L`).join(' ')}`);
  for (const [seed, r] of otherSeeds) if (r.result !== 'won') assert.ok(r.wave >= 20, `seed ${seed} lost at wave ${r.wave}`);
});

test('the playthrough is deterministic', () => {
  const again = run('balanced');
  assert.deepEqual(again, balanced);
});
