// Calibration of the style bots' baseline strength: STATIC mode only, on the calibration seeds, never on adaptive or random results.
// The rule is fixed in advance (docs/EXPERIMENT.md): a mean win rate inside a window, no style too weak, closest to a target.
import { playGame } from './playthrough.js';
import { createStyleBot } from './styleBots.js';
import { PROTOCOL, seedsOf } from './protocol.js';
import { mean } from './stats.js';

export const CONSTRAINTS = Object.freeze({ meanMin: 0.5, meanMax: 0.9, perStyleMin: 0.2, target: 0.7 });
export const DROP_RULE = Object.freeze({ dropBelow: 0.1, minStyles: 4, mustKeep: Object.freeze(['balancedR']) });
const TILE_POOLS = [1, 3, 6];
const UPGRADE_AFTERS = [4, 6, 8];
const EPS = 1e-12;

/**
 * The nine combinations tilePool {1, 3, 6} x upgradeAfter {4, 6, 8}; focusWeight stays fixed (the ablation styles ignore it).
 * @returns {{tilePool: number, focusWeight: number, upgradeAfter: number}[]}
 */
export function calibrationGrid() {
  const { focusWeight } = PROTOCOL.botKnobs;
  return TILE_POOLS.flatMap((tilePool) => UPGRADE_AFTERS.map((upgradeAfter) => ({ tilePool, focusWeight, upgradeAfter })));
}

const bestOf = (ok, constraints) => {
  const gap = (r) => Math.abs(r.meanWinRate - constraints.target);
  return [...ok].sort((a, b) => {
    if (Math.abs(gap(a) - gap(b)) > EPS) return gap(a) - gap(b);
    return b.knobs.tilePool - a.knobs.tilePool || a.knobs.upgradeAfter - b.knobs.upgradeAfter;
  })[0];
};

/**
 * Stage 1 and 2: pick the knob set to use. Pure; does not mutate its inputs. Ties: larger tilePool, then smaller upgradeAfter.
 * @param {{knobs: {tilePool: number, focusWeight: number, upgradeAfter: number}, perStyleWinRate: Record<string, number>, meanWinRate: number}[]} results
 * @param {{meanMin: number, meanMax: number, perStyleMin: number, target: number}} constraints
 * @returns {object|null} the chosen result (knobs inside), or null when none qualifies
 */
export function chooseKnobs(results, constraints) {
  const ok = results.filter((r) => r.meanWinRate >= constraints.meanMin && r.meanWinRate <= constraints.meanMax
    && Object.values(r.perStyleWinRate).every((v) => v >= constraints.perStyleMin));
  return ok.length === 0 ? null : bestOf(ok, constraints);
}

/**
 * Stage 3: per combination, drop the styles whose static win rate is below `dropBelow` (a combination that would drop a `mustKeep` style is invalid, as is one
 * with fewer than `minStyles` left); the mean is recomputed over the kept styles. Pure.
 * @param {object[]} results as for chooseKnobs @param {{meanMin: number, meanMax: number, target: number}} constraints
 * @param {{dropBelow: number, minStyles: number, mustKeep: string[]}} rule
 * @returns {object|null} a copy of the chosen result with keptStyles, droppedStyles and the recomputed meanWinRate, or null
 */
export function chooseWithDrop(results, constraints, { dropBelow, minStyles, mustKeep }) {
  const candidates = [];
  for (const r of results) {
    const entries = Object.entries(r.perStyleWinRate);
    const dropped = entries.filter(([, v]) => v < dropBelow).map(([k]) => k);
    const kept = entries.filter(([, v]) => v >= dropBelow);
    if (dropped.some((k) => mustKeep.includes(k)) || kept.length < minStyles) continue;
    const m = kept.reduce((a, [, v]) => a + v, 0) / kept.length;
    if (m >= constraints.meanMin && m <= constraints.meanMax) candidates.push({ ...r, meanWinRate: m, keptStyles: kept.map(([k]) => k), droppedStyles: dropped });
  }
  return candidates.length === 0 ? null : bestOf(candidates, constraints);
}

/**
 * The three selection stages on the SAME results (no new games): 1 (perStyleMin 0.2), 2 (perStyleMin 0.1), 3 (drop styles below dropBelow).
 * @param {object[]} results @returns {{stage: 1|2|3|null, chosen: object|null, droppedStyles: string[]}}
 */
export function selectKnobs(results) {
  const s1 = chooseKnobs(results, CONSTRAINTS);
  if (s1) return { stage: 1, chosen: s1, droppedStyles: [] };
  const s2 = chooseKnobs(results, { ...CONSTRAINTS, perStyleMin: 0.1 });
  if (s2) return { stage: 2, chosen: s2, droppedStyles: [] };
  const s3 = chooseWithDrop(results, CONSTRAINTS, DROP_RULE);
  return s3 ? { stage: 3, chosen: s3, droppedStyles: s3.droppedStyles } : { stage: null, chosen: null, droppedStyles: [] };
}

/** @param {object} r one result @returns {number[]} the stages (1, 2, 3) in which this combination qualifies on its own */
export function qualifyingStages(r) {
  const out = [];
  if (chooseKnobs([r], CONSTRAINTS)) out.push(1);
  if (chooseKnobs([r], { ...CONSTRAINTS, perStyleMin: 0.1 })) out.push(2);
  if (chooseWithDrop([r], CONSTRAINTS, DROP_RULE)) out.push(3);
  return out;
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

/** @param {object[]} results @param {{stage: number|null, chosen: object|null, droppedStyles: string[]}} sel @returns {string} markdown table of every combination */
export function calibrationMarkdown(results, sel) {
  const styles = PROTOCOL.styles;
  const lines = ['# Bot calibration (static mode, calibration seeds, ablation styles)', '',
    `Stage 1: mean win rate in [${CONSTRAINTS.meanMin}, ${CONSTRAINTS.meanMax}], every style at least ${CONSTRAINTS.perStyleMin}, closest to ${CONSTRAINTS.target}. Stage 2: the same with every style at least 0.1. Stage 3: styles below ${DROP_RULE.dropBelow} are dropped (balancedR may not be; at least ${DROP_RULE.minStyles} styles remain) and the mean is recomputed over the rest. Ties: larger tilePool, then smaller upgradeAfter. focusWeight is fixed (the ablation styles ignore it).`, '',
    `| tilePool | upgradeAfter | ${styles.join(' | ')} | mean win | mean lives lost | qualifies in stage |`, `| ${['---', '---', ...styles.map(() => '---'), '---', '---', '---'].join(' | ')} |`];
  for (const r of results) {
    lines.push(`| ${r.knobs.tilePool} | ${r.knobs.upgradeAfter} | ${styles.map((x) => r.perStyleWinRate[x].toFixed(2)).join(' | ')} | ${r.meanWinRate.toFixed(3)} | ${r.meanLivesLost.toFixed(2)} | ${qualifyingStages(r).join(', ') || '-'} |`);
  }
  lines.push('', sel.chosen ? `Chosen in stage ${sel.stage}: ${JSON.stringify(sel.chosen.knobs)} (mean win rate ${sel.chosen.meanWinRate.toFixed(3)}${sel.stage === 3 ? ' over the kept styles' : ''}).` : 'No combination qualifies in any stage.', '');
  if (sel.droppedStyles.length) lines.push(`**Dropped styles: ${sel.droppedStyles.join(', ')}** (static win rate below ${DROP_RULE.dropBelow}).`, '');
  return lines.join('\n');
}
