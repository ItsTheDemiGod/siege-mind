// Static vs Adaptive vs Random comparison over bots and seeds (a small preview of the Phase 8 harness).
// CLI: npm run compare -- --bots=weak,monoMortar,monoSniper,balanced --modes=static,adaptive,random --seeds=1,2,3 --waves=15
// The hypotheses are REPORTED, never asserted and never used to tune the Director.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/data/config.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { l1Distance } from '../src/sim/directorMath.js';
import { playGame } from './playthrough.js';
import { getBot } from './bots.js';
import { table } from './summarize.js';

const SIGNIFICANT_TILT = 1.15;
const DEFAULT_BOTS = ['weak', 'monoMortar', 'monoSniper', 'balanced'];
const DEFAULT_MODES = ['static', 'adaptive', 'random'];

const mean = (xs) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);
const f = (x, d = 2) => (x === null || x === undefined ? '-' : x.toFixed(d));

/**
 * Play every combination.
 * @param {{bots?: string[], modes?: string[], seeds?: number[], waves?: 15|30}} [o]
 * @returns {object[]} rows { bot, mode, seed, result, wave, lives, minutes, livesLostByWave, finalScores, finalTilt, meanShift }
 */
export function runCompare({ bots = DEFAULT_BOTS, modes = DEFAULT_MODES, seeds = [1, 2, 3], waves = 15 } = {}) {
  const rows = [];
  for (const bot of bots) {
    for (const mode of modes) {
      for (const seed of seeds) {
        const r = playGame({ seed, totalWaves: waves, bot: getBot(bot), mode, telemetry: 'summary' });
        const shifts = r.run.waves.filter((w) => w.director && w.director.eligible).map((w) => l1Distance(w.director.finalShares, w.director.templateShares));
        rows.push({
          bot, mode, seed, result: r.result, wave: r.wave, lives: r.lives, minutes: r.minutes, livesLostByWave: r.perWave.map((w) => w.livesLost),
          finalScores: r.director ? r.director.scores : null, finalTilt: r.director ? r.director.tilt : null, meanShift: shifts.length ? mean(shifts) : null,
        });
      }
    }
  }
  return rows;
}

const lost = (r) => config.game.startLives - r.lives; // includes the lives lost in the wave that ended a lost game
const select = (rows, bot, mode) => rows.filter((r) => r.bot === bot && r.mode === mode);
const uniq = (xs) => [...new Set(xs)];

/** Per-group means used by the tables and the hypotheses. */
function stats(rows, bot, mode) {
  const g = select(rows, bot, mode);
  if (g.length === 0) return null;
  return {
    n: g.length, wave: mean(g.map((r) => r.wave)), lives: mean(g.map((r) => r.lives)), lost: mean(g.map(lost)), minutes: mean(g.map((r) => r.minutes)),
    wins: g.filter((r) => r.result === 'won').length, shift: g[0].meanShift === null ? null : mean(g.map((r) => r.meanShift)),
    tilt: g[0].finalTilt ? Object.fromEntries(ENEMY_ORDER.map((t) => [t, mean(g.map((r) => r.finalTilt[t]))])) : null,
  };
}

/**
 * @param {object[]} rows from runCompare @returns {{id: string, text: string, pass: boolean|null, detail: string}[]} report-only hypotheses
 */
