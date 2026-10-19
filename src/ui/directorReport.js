// Pure: the Director report model, built from a telemetry run (summary or full detail). The run is self-describing (names come from
// run.definitions). Insights are descriptive, not causal. See docs/DIRECTOR.md.
import { config } from '../data/config.js';
import { ENEMY_ORDER } from '../data/enemies.js';
import { TOWER_ORDER } from '../data/towers.js';
import { MODES, RANDOM_CONTROL, RESEARCH_ARMS } from '../data/menuText.js';
import { copyPlain } from '../sim/telemetryRecords.js';
import { lengthLabel } from './waveSummary.js';
import { chartTilt } from './directorView.js';

const TITLE = "Director's Report";
const FOOT = 'This report describes this run only; the experiment compares many runs.';
const TANK_CAVEAT = ' Tanky enemy types tend to score higher against most defenses, so compare with the random control before reading intent into the weights.';

/** @param {string} mode game mode @returns {string} the footnote of the report: the tankiness caveat applies to adaptive runs only */
export const reportFootnote = (mode) => (mode === 'adaptive' || mode === 'adaptive2' ? FOOT + TANK_CAVEAT : FOOT);
const NO_EVIDENCE = (first) => `The Director had no evidence to act on yet (it starts adapting at wave ${first}).`;
const COUNTER_LINE = 'This run used the informed counter arm: enemy weights were set from your tower loadout, not learned.';
const PRIOR_LINE = 'This run used the prior control: enemy weights came from static baselines (enemy durability), not from your defense.';
const RANDOM_LINE = 'This run used the random control: enemy weights were random and ignored how your defense performed.';

/** @param {{finalShares: Record<string, number>, templateShares: Record<string, number>}} d @returns {number} half the L1 distance between final and template shares */
export function decisionShift(d) {
  let sum = 0;
  for (const t of ENEMY_ORDER) sum += Math.abs(d.finalShares[t] - d.templateShares[t]);
  return 0.5 * sum;
}

const modeLabel = (mode) => (mode === 'random' ? RANDOM_CONTROL.label : RESEARCH_ARMS[mode] ? RESEARCH_ARMS[mode].label : (MODES.find((m) => m.id === mode)?.label ?? 'Static'));
const statusLabel = (result) => (result === 'won' ? 'Victory' : result === 'lost' ? 'Defeat' : 'In progress');
const tilt2 = (x) => x.toFixed(2);

function typeRows(run, finalTilt) {
  return ENEMY_ORDER.map((type) => {
    let spawned = 0;
    let killed = 0;
    let leaked = 0;
    let progressSum = 0;
    for (const w of run.waves) {
      const s = w.byType[type];
      spawned += s.spawned; killed += s.killed; leaked += s.leaked; progressSum += s.progressSum;
    }
    const ended = killed + leaked;
    return {
      type, label: run.definitions.enemies[type].name, spawned, killed, leaked, leakRate: spawned > 0 ? leaked / spawned : 0,
      meanProgress: ended > 0 ? progressSum / ended : 0, finalTilt: finalTilt[type],
    };
  });
}

function damageRows(run) {
  const by = run.totals.damageBySource;
  const total = TOWER_ORDER.reduce((n, t) => n + by[t], 0);
  return TOWER_ORDER.map((type) => ({ type, label: run.definitions.towers[type].name, damage: by[type], share: total > 0 ? by[type] / total : 0 }));
}

function toughestWave(run) {
  let best = null;
  for (const w of run.waves) if (w.livesLost > 0 && (best === null || w.livesLost > best.livesLost)) best = w;
  if (best === null) return null;
  let top = null;
  let topLeaked = 0;
  for (const t of ENEMY_ORDER) if (best.byType[t].leaked > topLeaked) { top = t; topLeaked = best.byType[t].leaked; }
  return { wave: best.wave, name: best.name ?? null, livesLost: best.livesLost, topLeaker: top };
}

/**
 * @param {object} run telemetry run @param {{cfg?: typeof config}} [o]
 * @returns {{available: boolean, reason?: string, mode: string, title: string, headline: string, insights: string[], entries: object[],
 *   stats: {eligible: number, adapted: number, meanShift: number}, rows: object[], damage: object[], toughest: object|null}}
 */
