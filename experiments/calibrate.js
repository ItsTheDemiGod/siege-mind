// Calibration of the style bots' baseline strength: STATIC mode only, on the calibration seeds, never on adaptive or random results.
// The rule is fixed in advance (docs/EXPERIMENT.md): a mean win rate inside a window, no style too weak, closest to a target.
import { playGame } from './playthrough.js';
import { createStyleBot } from './styleBots.js';
import { PROTOCOL, seedsOf } from './protocol.js';
import { mean } from './stats.js';

export const CONSTRAINTS = Object.freeze({ meanMin: 0.5, meanMax: 0.9, perStyleMin: 0.2, target: 0.7 });
const TILE_POOLS = [1, 3, 6];
const FOCUS_WEIGHTS = [0.3, 0.4, 0.5];
const EPS = 1e-12;

/**
 * @param {1|2} stage 1: tilePool x focusWeight with upgradeAfter 6 (9 combinations); 2: the same pairs with upgradeAfter 4 and 8 (18 more)
 * @returns {{tilePool: number, focusWeight: number, upgradeAfter: number}[]}
 */
export function calibrationGrid(stage) {
  if (stage !== 1 && stage !== 2) throw new RangeError(`stage must be 1 or 2, got ${String(stage)}`);
  const afters = stage === 1 ? [6] : [4, 8];
  return afters.flatMap((upgradeAfter) => TILE_POOLS.flatMap((tilePool) => FOCUS_WEIGHTS.map((focusWeight) => ({ tilePool, focusWeight, upgradeAfter }))));
}

/**
 * Pick the knob set to use. Pure; does not mutate its inputs.
 * @param {{knobs: {tilePool: number, focusWeight: number, upgradeAfter: number}, perStyleWinRate: Record<string, number>, meanWinRate: number}[]} results
 * @param {{meanMin: number, meanMax: number, perStyleMin: number, target: number}} constraints
 * @returns {object|null} the chosen result (knobs inside), or null when none qualifies
 */
export function chooseKnobs(results, constraints) {
  const ok = results.filter((r) => r.meanWinRate >= constraints.meanMin && r.meanWinRate <= constraints.meanMax
    && Object.values(r.perStyleWinRate).every((v) => v >= constraints.perStyleMin));
  if (ok.length === 0) return null;
  const gap = (r) => Math.abs(r.meanWinRate - constraints.target);
  return [...ok].sort((a, b) => {
    if (Math.abs(gap(a) - gap(b)) > EPS) return gap(a) - gap(b);
    return b.knobs.tilePool - a.knobs.tilePool || a.knobs.focusWeight - b.knobs.focusWeight || a.knobs.upgradeAfter - b.knobs.upgradeAfter;
  })[0];
}

/**
 * Play every combination in STATIC mode on the calibration seeds for every style.
 * @param {{combos: object[], onProgress?: (done: number, total: number) => void, playGameFn?: Function}} o
 * @returns {{knobs: object, perStyleWinRate: Record<string, number>, perStyleLivesLost: Record<string, number>, meanWinRate: number, meanLivesLost: number}[]}
 */
export function runCalibration({ combos, onProgress = () => {}, playGameFn = playGame }) {
  const seeds = seedsOf('calibration');
  const out = [];
  combos.forEach((knobs, i) => {
    const wins = {};
    const lost = {};
    for (const style of PROTOCOL.styles) {
      const games = seeds.map((seed) => playGameFn({ seed, bot: createStyleBot(style, knobs), mode: 'static', totalWaves: PROTOCOL.waves }));
      wins[style] = mean(games.map((g) => (g.result === 'won' ? 1 : 0)));
      lost[style] = mean(games.map((g) => PROTOCOL.startLives - g.lives));
    }
    out.push({ knobs, perStyleWinRate: wins, perStyleLivesLost: lost, meanWinRate: mean(Object.values(wins)), meanLivesLost: mean(Object.values(lost)) });
    onProgress(i + 1, combos.length);
  });
  return out;
}

/** @param {object[]} results @param {object|null} chosen @returns {string} markdown table of every combination */
export function calibrationMarkdown(results, chosen) {
  const styles = PROTOCOL.styles;
  const q = (r) => (r.meanWinRate >= CONSTRAINTS.meanMin && r.meanWinRate <= CONSTRAINTS.meanMax && Object.values(r.perStyleWinRate).every((v) => v >= CONSTRAINTS.perStyleMin) ? 'yes' : 'no');
  const lines = ['# Bot calibration (static mode, calibration seeds)', '',
    `Rule: mean win rate in [${CONSTRAINTS.meanMin}, ${CONSTRAINTS.meanMax}], every style at least ${CONSTRAINTS.perStyleMin}, closest to ${CONSTRAINTS.target}; ties: larger tilePool, smaller focusWeight, smaller upgradeAfter.`, '',
    `| tilePool | focusWeight | upgradeAfter | ${styles.join(' | ')} | mean win | mean lives lost | qualifies |`, `| ${['---', '---', '---', ...styles.map(() => '---'), '---', '---', '---'].join(' | ')} |`];
  for (const r of results) {
    lines.push(`| ${r.knobs.tilePool} | ${r.knobs.focusWeight} | ${r.knobs.upgradeAfter} | ${styles.map((s) => r.perStyleWinRate[s].toFixed(2)).join(' | ')} | ${r.meanWinRate.toFixed(3)} | ${r.meanLivesLost.toFixed(2)} | ${q(r)} |`);
  }
  lines.push('', chosen ? `Chosen: ${JSON.stringify(chosen.knobs)} (mean win rate ${chosen.meanWinRate.toFixed(3)}).` : 'No combination qualifies.', '');
  return lines.join('\n');
}