export function evaluateHypotheses(rows) {
  const tiltOf = (bot, type) => stats(rows, bot, 'adaptive')?.tilt?.[type] ?? null;
  const tiltTest = (id, text, bot, types) => {
    const v = types.map((t) => tiltOf(bot, t));
    if (v.some((x) => x === null)) return { id, text, pass: null, detail: 'no data' };
    return { id, text, pass: v.some((x) => x > SIGNIFICANT_TILT), detail: types.map((t, i) => `${t} tilt ${f(v[i])}`).join(', ') };
  };
  const bots = uniq(rows.map((r) => r.bot));
  const h5 = bots.map((b) => ({ b, a: stats(rows, b, 'adaptive'), s: stats(rows, b, 'static') })).filter((x) => x.a && x.s);
  const h5pass = h5.length > 0 && h5.every((x) => x.a.lost >= x.s.lost && x.a.wave <= x.s.wave);
  const h6 = DEFAULT_BOTS.map((b) => ({ b, a: stats(rows, b, 'adaptive'), r: stats(rows, b, 'random') })).filter((x) => x.a && x.r);
  const h6count = h6.filter((x) => x.a.lost >= x.r.lost).length;
  return [
    tiltTest('H1', 'weak (adaptive): swarmling tilt exceeds 1.15', 'weak', ['swarmling']),
    tiltTest('H2', 'monoMortar (adaptive): fastRunner tilt exceeds 1.15', 'monoMortar', ['fastRunner']),
    tiltTest('H3', 'monoSniper (adaptive): swarmling or fastRunner tilt exceeds 1.15', 'monoSniper', ['swarmling', 'fastRunner']),
    tiltTest('H4', 'balanced (adaptive): shieldedBruiser or regenerator tilt exceeds 1.15', 'balanced', ['shieldedBruiser', 'regenerator']),
    {
      id: 'H5', text: 'every bot: mean lives lost (adaptive) >= static and mean final wave (adaptive) <= static', pass: h5.length ? h5pass : null,
      detail: h5.length ? h5.map((x) => `${x.b} lost ${f(x.a.lost, 1)} vs ${f(x.s.lost, 1)}, wave ${f(x.a.wave, 1)} vs ${f(x.s.wave, 1)}`).join('; ') : 'no data',
    },
    {
      id: 'H6', text: 'at least 3 of the 4 bots: mean lives lost (adaptive) >= random', pass: h6.length === DEFAULT_BOTS.length ? h6count >= 3 : null, // N/A unless all 4 bots were run
      detail: h6.length ? `${h6.length < DEFAULT_BOTS.length ? `needs all ${DEFAULT_BOTS.length} bots, have ${h6.length}; ` : ''}${h6count} of ${h6.length}: ${h6.map((x) => `${x.b} ${f(x.a.lost, 1)} vs ${f(x.r.lost, 1)}`).join('; ')}` : 'no data',
    },
  ];
}

/** @param {{id: string, text: string, pass: boolean|null, detail: string}[]} results @returns {string} */
export function formatHypotheses(results) {
  const lines = ['Hypotheses (report only, never used to tune)'];
  for (const r of results) lines.push(`${r.pass === null ? 'N/A ' : r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.text}\n        ${r.detail}`);
  return lines.join('\n');
}

/** @param {object[]} rows @returns {string} aligned plain-text report (three tables and the hypotheses) */
export function formatCompare(rows) {
  const bots = uniq(rows.map((r) => r.bot));
  const modes = uniq(rows.map((r) => r.mode));
  const t1 = [];
  for (const bot of bots) {
    for (const mode of modes) {
      const s = stats(rows, bot, mode);
      if (s) t1.push([bot, mode, s.n, `${s.wins}/${s.n}`, f(s.wave, 1), f(s.lives, 1), f(s.lost, 1), f(s.minutes, 1)]);
    }
  }
  const t2 = [];
  for (const bot of bots) {
    const s = stats(rows, bot, 'adaptive');
    if (s) t2.push([bot, ...ENEMY_ORDER.map((t) => f(s.tilt[t])), f(s.shift, 3)]);
  }
  const t3 = [];
  for (const bot of bots) {
    const a = stats(rows, bot, 'adaptive');
    for (const other of ['static', 'random']) {
      const o = stats(rows, bot, other);
      if (a && o) t3.push([bot, `adaptive - ${other}`, f(a.lost - o.lost, 1), f(a.wave - o.wave, 1), f(a.lives - o.lives, 1), f(a.minutes - o.minutes, 1)]);
    }
  }
  return [
    table('Mean over seeds per bot and mode', ['bot', 'mode', 'seeds', 'wins', 'finalWave', 'livesLeft', 'livesLost', 'minutes'], t1),
    table('Adaptive: final tilt per enemy type (mean over seeds) and mean share shift', ['bot', ...ENEMY_ORDER, 'meanShift'], t2),
    table('Director versus the controls (differences of the means)', ['bot', 'comparison', 'livesLost', 'finalWave', 'livesLeft', 'minutes'], t3),
    formatHypotheses(evaluateHypotheses(rows)),
    '',
  ].join('\n\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name, def) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${def}`).split('=')[1];
  const list = (s) => s.split(',').filter(Boolean);
  const bots = list(arg('bots', DEFAULT_BOTS.join(',')));
  const modes = list(arg('modes', DEFAULT_MODES.join(',')));
  const seeds = list(arg('seeds', '1,2,3')).map(Number);
  const waves = Number(arg('waves', 15));
  const t0 = performance.now();
  const rows = runCompare({ bots, modes, seeds, waves });
  process.stdout.write(formatCompare(rows));
  const dir = resolve('experiments/results');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'compare.json'), JSON.stringify(rows, null, 1));
  console.log(`${rows.length} games in ${((performance.now() - t0) / 1000).toFixed(1)} s; rows written to experiments/results/compare.json`);
}
