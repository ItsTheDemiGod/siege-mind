import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { TOWERS, TOWER_ORDER } from '../src/data/towers.js';
import { isAdaptiveEligible } from '../src/data/waves.js';
import { buildDirectorReport, decisionShift } from '../src/ui/directorReport.js';
import { playGame } from '../experiments/playthrough.js';
import { getBot } from '../experiments/bots.js';

const shares = (o) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, o[t] ?? 0]));
const zeroScores = shares({});
const names = Object.fromEntries(ENEMY_ORDER.map((t) => [t, { name: ENEMIES[t].name }]));
const towers = Object.fromEntries(TOWER_ORDER.map((t) => [t, { name: TOWERS[t].name, weakVs: [...TOWERS[t].weakVs] }]));

function decision(wave, { reason = 'adapted', eligible = true, template, final, scores = zeroScores, mode = 'adaptive' } = {}) {
  return { version: 1, wave, mode, eligible, reason, templateShares: shares(template ?? { armoredGrunt: 0.5, swarmling: 0.5 }), tilt: shares({}), finalShares: shares(final ?? { armoredGrunt: 0.5, swarmling: 0.5 }), picks: shares({}), scores, lines: [] };
}
const byType = (leaked = {}) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, { spawned: 10, killed: 10 - (leaked[t] ?? 0), leaked: leaked[t] ?? 0, progressSum: 5 + (leaked[t] ?? 0) }]));
function wave(n, { director, livesLost = 0, leaked = {}, name = null } = {}) {
  return { wave: n, name, livesLost, byType: byType(leaked), director };
}
function miniRun({ mode = 'adaptive', waves, damage = { lance: 100, mortar: 600 }, result = 'won', totalWaves = 15 } = {}) {
  return {
    meta: { mode, totalWaves, detail: 'summary' }, result: { result }, definitions: { enemies: names, towers },
    totals: { damageBySource: Object.fromEntries([...TOWER_ORDER, 'debug', 'other'].map((t) => [t, damage[t] ?? 0])) }, waves,
  };
}

test('decisionShift is half the L1 distance', () => {
  const d = decision(5, { final: { armoredGrunt: 0.4, swarmling: 0.6 } });
  assert.ok(Math.abs(decisionShift(d) - 0.1) < 1e-12);
});

test('the full adaptive report: exact insights, ordering, tie rules and the cap of five', () => {
  const scores = { armoredGrunt: -0.5, swarmling: 0.2, fastRunner: 0.4, regenerator: 0.1, shieldedBruiser: -0.3 };
  const run = miniRun({ waves: [wave(5, { director: decision(5, { scores }) })] });
  const r = buildDirectorReport(run);
  assert.equal(r.available, true);
  assert.equal(r.title, "Director's Report");
  assert.equal(r.headline, 'Adaptive · Quick (15 waves) · Victory');
  assert.deepEqual(r.insights, [
    'The Director leaned on Fast Runner (weight ×1.40): it earned the most threat-adjusted progress against your defense.',
    'The Director leaned on Swarmling (weight ×1.20): it earned the most threat-adjusted progress against your defense.',
    'It backed off Armored Grunt (weight ×0.50): your towers stopped them early.',
    'It backed off Shielded Bruiser (weight ×0.70): your towers stopped them early.',
    'Mortar dealt 86% of your damage. The Director pushed Fast Runner, which Mortar handles poorly.',
  ]);
  assert.equal(r.insights.length, config.report.maxInsights);
});

test('one pushed type, the weakness append, toughest wave with ties, and the shift percentage', () => {
  const scores = { ...zeroScores, fastRunner: 0.4 };
  const run = miniRun({
    waves: [
      wave(5, { director: decision(5, { scores, final: { armoredGrunt: 0.4, swarmling: 0.6 } }) }),
      wave(6, { director: decision(6, { reason: 'static-intro', eligible: false, scores }), livesLost: 4, leaked: { armoredGrunt: 3, swarmling: 1 }, name: 'First' }),
      wave(7, { director: decision(7, { scores, final: { armoredGrunt: 0.2, swarmling: 0.8 } }), livesLost: 4, leaked: { swarmling: 4 }, name: 'Second' }),
    ],
  });
  const r = buildDirectorReport(run);
  assert.deepEqual(r.stats, { eligible: 2, adapted: 2, meanShift: r.stats.meanShift });
  assert.ok(Math.abs(r.stats.meanShift - 0.2) < 1e-12);
  assert.deepEqual(r.insights, [
    'The Director leaned on Fast Runner (weight ×1.40): it earned the most threat-adjusted progress against your defense.',
    'Mortar dealt 86% of your damage. The Director pushed Fast Runner, which Mortar handles poorly.',
    'Toughest wave: wave 6 · First — 4 lives lost, mostly to Armored Grunt leaks.',
    "On average 20% of each adapted wave's threat moved to different enemy types.",
  ]);
  assert.deepEqual(r.toughest, { wave: 6, name: 'First', livesLost: 4, topLeaker: 'armoredGrunt' });
});