export function buildDirectorReport(run, { cfg = config } = {}) {
  const mode = run.meta.mode;
  const empty = { eligible: 0, adapted: 0, meanShift: 0 };
  const learns = mode === 'adaptive' || mode === 'adaptive2'; // the arms whose weights come from scores
  if (!learns && mode !== 'random' && mode !== 'counter' && mode !== 'prior') {
    return { available: false, reason: 'static', mode, totalWaves: run.meta.totalWaves, title: TITLE, headline: '', insights: [], entries: [], stats: empty, rows: [], damage: [], toughest: null };
  }
  const entries = run.waves.map((w) => w.director).filter(Boolean).map((d) => copyPlain(d));
  const eligible = entries.filter((d) => d.eligible);
  const adapted = entries.filter((d) => d.reason === 'adapted');
  const meanShift = eligible.length ? eligible.reduce((n, d) => n + decisionShift(d), 0) / eligible.length : 0;
  const last = entries.at(-1);
  const firstWave = mode === 'adaptive2' ? cfg.directorV2.firstAdaptiveWave : cfg.director.firstAdaptiveWave;
  const finalTilt = (learns || mode === 'counter' || mode === 'prior') && last ? chartTilt(last, cfg.director, cfg.directorV2) : Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1]));
  const rows = typeRows(run, finalTilt);
  const damage = damageRows(run);
  const toughest = toughestWave(run);
  const name = (t) => run.definitions.enemies[t].name;

  const insights = [];
  const leaned = [];
  if (mode === 'random') {
    insights.push(RANDOM_LINE);
  } else if (mode === 'prior') {
    insights.push(PRIOR_LINE); // replaces insights 1, 2 and 5: nothing was learned
  } else if (mode === 'counter') {
    insights.push(COUNTER_LINE); // replaces insights 1, 2 and 5: nothing was learned
  } else if (adapted.length === 0) {
    insights.push(NO_EVIDENCE(firstWave));
  } else {
    const idx = (t) => ENEMY_ORDER.indexOf(t);
    const up = ENEMY_ORDER.filter((t) => finalTilt[t] >= cfg.report.pushRatio).sort((a, b) => finalTilt[b] - finalTilt[a] || idx(a) - idx(b)).slice(0, 2);
    const down = ENEMY_ORDER.filter((t) => finalTilt[t] <= 1 / cfg.report.pushRatio).sort((a, b) => finalTilt[a] - finalTilt[b] || idx(a) - idx(b)).slice(0, 2);
    for (const t of up) { leaned.push(t); insights.push(`The Director leaned on ${name(t)} (weight ×${tilt2(finalTilt[t])}): it earned the most threat-adjusted progress against your defense.`); }
    for (const t of down) insights.push(`It backed off ${name(t)} (weight ×${tilt2(finalTilt[t])}): your towers stopped them early.`);
  }
  const top = damage.reduce((b, d) => (d.share > b.share ? d : b), damage[0]);
  if (top.damage > 0 && top.share >= cfg.report.topDamageShare) {
    let line = `${top.label} dealt ${Math.round(100 * top.share)}% of your damage.`;
    const weak = run.definitions.towers[top.type].weakVs ?? [];
    const pushed = leaned.find((t) => weak.includes(t));
    if (pushed) line += ` The Director pushed ${name(pushed)}, which ${top.label} handles poorly.`;
    insights.push(line);
  }
  insights.push(toughest
    ? `Toughest wave: wave ${toughest.wave}${toughest.name ? ` · ${toughest.name}` : ''} — ${toughest.livesLost} lives lost${toughest.topLeaker ? `, mostly to ${name(toughest.topLeaker)} leaks` : ''}.`
    : 'No lives were lost.');
  if (learns && adapted.length > 0) insights.push(`On average ${Math.round(100 * meanShift)}% of each adapted wave's threat moved to different enemy types.`);

  return {
    available: true, mode, totalWaves: run.meta.totalWaves, title: TITLE,
    headline: `${modeLabel(mode)} · ${lengthLabel(run.meta.totalWaves)} · ${statusLabel(run.result.result)}`,
    insights: insights.slice(0, cfg.report.maxInsights),
    entries, stats: { eligible: eligible.length, adapted: adapted.length, meanShift }, rows, damage, toughest,
  };
}
