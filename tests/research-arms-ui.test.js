// UI-side behavior of the Phase 9A-2a research arms (adaptive2, counter): URL parsing, labels, chart weights, overlay titles, report, preview refresh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { TOWERS, TOWER_ORDER } from '../src/data/towers.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { tiltFromScores } from '../src/sim/directorMath.js';
import { parseModeParam } from '../src/ui/menuState.js';
import { modeLabel, endScreenRows } from '../src/ui/format.js';
import { chartTilt, buildDirectorView, tiltMaxOf } from '../src/ui/directorView.js';
import { buildDirectorReport, reportFootnote } from '../src/ui/directorReport.js';
import { previewKey, loadoutEvents } from '../src/ui/previewRefresh.js';

const shares = (o) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, o[t] ?? 0]));
const ones = shares(Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1])));

test('parseModeParam accepts the research arms with the same trimming and case rules', () => {
  const table = [['adaptive2', true, 'adaptive2'], [' Adaptive2 ', true, 'adaptive2'], ['COUNTER', true, 'counter'], ['counter', true, 'counter'],
    ['adaptive 2', false, 'static'], ['counter2', false, 'static'], ['adaptive3', false, 'static'], ['adaptive', true, 'adaptive'], ['hard', false, 'static']];
  for (const [input, ok, mode] of table) assert.deepEqual(parseModeParam(input), { ok, mode }, String(input));
});

test('research arm labels and the end screen mode row', () => {
  assert.equal(modeLabel('adaptive2'), 'Adaptive v2 (research)');
  assert.equal(modeLabel('counter'), 'Counter arm (research)');
  assert.equal(modeLabel('adaptive'), 'Adaptive');
  assert.equal(modeLabel('nonsense'), 'Static');
  const rows = (mode, totalWaves) => endScreenRows({ result: 'won', lives: 5, tick: 600, stats: { kills: 1, leaks: 0, goldEarned: 0, goldSpent: 0 }, mode, totalWaves });
  assert.equal(rows('adaptive2', 15).find((r) => r.label === 'Mode').value, 'Adaptive v2 (research) · Quick (15 waves)');
  assert.equal(rows('counter', 15).find((r) => r.label === 'Mode').value, 'Counter arm (research) · Quick (15 waves)');
});

test('chartTilt: adaptive2 uses the v2 config on the scores, counter plots the applied tilt; titles and tilt limits per arm', () => {
  const scores = { armoredGrunt: -0.5, swarmling: 0.25, fastRunner: 0, regenerator: 4, shieldedBruiser: -9 };
  assert.deepEqual(chartTilt({ mode: 'adaptive2', scores, tilt: ones }), tiltFromScores(scores, config.directorV2));
  const custom = { ...config.directorV2, beta: 0.5, tiltMax: 2 };
  const t = chartTilt({ mode: 'adaptive2', scores, tilt: ones }, config.director, custom);
  assert.deepEqual([t.armoredGrunt, t.swarmling, t.regenerator, t.shieldedBruiser], [0.75, 1.125, 2, 0.5]); // 1 + 0.5 * score, clamped to [1/2, 2]
  const applied = { ...ones, swarmling: 1.9, armoredGrunt: 1 / 3 };
  assert.deepEqual(chartTilt({ mode: 'counter', scores: ones, tilt: applied }), applied);
  assert.notEqual(chartTilt({ mode: 'counter', scores: ones, tilt: applied }), applied, 'a copy');
  assert.deepEqual([tiltMaxOf('adaptive'), tiltMaxOf('adaptive2'), tiltMaxOf('counter'), tiltMaxOf('random')], [config.director.tiltMax, config.directorV2.tiltMax, config.counter.tiltMax, config.director.tiltMax]);
  const decision = (mode) => ({ mode, wave: 9, reason: 'adapted', eligible: true, basedOnWave: 8, tilt: applied, templateShares: shares({ armoredGrunt: 1 }), finalShares: shares({ armoredGrunt: 1 }), scores, lines: [], observed: {} });
  assert.deepEqual(['adaptive', 'random', 'adaptive2', 'counter'].map((m) => buildDirectorView(decision(m), { tiltMax: 3 }).title), ['Director', 'Random control', 'Director v2', 'Counter arm']);
});

