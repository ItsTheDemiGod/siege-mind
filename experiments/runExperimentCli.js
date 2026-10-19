// CLI: npm run experiment -- --set=tuning   (the held-out set additionally needs --final --yes and goes through the lock first)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/data/config.js';
import { PROTOCOL, seedsOf } from './protocol.js';
import { runExperiment, unitsFor, writeResults, identityOf } from './runExperiment.js';
import { decideHeldoutRun } from './lock.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCK_PATH = resolve(ROOT, 'experiments/heldout.lock.json');
const FLAGS = ['set', 'waves', 'styles', 'modes', 'out', 'base'];
const SWITCHES = { '--final': 'final', '--yes': 'yes', '--new-lock': 'newLock', '--allow-dirty': 'allowDirty' };

/**
 * @param {string[]} argv @returns {{set: string, waves: number, styles: string[], modes: string[], out: string, base: string, final: boolean, yes: boolean, newLock: boolean, allowDirty: boolean}}
 * @throws {Error} with a clear message for unknown flags or values; subsets of styles and modes are not allowed for the held-out set
 */
export function parseExperimentArgs(argv) {
  const out = { set: null, waves: PROTOCOL.waves, styles: null, modes: null, out: 'docs/results', base: null, final: false, yes: false, newLock: false, allowDirty: false };
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
      const allowed = name === 'styles' ? PROTOCOL.styles : PROTOCOL.modes;
      const bad = list.find((x) => !allowed.includes(x));
      if (bad) throw new Error(`unknown ${name.slice(0, -1)}: ${bad} (have: ${allowed.join(', ')})`);
      out[name] = list;
    } else out[name] = value;
  }
  if (!out.set) throw new Error('--set is required (calibration, tuning or heldout)');
  seedsOf(out.set); // validates the name (RangeError)
  if (out.set === 'heldout' && (out.styles || out.modes)) throw new Error('the held-out set always runs every style and mode: --styles and --modes are not allowed');
  out.styles ??= [...PROTOCOL.styles];
  out.modes ??= [...PROTOCOL.modes];
  out.base ??= out.waves === PROTOCOL.waves ? out.set : `${out.set}-w${out.waves}`;
  return out;
}

async function main() {
  let a;
  try { a = parseExperimentArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); return 2; }
  const identity = identityOf();
  let extra = {};
  if (a.set === 'heldout') {
    const existingLock = existsSync(LOCK_PATH) ? JSON.parse(readFileSync(LOCK_PATH, 'utf8')) : null;
    const decision = decideHeldoutRun({ existingLock, args: a, identity, now: new Date().toISOString() });
    if (!decision.allowed) { console.error(`refused: ${decision.reason}`); return 1; }
    writeFileSync(LOCK_PATH, `${JSON.stringify(decision.nextLock, null, 2)}\n`); // the lock is written BEFORE any game is played
    console.log(`held-out lock written (runIndex ${decision.nextLock.runIndex}); ${decision.reason}`);
    extra = { runIndex: decision.nextLock.runIndex };
  }
  const units = unitsFor({ set: a.set, styles: a.styles, modes: a.modes, waves: a.waves });
  console.log(`experiment: set ${a.set}, ${units.length} games (${a.waves} waves), knobs ${JSON.stringify(PROTOCOL.botKnobs)}`);
  const t0 = performance.now();
  let tenth = 0;
  const rows = runExperiment({
    units,
    onProgress: (done, total) => { if (Math.floor((done / total) * 10) > tenth) { tenth = Math.floor((done / total) * 10); console.log(`  ${tenth * 10}% (${done}/${total})`); } },
  });
  const paths = writeResults({ dir: resolve(a.out), base: a.base, rows, identity, set: a.set, waves: a.waves, knobs: PROTOCOL.botKnobs, extra });
  console.log(`wrote ${paths.json}\nwrote ${paths.csv}\nelapsed ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((c) => process.exit(c));
