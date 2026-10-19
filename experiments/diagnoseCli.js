// CLI: npm run diagnose   (static games on the tuning seeds with the protocol knobs; writes docs/results/diagnostics.json and .md)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectBaselineObservations, diagnose, formatDiagnostics, diagnosticsToMarkdown } from './diagnose.js';
import { PROTOCOL, seedsOf } from './protocol.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/results');

function main() {
  console.log(`diagnostics: static mode, ${PROTOCOL.styles.length} styles x ${seedsOf('tuning').length} tuning seeds, ${PROTOCOL.waves} waves`);
  const obs = collectBaselineObservations({ seeds: seedsOf('tuning'), styles: [...PROTOCOL.styles], waves: PROTOCOL.waves, knobs: PROTOCOL.botKnobs });
  const result = diagnose(obs);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, 'diagnostics.json'), `${JSON.stringify({ observations: obs.length, ...result }, null, 1)}\n`);
  writeFileSync(resolve(OUT, 'diagnostics.md'), diagnosticsToMarkdown(result));
  console.log(formatDiagnostics(result));
  console.log(`wrote ${resolve(OUT, 'diagnostics.json')} and diagnostics.md (${obs.length} observations)`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