const names = Object.fromEntries(ENEMY_ORDER.map((t) => [t, { name: ENEMIES[t].name }]));
const towers = Object.fromEntries(TOWER_ORDER.map((t) => [t, { name: TOWERS[t].name, weakVs: [...TOWERS[t].weakVs] }]));
const decisionFor = (wave, { reason = 'adapted', eligible = true, scores = shares({}), mode, tilt = shares({}) }) => ({
  version: 2, wave, mode, eligible, reason, templateShares: shares({ armoredGrunt: 0.5, swarmling: 0.5 }), tilt, finalShares: shares({ armoredGrunt: 0.5, swarmling: 0.5 }), picks: shares({}), scores, lines: [],
});
const byType = (leaked = {}) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, { spawned: 10, killed: 10 - (leaked[t] ?? 0), leaked: leaked[t] ?? 0, progressSum: 5 + (leaked[t] ?? 0) }]));
const waveRec = (n, { director, livesLost = 0, leaked = {} }) => ({ wave: n, name: null, livesLost, byType: byType(leaked), director });
const miniRun = ({ mode, waves, damage = { lance: 100, mortar: 600 } }) => ({
  meta: { mode, totalWaves: 15, detail: 'summary' }, result: { result: 'won' }, definitions: { enemies: names, towers },
  totals: { damageBySource: Object.fromEntries([...TOWER_ORDER, 'debug', 'other'].map((t) => [t, damage[t] ?? 0])) }, waves,
});

test('the report treats adaptive2 like adaptive (v2 config, tank caveat) and gives the counter arm one fixed line instead of insights 1, 2 and 5', () => {
  const scores = { armoredGrunt: -0.5, swarmling: 0.2, fastRunner: 0.4, regenerator: 0.1, shieldedBruiser: -0.3 };
  const r2 = buildDirectorReport(miniRun({ mode: 'adaptive2', waves: [waveRec(5, { director: decisionFor(5, { scores, mode: 'adaptive2' }) })] }));
  assert.equal(r2.available, true);
  assert.equal(r2.headline, 'Adaptive v2 (research) · Quick (15 waves) · Victory');
  assert.ok(r2.insights[0].startsWith('The Director leaned on Fast Runner'), r2.insights[0]);
  assert.ok(r2.insights.some((l) => l.startsWith('It backed off Armored Grunt')));
  assert.ok(r2.insights.some((l) => /^On average \d+% of each adapted wave's threat moved/.test(l)));
  assert.ok(Math.abs(r2.rows.find((x) => x.type === 'fastRunner').finalTilt - (1 + config.directorV2.beta * 0.4)) < 1e-12);
  assert.ok(reportFootnote('adaptive2').includes('Tanky enemy types') && !reportFootnote('counter').includes('Tanky') && !reportFootnote('random').includes('Tanky'));
  const early = buildDirectorReport(miniRun({ mode: 'adaptive2', waves: [waveRec(2, { director: decisionFor(2, { reason: 'static-early', eligible: false, mode: 'adaptive2' }) })] }));
  assert.ok(early.insights[0].includes(`wave ${config.directorV2.firstAdaptiveWave}`));

  const tilt = shares({ armoredGrunt: 1, swarmling: 1.9, fastRunner: 1, regenerator: 1, shieldedBruiser: 0.7 });
  const rc = buildDirectorReport(miniRun({ mode: 'counter', waves: [waveRec(9, { director: decisionFor(9, { mode: 'counter', tilt }), livesLost: 3, leaked: { swarmling: 3 } })] }));
  assert.equal(rc.available, true);
  assert.equal(rc.headline, 'Counter arm (research) · Quick (15 waves) · Victory');
  assert.equal(rc.insights[0], 'This run used the informed counter arm: enemy weights were set from your tower loadout, not learned.');
  assert.ok(!rc.insights.some((l) => /leaned on|backed off|On average/.test(l)));
  assert.ok(rc.insights.some((l) => l.startsWith('Toughest wave: wave 9')));
  assert.ok(rc.insights.some((l) => l.startsWith('Mortar dealt')));
  assert.equal(rc.rows.find((x) => x.type === 'swarmling').finalTilt, 1.9);
});

test('the preview refreshes on tower events in counter mode only, and its key carries the loadout there', () => {
  assert.deepEqual(loadoutEvents('counter'), [EVENT_TYPES.TOWER_PLACED, EVENT_TYPES.TOWER_SOLD, EVENT_TYPES.TOWER_UPGRADED]);
  for (const m of ['static', 'adaptive', 'random', 'adaptive2']) assert.deepEqual(loadoutEvents(m), [], m);
  const game = (mode, list = []) => ({ mode, towers: list, waves: { phase: 'intermission' } });
  const p = { wave: 7 };
  assert.equal(previewKey(game('counter'), null), 'none');
  assert.equal(previewKey(game('static'), p), '7|intermission');
  assert.equal(previewKey(game('adaptive2', [{ type: 'lance', level: 0 }]), p), '7|intermission');
  const a = previewKey(game('counter', [{ type: 'lance', level: 0 }, { type: 'mortar', level: 1 }]), p);
  assert.equal(a, '7|intermission|lance0,mortar1');
  assert.equal(previewKey(game('counter', [{ type: 'mortar', level: 1 }, { type: 'lance', level: 0 }]), p), a, 'order does not matter');
  assert.notEqual(previewKey(game('counter', [{ type: 'lance', level: 1 }, { type: 'mortar', level: 1 }]), p), a, 'an upgrade changes the key');
  assert.notEqual(previewKey(game('counter', [{ type: 'lance', level: 0 }]), p), a, 'a sale changes the key');
});
