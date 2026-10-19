// The batch runner: plays every (seed, style, mode) unit sequentially and writes the result files. Deterministic: same inputs, byte-identical rows.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toCsv } from '../src/sim/telemetryExport.js';
import { validateRun } from '../src/sim/telemetrySchema.js';
import { playGame } from './playthrough.js';
import { createStyleBot } from './styleBots.js';
import { metricsFromRun, tiltAlignedOf, METRIC_COLUMNS } from './metrics.js';
import { PROTOCOL, seedsOf, protocolHash } from './protocol.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CODE_FILES = ['experiments/styleBots.js', 'experiments/runExperiment.js', 'experiments/metrics.js', 'experiments/protocol.js', 'experiments/bots.js'];
const CSV_DIGITS = 6;

/**
 * Play one unit and turn it into a result row.
 * @param {{style: string, mode: string, seed: number, waves?: number, knobs?: object, playGameFn?: Function}} o
 * @returns {object} row { style, mode, seed, ...METRIC_COLUMNS fields, livesLostByWave }
 * @throws {Error} naming the unit when the game timed out or its telemetry is invalid
 */
export function runUnit({ style, mode, seed, waves = PROTOCOL.waves, knobs = PROTOCOL.botKnobs, playGameFn = playGame }) {
  const name = `${style}/${mode}/seed ${seed}`;
  const r = playGameFn({ seed, bot: createStyleBot(style, knobs), mode, totalWaves: waves, telemetry: 'summary', meta: { style } });
  if (r.result === 'timeout') throw new Error(`unit ${name} timed out`);
  const problems = validateRun(r.run);
  if (problems.length > 0) throw new Error(`unit ${name} produced an invalid run: ${problems.slice(0, 3).join('; ')}`);
  const m = metricsFromRun(r.run);
  const tiltAligned = tiltAlignedOf(style, m, PROTOCOL.tiltPredictions, PROTOCOL.stats.alignmentThreshold); // null for static (tiltObserved 0) and styles without a prediction
  const all = { style, mode, seed, ...m, tiltAligned };
  const row = {};
  for (const c of METRIC_COLUMNS) row[c] = all[c];
  row.livesLostByWave = m.livesLostByWave;
  return row;
}

/** @returns {{style: string, mode: string, seed: number, waves: number}[]} in the stable order seed, then style, then mode */
export function unitsFor({ set, styles = PROTOCOL.styles, modes = PROTOCOL.modes, waves = PROTOCOL.waves }) {
  const units = [];
  for (const seed of seedsOf(set)) for (const style of styles) for (const mode of modes) units.push({ style, mode, seed, waves });
  return units;
}

/**
 * @param {{units: object[], knobs?: object, onProgress?: (done: number, total: number) => void, playGameFn?: Function}} o
 * @returns {object[]} rows in unit order (every unit produces exactly one row or the run throws)
 */
export function runExperiment({ units, knobs = PROTOCOL.botKnobs, onProgress = () => {}, playGameFn = playGame }) {
  const rows = [];
  units.forEach((u, i) => {
    rows.push(runUnit({ ...u, knobs, playGameFn }));
    onProgress(i + 1, units.length);
  });
  if (rows.length !== units.length) throw new Error('internal error: a unit produced no row');
  return rows;
}

function jsFilesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? jsFilesUnder(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []));
}

/** sha256 over the sorted (relative path, normalized contents) of the code that decides a result. */
function hashCode(root) {
  const files = [...jsFilesUnder(join(root, 'src/sim')), ...jsFilesUnder(join(root, 'src/data')), ...CODE_FILES.map((f) => join(root, f)).filter((f) => existsSync(f))]
    .map((f) => ({ path: relative(root, f).split('\\').join('/'), text: readFileSync(f, 'utf8').replace(/\r\n/g, '\n') }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const h = createHash('sha256');
  for (const f of files) h.update(`${f.path}\n${f.text}\u0000`);
  return h.digest('hex');
}

/**
 * Who produced the results: code hash, git commit and dirtiness, Node version.
 * @param {{exec?: (args: string[]) => string, root?: string}} [o] exec runs a git command (injectable)
 * @returns {{codeHash: string, gitCommit: string, gitDirty: boolean, nodeVersion: string}}
 */
export function identityOf({ exec = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }), root = ROOT } = {}) {
  let gitCommit = 'unknown';
  let gitDirty = false;
  try {
    gitCommit = exec(['rev-parse', 'HEAD']).trim() || 'unknown';
    gitDirty = exec(['status', '--porcelain']).trim().length > 0;
  } catch { /* git unavailable: the lock refuses an unknown commit */ }
  return { codeHash: hashCode(root), gitCommit, gitDirty, nodeVersion: process.version };
}

/**
 * Write `${base}.rows.json` and `${base}.csv` (LF line endings, no timestamps).
 * @param {{dir: string, base: string, rows: object[], identity: object, set: string, waves: number, knobs: object, extra?: object}} o
 * @returns {{json: string, csv: string}} the written paths
 */
export function writeResults({ dir, base, rows, identity, set, waves, knobs, extra = {} }) {
  mkdirSync(dir, { recursive: true });
  const head = { protocolVersion: PROTOCOL.version, protocolHash: protocolHash(), ...identity, set, waves, knobs, ...extra };
  const headText = JSON.stringify(head, null, 1).replace(/\n\}$/, '');
  const json = `${headText},\n "rows": [\n${rows.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n ]\n}\n`;
  const csv = toCsv(rows.map((r) => METRIC_COLUMNS.map((c) => r[c])), METRIC_COLUMNS, { floatDigits: CSV_DIGITS });
  const jsonPath = join(dir, `${base}.rows.json`);
  const csvPath = join(dir, `${base}.csv`);
  writeFileSync(jsonPath, json);
  writeFileSync(csvPath, csv);
  return { json: jsonPath, csv: csvPath };
}
