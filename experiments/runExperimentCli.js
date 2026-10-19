// CLI: npm run experiment -- --set=tuning   (the held-out set additionally needs --final --yes and goes through the lock first)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/data/config.js';
import { PROTOCOL, seedsOf } from './protocol.js';
import { runExperiment, unitsFor, writeResults, identityOf } from './runExperiment.js';
import { decideHeldoutRun } from './lock.js';
import { splitSeeds } from './splits.js';
import { allowedModesFor } from './modes.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCK_PATH = resolve(ROOT, 'experiments/heldout.lock.json');
export const VALIDATION_LOCK_PATH = resolve(ROOT, 'experiments/validation.lock.json');
const FLAGS = ['set', 'waves', 'styles', 'modes', 'out', 'base', 'split'];
const SWITCHES = { '--final': 'final', '--yes': 'yes', '--new-lock': 'newLock', '--allow-dirty': 'allowDirty' };

/**
 * @param {string[]} argv @returns {{set: string, split: string, waves: number, styles: string[], modes: string[], out: string, base: string, final: boolean, yes: boolean, newLock: boolean, allowDirty: boolean}}
 * @throws {Error} with a clear message for unknown flags or values; subsets of styles and modes are not allowed for the held-out set
 */
export function parseExperimentArgs(argv) {
  const out = { set: null, waves: PROTOCOL.waves, styles: null, modes: null, out: 'docs/results', base: null, split: null, final: false, yes: false, newLock: false, allowDirty: false };
  for (const arg of argv) {
    if (arg in SWITCHES) { out[SWITCHES[arg]] = true; continue; }
    const m = /^--([a-z-]+)=(.*)$/s.exec(arg);
    if (!m || !FLAGS.includes(m[1])) throw new Error(`unknown argument: ${arg}`);
    const [, name, value] = m;
    if (value === '') throw new Error(`--${name} needs a value`);
    if (name === 'waves') {
      if (!config.game.allowedTotals.includes(Number(value))) throw new Error(`--waves must be one of ${config.game.allowedTotals.join(', ')}, got ${value}`);
      out.waves = Number(value);
    } else if (name === 'styles' || name === 'modes') {
      const list = value.split(',');
      const allowed = name === 'styles' ? PROTOCOL.styles : allowedModesFor(argv.find((x) => x.startsWith('--set='))?.slice(6) ?? 'calibration');
      const bad = list.find((x) => !allowed.includes(x));
      if (bad) throw new Error(`unknown ${name.slice(0, -1)}: ${bad} (have: ${allowed.join(', ')})`);
      out[name] = list;
    } else out[name] = value;
  }
  if (!out.set) throw new Error('--set is required (calibration, tuning or heldout)');
  seedsOf(out.set); // validates the name (RangeError)
  if (out.set === 'heldout' && (out.styles || out.modes)) throw new Error('the held-out set always runs every style and mode: --styles and --modes are not allowed');
  if (out.split !== null && out.set !== 'tuning') throw new Error('--split is only allowed with --set=tuning');
  if (out.split === null) delete out.split; // absent means 'all'; the key is only present when given
  else splitSeeds(out.split); // validates the name (RangeError)
  out.styles ??= [...PROTOCOL.styles];
  out.modes ??= out.set === 'heldout' ? [...PROTOCOL.confirmatory.modes] : [...PROTOCOL.modes];
  const stem = out.split && out.split !== 'all' ? `${out.set}-${out.split}` : out.set; // a split never overwrites the full-set files by default
  out.base ??= out.waves === PROTOCOL.waves ? stem : `${stem}-w${out.waves}`;
  return out;
}

const lockPathOf = (kind) => (kind === 'heldout' ? LOCK_PATH : VALIDATION_LOCK_PATH);
const REAL_DEPS = {
  runExperiment, unitsFor, writeResults, identityOf,
  readLock: (kind) => (existsSync(lockPathOf(kind)) ? JSON.parse(readFileSync(lockPathOf(kind), 'utf8')) : null),
  writeLock: (kind, lock) => writeFileSync(lockPathOf(kind), `${JSON.stringify(lock, null, 2)}
`),
  now: () => new Date().toISOString(), log: (m) => console.log(m), error: (m) => console.error(m), clock: () => performance.now(),
};

/**
 * The CLI body. The lock gate (which runs need a lock, the decision, the refusal, writing the lock) runs BEFORE any game is played.
 * @param {string[]} argv @param {Partial<typeof REAL_DEPS>} [deps] injectable for tests (tests never call the real runner for locked sets)
 * @returns {Promise<number>} the process exit code
 */
export async function main(argv, deps = {}) {
  const d = { ...REAL_DEPS, ...deps };
  let a;
  try { a = parseExperimentArgs(argv); } catch (e) { d.error(e.message); return 2; }
  const identity = d.identityOf();
  let extra = {};
  const kind = a.set === 'heldout' ? 'heldout' : a.split === 'validation' ? 'validation' : null;
  if (kind) {
    const decision = decideHeldoutRun({ existingLock: d.readLock(kind), args: a, identity, now: d.now(), kind });
    if (!decision.allowed) { d.error(`refused: ${decision.reason}`); return 1; }
    d.writeLock(kind, decision.nextLock); // the lock is written BEFORE any game is played
    d.log(`${kind} lock written (runIndex ${decision.nextLock.runIndex}); ${decision.reason}`);
    extra = { runIndex: decision.nextLock.runIndex };
  }
  const units = d.unitsFor({ set: a.set, styles: a.styles, modes: a.modes, waves: a.waves, seeds: a.set === 'tuning' ? splitSeeds(a.split ?? 'all') : undefined });
  d.log(`experiment: set ${a.set}, ${units.length} games (${a.waves} waves), knobs ${JSON.stringify(PROTOCOL.botKnobs)}`);
  const t0 = d.clock();
  let tenth = 0;
  const rows = d.runExperiment({
    units,
    onProgress: (done, total) => { if (Math.floor((done / total) * 10) > tenth) { tenth = Math.floor((done / total) * 10); d.log(`  ${tenth * 10}% (${done}/${total})`); } },
  });
  const paths = d.writeResults({ dir: resolve(a.out), base: a.base, rows, identity, set: a.set, waves: a.waves, knobs: PROTOCOL.botKnobs, extra });
  d.log(`wrote ${paths.json}
wrote ${paths.csv}
elapsed ${((d.clock() - t0) / 1000).toFixed(1)} s`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c));
