// CLI: npm run calibrate   (static mode only; 9 combinations, selection in up to three stages on the same results)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibrationGrid, selectKnobs, qualifyingStages, runCalibration, calibrationMarkdown, CONSTRAINTS, DROP_RULE } from './calibrate.js';
import { PROTOCOL } from './protocol.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/results');

function printTable(results) {
  const styles = PROTOCOL.styles;
  console.log(['pool', 'upgr', ...styles.map((x) => x.slice(0, 9).padStart(9)), 'meanWin', 'lostAvg', 'stages'].join('  '));
  for (const r of results) {
    console.log([String(r.knobs.tilePool).padStart(4), String(r.knobs.upgradeAfter).padStart(4), ...styles.map((x) => r.perStyleWinRate[x].toFixed(2).padStart(9)), r.meanWinRate.toFixed(3).padStart(7), r.meanLivesLost.toFixed(2).padStart(7), (qualifyingStages(r).join(',') || '-').padStart(6)].join('  '));
  }
}

function main() {
  const combos = calibrationGrid();
  console.log(`calibration (${combos.length} combinations, static mode, ${PROTOCOL.seedSets.calibration.count} seeds x ${PROTOCOL.styles.length} styles)`);
  const results = runCalibration({ combos, onProgress: (d, t) => console.log(`  ${d}/${t}`) });
  const sel = selectKnobs(results);
  printTable(results);
  if (sel.chosen) {
    console.log(`\nchosen in stage ${sel.stage}: ${JSON.stringify(sel.chosen.knobs)} (mean win rate ${sel.chosen.meanWinRate.toFixed(3)})`);
    if (sel.droppedStyles.length) console.log(`DROPPED STYLES: ${sel.droppedStyles.join(', ')}`);
  } else console.log('\nNO combination qualifies in any stage');
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, 'calibration.json'), `${JSON.stringify({ constraints: CONSTRAINTS, dropRule: DROP_RULE, results, stage: sel.stage, droppedStyles: sel.droppedStyles, chosen: sel.chosen ? sel.chosen.knobs : null }, null, 1)}\n`);
  writeFileSync(resolve(OUT, 'calibration.md'), calibrationMarkdown(results, sel));
  console.log(`wrote ${resolve(OUT, 'calibration.json')} and calibration.md`);
  return sel.chosen ? 0 : 3;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