test('no weakness append when the pushed type is not a weakness of the top tower; top share below the threshold gives no damage line', () => {
  const scores = { ...zeroScores, swarmling: 0.4 }; // Mortar is strong against swarmlings
  const run = miniRun({ waves: [wave(5, { director: decision(5, { scores }) })] });
  assert.ok(run.waves.length === 1);
  const r = buildDirectorReport(run);
  assert.equal(r.insights[1], 'Mortar dealt 86% of your damage.');
  const even = miniRun({ waves: [wave(5, { director: decision(5, { scores }) })], damage: { lance: 100, mortar: 100, frost: 100, poison: 100, sniper: 100 } });
  const e = buildDirectorReport(even);
  assert.ok(e.insights.every((t) => !/dealt/.test(t)));
  const none = buildDirectorReport(miniRun({ waves: [wave(5, { director: decision(5, { scores }) })], damage: {} }));
  assert.ok(none.insights.every((t) => !/dealt/.test(t)));
});

test('no lives lost, toughest without a name or leaker', () => {
  const run = miniRun({ waves: [wave(5, { director: decision(5, { scores: { ...zeroScores, swarmling: 0.4 } }) })] });
  assert.ok(buildDirectorReport(run).insights.includes('No lives were lost.'));
  assert.equal(buildDirectorReport(run).toughest, null);
  const odd = miniRun({ waves: [wave(5, { director: decision(5, { scores: zeroScores }), livesLost: 2 })] });
  const t = buildDirectorReport(odd);
  assert.deepEqual(t.toughest, { wave: 5, name: null, livesLost: 2, topLeaker: null });
  assert.ok(t.insights.includes('Toughest wave: wave 5 — 2 lives lost.'));
});

test('adaptive without evidence: one line replaces insights 1, 2 and 5', () => {
  const run = miniRun({ waves: [wave(3, { director: decision(3, { reason: 'static-early', eligible: false }) }), wave(4, { director: decision(4, { reason: 'cold-start' }) })], result: 'lost' });
  const r = buildDirectorReport(run);
  assert.equal(r.stats.adapted, 0);
  assert.equal(r.headline, 'Adaptive · Quick (15 waves) · Defeat');
  assert.deepEqual(r.insights, [
    `The Director had no evidence to act on yet (it starts adapting at wave ${config.director.firstAdaptiveWave}).`,
    'Mortar dealt 86% of your damage.',
    'No lives were lost.',
  ]);
});

test('the random control and the static case', () => {
  const rnd = buildDirectorReport(miniRun({ mode: 'random', totalWaves: 30, result: null, waves: [wave(5, { director: decision(5, { reason: 'random', mode: 'random' }) })] }));
  assert.equal(rnd.available, true);
  assert.equal(rnd.headline, 'Random control · Full (30 waves) · In progress');
  assert.equal(rnd.insights[0], 'This run used the random control: enemy weights were random and ignored how your defense performed.');
  assert.ok(rnd.insights.every((t) => !/leaned|backed off|On average/.test(t)));
  assert.ok(rnd.rows.every((r) => r.finalTilt === 1));
  const stat = buildDirectorReport(miniRun({ mode: 'static', waves: [wave(5, { director: null })] }));
  assert.deepEqual([stat.available, stat.reason, stat.insights, stat.entries, stat.rows, stat.damage, stat.toughest], [false, 'static', [], [], [], [], null]);
});

test('rows aggregate the waves and damage shares are ordered by tower', () => {
  const run = miniRun({ waves: [wave(5, { director: decision(5), leaked: { regenerator: 2 } }), wave(6, { director: decision(6), leaked: { regenerator: 1 } })] });
  const r = buildDirectorReport(run);
  const reg = r.rows.find((x) => x.type === 'regenerator');
  assert.deepEqual([reg.spawned, reg.killed, reg.leaked], [20, 17, 3]);
  assert.ok(Math.abs(reg.leakRate - 0.15) < 1e-12);
  assert.ok(Math.abs(reg.meanProgress - (5 + 2 + 5 + 1) / 20) < 1e-12);
  assert.deepEqual(r.rows.map((x) => x.type), [...ENEMY_ORDER]);
  assert.deepEqual(r.damage.map((d) => d.type), [...TOWER_ORDER]);
  assert.ok(Math.abs(r.damage.reduce((n, d) => n + d.share, 0) - 1) < 1e-12);
  assert.equal(r.rows[0].label, 'Armored Grunt');
});

// ---------- a real run ----------
const play = () => playGame({ seed: 1, totalWaves: 15, bot: getBot('balanced'), mode: 'adaptive', telemetry: 'summary' }).run;
const real = play();

test('a real adaptive run gives a sensible, deterministic report', () => {
  const r = buildDirectorReport(real);
  assert.equal(r.available, true);
  assert.ok(r.insights.length >= 1 && r.insights.length <= config.report.maxInsights);
  for (const t of r.insights) assert.ok(typeof t === 'string' && t.length > 0 && !/undefined|NaN/.test(t), t);
  const eligibleWaves = Array.from({ length: 11 }, (_, i) => i + 5).filter((w) => isAdaptiveEligible(w, config.director));
  assert.equal(r.stats.eligible, eligibleWaves.length);
  assert.ok(r.stats.adapted >= 1);
  assert.deepEqual(buildDirectorReport(real), r);
  assert.deepEqual(buildDirectorReport(play()), r);
  assert.equal(r.entries.length, 15);
  assert.equal(r.headline, 'Adaptive · Quick (15 waves) · Victory');
});
