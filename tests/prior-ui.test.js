// UI-side behavior of the prior control arm (URL only, not in the menu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { TOWERS, TOWER_ORDER } from '../src/data/towers.js';
import { MODES } from '../src/data/menuText.js';
import { parseModeParam } from '../src/ui/menuState.js';
import { modeLabel, endScreenRows } from '../src/ui/format.js';
import { chartTilt, buildDirectorView, directionByType, tiltMaxOf } from '../src/ui/directorView.js';
import { buildDirectorReport, reportFootnote } from '../src/ui/directorReport.js';
import { describeBanner, DIRECTOR_LINE } from '../src/ui/bannerState.js';

const shares = (o) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, o[t] ?? 0]));
const ones = shares(Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1])));

test('parseModeParam accepts prior (URL only) and the menu does not list it', () => {
  const table = [['prior', true, 'prior'], [' PRIOR ', true, 'prior'], ['priors', false, 'static'], ['pri or', false, 'static'], ['counter', true, 'counter']];
  for (const [input, ok, mode] of table) assert.deepEqual(parseModeParam(input), { ok, mode }, String(input));
  assert.ok(!MODES.some((m) => m.id === 'prior'));
});

test('label and end screen mode row', () => {
  assert.equal(modeLabel('prior'), 'Prior control (research)');
  const rows = endScreenRows({ result: 'won', lives: 5, tick: 600, stats: { kills: 1, leaks: 0, goldEarned: 0, goldSpent: 0 }, mode: 'prior', totalWaves: 15 });
  assert.equal(rows.find((r) => r.label === 'Mode').value, 'Prior control (research) · Quick (15 waves)');
});

test('chartTilt plots the applied tilt, the overlay title and bar limit are the prior arm\'s, marks and the violet line show for prior', () => {
  const applied = { ...ones, armoredGrunt: 0.6, regenerator: 1.4 };
  assert.deepEqual(chartTilt({ mode: 'prior', scores: shares({}), tilt: applied }), applied);
  assert.equal(tiltMaxOf('prior'), config.prior.tiltMax);
  const decision = { mode: 'prior', wave: 9, reason: 'prior', eligible: true, basedOnWave: 0, tilt: applied, templateShares: shares({ armoredGrunt: 1 }), finalShares: shares({ armoredGrunt: 1 }), scores: shares({}), lines: [], observed: {} };
  assert.equal(buildDirectorView(decision, { tiltMax: 3 }).title, 'Prior control');
  assert.deepEqual(directionByType(decision), { armoredGrunt: 'down', swarmling: 'flat', fastRunner: 'flat', regenerator: 'up', shieldedBruiser: 'flat' });
  assert.ok(Object.values(directionByType({ ...decision, reason: 'random' })).every((d) => d === 'flat'), 'random still shows no marks');
  assert.ok(Object.values(directionByType({ ...decision, reason: 'static-fixed' })).every((d) => d === 'flat'));
  const started = (reason) => describeBanner({ wave: 9, name: null, fixed: false, composition: { armoredGrunt: 5 }, hpMult: 2, director: { reason } }, 15).directorLine;
  assert.equal(started('prior'), DIRECTOR_LINE);
  assert.equal(started('adapted'), DIRECTOR_LINE);
  assert.equal(started('random'), null);
  assert.equal(started('cold-start'), null);
});

test('the report gives the prior control one fixed line instead of insights 1, 2 and 5 and the random footnote', () => {
  const names = Object.fromEntries(ENEMY_ORDER.map((t) => [t, { name: ENEMIES[t].name }]));
  const towers = Object.fromEntries(TOWER_ORDER.map((t) => [t, { name: TOWERS[t].name, weakVs: [...TOWERS[t].weakVs] }]));
  const byType = Object.fromEntries(ENEMY_ORDER.map((t) => [t, { spawned: 10, killed: 8, leaked: 2, progressSum: 7 }]));
  const director = { version: 2, wave: 9, mode: 'prior', eligible: true, reason: 'prior', templateShares: shares({ armoredGrunt: 0.5, swarmling: 0.5 }), tilt: { ...ones, armoredGrunt: 0.6 }, finalShares: shares({ armoredGrunt: 0.4, swarmling: 0.6 }), picks: shares({}), scores: shares({}), lines: [] };
  const run = { meta: { mode: 'prior', totalWaves: 15, detail: 'summary' }, result: { result: 'won' }, definitions: { enemies: names, towers },
    totals: { damageBySource: Object.fromEntries([...TOWER_ORDER, 'debug', 'other'].map((t) => [t, t === 'mortar' ? 600 : t === 'lance' ? 100 : 0])) }, waves: [{ wave: 9, name: null, livesLost: 3, byType, director }] };
  const r = buildDirectorReport(run);
  assert.equal(r.available, true);
  assert.equal(r.headline, 'Prior control (research) · Quick (15 waves) · Victory');
  assert.equal(r.insights[0], 'This run used the prior control: enemy weights came from static baselines (enemy durability), not from your defense.');
  assert.ok(!r.insights.some((l) => /leaned on|backed off|On average/.test(l)));
  assert.ok(r.insights.some((l) => l.startsWith('Toughest wave: wave 9')));
  assert.equal(r.rows.find((x) => x.type === 'armoredGrunt').finalTilt, 0.6);
  assert.equal(reportFootnote('prior'), reportFootnote('random'));
});
