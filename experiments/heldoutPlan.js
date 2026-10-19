// The held-out plan (pure) and its CLI: npm run plan-heldout. It prints what the single held-out run will do and a rough runtime estimate from a few TRAINING
// games. It never touches the lock and never plays a held-out seed.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL, protocolHash, seedsOf } from './protocol.js';

export const HELDOUT_COMMANDS = Object.freeze([
  'git status',
  'npm run experiment -- --set=heldout --final --yes',
  'npm run confirm -- --in=docs/results/heldout.rows.json --out=docs/results/heldout-confirmatory',
]);

/** @param {typeof PROTOCOL} protocol @returns {object} the plan of the held-out run (counts, versions, exact commands) */
export function heldoutPlan(protocol = PROTOCOL) {
  const seeds = seedsOf('heldout');
  const modes = [...protocol.confirmatory.modes];
  const styles = [...protocol.styles];
  return {
    seeds: seeds.length, firstSeed: seeds[0], lastSeed: seeds.at(-1), styles, modes, units: seeds.length * styles.length * modes.length, unitsPerMode: seeds.length * styles.length,
    protocolVersion: protocol.version, protocolHash: protocolHash(),
    commands: [...HELDOUT_COMMANDS],
  };
}

/** @param {ReturnType<typeof heldoutPlan>} p @returns {string} the printed plan */
export function formatPlan(p) {
  return [`Held-out plan (protocol version ${p.protocolVersion}, hash ${p.protocolHash})`, `seeds ${p.firstSeed}-${p.lastSeed} (${p.seeds}) x ${p.styles.length} styles (${p.styles.join(', ')}) x ${p.modes.length} modes (${p.modes.join(', ')})`,
    `${p.units} games, ${p.unitsPerMode} per mode`, 'commands, in this order:', ...p.commands.map((c, i) => `  ${i + 1}. ${c}${i === 0 ? '   (must be clean)' : ''}`)].join('\n');
}

async function main() {
  const { runUnit } = await import('./runExperiment.js');
  const plan = heldoutPlan();
  console.log(formatPlan(plan));
  const sample = [['balancedR', 'static', 1001], ['balancedR', 'adaptive2', 1001], ['balancedR', 'static', 1002], ['balancedR', 'adaptive2', 1002], ['noMortar', 'static', 1001], ['noMortar', 'adaptive2', 1001]];
  const t0 = performance.now(); // CLI timing only
  for (const [style, mode, seed] of sample) runUnit({ style, mode, seed });
  const perGame = (performance.now() - t0) / 1000 / sample.length;
  console.log(`runtime estimate (rough, from ${sample.length} training games at ${perGame.toFixed(2)} s each, linear extrapolation): about ${((perGame * plan.units) / 60).toFixed(1)} minutes for ${plan.units} games`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((c) => process.exit(c));
