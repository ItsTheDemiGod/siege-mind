// CLI: npm run calibrate   (static mode only; stage 1, then stage 2 only if stage 1 has no qualifying combination)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibrationGrid, chooseKnobs, runCalibration, calibrationMarkdown, CONSTRAINTS } from './calibrate.js';
import { PROTOCOL } from './protocol.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/results');

function printTable(results) {
  const styles = PROTOCOL.styles;
  console.log(['pool', 'focus', 'upgr', ...styles.map((s) => s.slice(0, 9).padStart(9)), 'meanWin', 'lostAvg', 'ok'].join('  '));
  for (const r of results) {
    const ok = r.meanWinRate >= CONSTRAINTS.meanMin && r.meanWinRate <= CONSTRAINTS.meanMax && Object.values(r.perStyleWinRate).every((v) => v >= CONSTRAINTS.perStyleMin);
    console.log([String(r.knobs.tilePool).padStart(4), r.knobs.focusWeight.toFixed(1).padStart(5), String(r.knobs.upgradeAfter).padStart(4), ...styles.map((s) => r.perStyleWinRate[s].toFixed(2).padStart(9)), r.meanWinRate.toFixed(3).padStart(7), r.meanLivesLost.toFixed(2).padStart(7), ok ? 'yes' : 'no'].join('  '));
  }
}

function main() {
  const progress = (label) => (d, t) => { if (d === t || d % 3 === 0) console.log(`  ${label}: ${d}/${t}`); };
  console.log(`calibration stage 1 (${calibrationGrid(1).length} combinations, static mode, ${PROTOCOL.seedSets.calibration.count} seeds x ${PROTOCOL.styles.length} styles)`);
  let results = runCalibration({ combos: calibrationGrid(1), onProgress: progress('stage 1') });
  let chosen = chooseKnobs(results, CONSTRAINTS);
  if (!chosen) {
    console.log('no combination qualifies in stage 1; running stage 2');
    results = [...results, ...runCalibration({ combos: calibrationGrid(2), onProgress: progress('stage 2') })];
    chosen = chooseKnobs(results, CONSTRAINTS);
  }
  printTable(results);
  console.log(chosen ? `\nchosen: ${JSON.stringify(chosen.knobs)} (mean win rate ${chosen.meanWinRate.toFixed(3)})` : '\nNO combination qualifies');
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, 'calibration.json'), `${JSON.stringify({ constraints: CONSTRAINTS, results, chosen: chosen ? chosen.knobs : null }, null, 1)}\n`);
  writeFileSync(resolve(OUT, 'calibration.md'), calibrationMarkdown(results, chosen));
  console.log(`wrote ${resolve(OUT, 'calibration.json')} and calibration.md`);
  return chosen ? 0 : 3;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
