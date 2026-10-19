// Early-loss check (pure + CLI): which games ended before wave `threshold`? Waves 1-4 have identical compositions in every mode and the bots read
// the same state, so the SAME (style, seed) units are expected to end early in every mode. If not, an invariant is violated.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {object[]} rows result rows @param {{threshold?: number}} [o] a unit "ended early" when finalWave < threshold
 * @returns {{threshold: number, byMode: Record<string, {units: number, endedEarly: number, won: number}>, byStyleMode: {style: string, mode: string, units: number, endedEarly: number}[],
 *   identical: boolean, mismatches: {unit: string, modes: string[]}[]}}
 */
export function earlyLossReport(rows, { threshold = 5 } = {}) {
  const modes = [...new Set(rows.map((r) => r.mode))].sort();
  const byMode = {};
  const early = new Map(); // "style/seed" -> modes in which it ended early
  for (const m of modes) {
    const g = rows.filter((r) => r.mode === m);
    byMode[m] = { units: g.length, endedEarly: g.filter((r) => r.finalWave < threshold).length, won: g.filter((r) => r.won === 1).length };
    for (const r of g) if (r.finalWave < threshold) early.set(`${r.style}/${r.seed}`, [...(early.get(`${r.style}/${r.seed}`) ?? []), m]);
  }
  const styles = [...new Set(rows.map((r) => r.style))].sort();
  const byStyleMode = [];
  for (const style of styles) for (const mode of modes) {
    const g = rows.filter((r) => r.style === style && r.mode === mode);
    byStyleMode.push({ style, mode, units: g.length, endedEarly: g.filter((r) => r.finalWave < threshold).length });
  }
  const mismatches = [...early.entries()].filter(([, ms]) => ms.length !== modes.length).map(([unit, ms]) => ({ unit, modes: ms })).sort((a, b) => (a.unit < b.unit ? -1 : 1));
  return { threshold, byMode, byStyleMode, identical: mismatches.length === 0, mismatches };
}

/** @param {object} r earlyLossReport result @returns {string} aligned text */
export function formatEarlyLosses(r) {
  const lines = [`Games that ended before wave ${r.threshold} (finalWave < ${r.threshold})`, 'mode       units  endedEarly  won'];
  for (const [m, x] of Object.entries(r.byMode)) lines.push(`${m.padEnd(9)}  ${String(x.units).padStart(5)}  ${String(x.endedEarly).padStart(10)}  ${String(x.won).padStart(3)}`);
  lines.push('', 'style         mode      units  endedEarly');
  for (const x of r.byStyleMode) lines.push(`${x.style.padEnd(12)}  ${x.mode.padEnd(8)}  ${String(x.units).padStart(5)}  ${String(x.endedEarly).padStart(10)}`);
  lines.push('', r.identical ? 'The same (style, seed) units ended early in every mode (expected).' : `WARNING: the early-ending units differ between modes (${r.mismatches.length} units): an invariant is violated.`);
  for (const m of r.mismatches) lines.push(`  ${m.unit}: early in ${m.modes.join(', ')}`);
  return `${lines.join('\n')}\n`;
}

/** @param {object} r earlyLossReport result @returns {string} markdown */
export function earlyLossesToMarkdown(r) {
  const L = [`# Early losses (finalWave < ${r.threshold})`, '', '| mode | units | ended early | won |', '| --- | --- | --- | --- |', ...Object.entries(r.byMode).map(([m, x]) => `| ${m} | ${x.units} | ${x.endedEarly} | ${x.won} |`), '',
    '| style | mode | units | ended early |', '| --- | --- | --- | --- |', ...r.byStyleMode.map((x) => `| ${x.style} | ${x.mode} | ${x.units} | ${x.endedEarly} |`), '',
    r.identical ? 'The same (style, seed) units ended early in every mode (expected: waves 1-4 are identical in all modes).' : `**WARNING:** the early-ending units differ between modes (${r.mismatches.length} units); an invariant is violated.`, ''];
  for (const m of r.mismatches) L.push(`- ${m.unit}: early in ${m.modes.join(', ')}`);
  return `${L.join('\n')}\n`;
}

function main() {
  const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
  const file = arg('in');
  if (!file) { console.error('--in=<rows file> is required'); return 2; }
  let rows;
  try { rows = JSON.parse(readFileSync(resolve(file), 'utf8')).rows; } catch (e) { console.error(`cannot read ${file}: ${e.message}`); return 1; }
  if (!Array.isArray(rows)) { console.error(`${file} has no rows array`); return 1; }
  const report = earlyLossReport(rows);
  console.log(formatEarlyLosses(report));
  const out = arg('out');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(`${resolve(out)}.json`, `${JSON.stringify(report, null, 1)}\n`);
    writeFileSync(`${resolve(out)}.md`, earlyLossesToMarkdown(report));
    console.log(`wrote ${resolve(out)}.json and .md`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
