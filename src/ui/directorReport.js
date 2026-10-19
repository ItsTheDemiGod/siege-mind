// Pure: the Director report model, built from a telemetry run (summary or full detail). The run is self-describing (names come from
// run.definitions). Insights are descriptive, not causal. See docs/DIRECTOR.md.
import { config } from '../data/config.js';
import { ENEMY_ORDER } from '../data/enemies.js';
import { TOWER_ORDER } from '../data/towers.js';
import { MODES, RANDOM_CONTROL } from '../data/menuText.js';
import { copyPlain } from '../sim/telemetryRecords.js';
import { lengthLabel } from './waveSummary.js';
import { chartTilt } from './directorView.js';

const TITLE = "Director's Report";
const NO_EVIDENCE = (first) => `The Director had no evidence to act on yet (it starts adapting at wave ${first}).`;
const RANDOM_LINE = 'This run used the random control: enemy weights were random and ignored how your defense performed.';

/** @param {{finalShares: Record<string, number>, templateShares: Record<string, number>}} d @returns {number} half the L1 distance between final and template shares */
export function decisionShift(d) {
  let sum = 0;
  for (const t of ENEMY_ORDER) sum += Math.abs(d.finalShares[t] - d.templateShares[t]);
  return 0.5 * sum;
}

const modeLabel = (mode) => (mode === 'random' ? RANDOM_CONTROL.label : (MODES.find((m) => m.id === mode)?.label ?? 'Static'));
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
  if (mode !== 'adaptive' && mode !== 'random') {
    return { available: false, reason: 'static', mode, title: TITLE, headline: '', insights: [], entries: [], stats: empty, rows: [], damage: [], toughest: null };
  }
  const entries = run.waves.map((w) => w.director).filter(Boolean).map((d) => copyPlain(d));
  const eligible = entries.filter((d) => d.eligible);
  const adapted = entries.filter((d) => d.reason === 'adapted');
  const meanShift = eligible.length ? eligible.reduce((n, d) => n + decisionShift(d), 0) / eligible.length : 0;
  const last = entries.at(-1);
  const finalTilt = mode === 'adaptive' && last ? chartTilt(last, cfg.director) : Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1]));
  const rows = typeRows(run, finalTilt);
  const damage = damageRows(run);
  const toughest = toughestWave(run);
  const name = (t) => run.definitions.enemies[t].name;

  const insights = [];
  const leaned = [];
  if (mode === 'random') {
    insights.push(RANDOM_LINE);
  } else if (adapted.length === 0) {
    insights.push(NO_EVIDENCE(cfg.director.firstAdaptiveWave));
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
  if (mode === 'adaptive' && adapted.length > 0) insights.push(`On average ${Math.round(100 * meanShift)}% of each adapted wave's threat moved to different enemy types.`);

  return {
    available: true, mode, title: TITLE,
    headline: `${modeLabel(mode)} · ${lengthLabel(run.meta.totalWaves)} · ${statusLabel(run.result.result)}`,
    insights: insights.slice(0, cfg.report.maxInsights),
    entries, stats: { eligible: eligible.length, adapted: adapted.length, meanShift }, rows, damage, toughest,
  };
}
