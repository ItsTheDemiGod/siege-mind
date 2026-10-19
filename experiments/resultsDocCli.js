// CLI: npm run results-doc [-- --out=docs/RESULTS.md]
// Reads the held-out analysis, the training analysis, the lock, the rows and the CSV (sha256 only) and writes docs/RESULTS.md. Inputs are only read.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL, protocolHash } from './protocol.js';
import { pairContrasts, loadTrainingRows, replicationPairTable, replicationTable, distinctRows, K_ALIASES } from './figuresV4/data.js';
import { buildResultsDoc } from './resultsDoc.js';

export const DEFAULTS = Object.freeze({
  heldout: 'docs/results/heldout-confirmatory.json', training: 'docs/results/confirm-dryrun-train.json', trainingRows: 'docs/results/firstlook-train6.rows.json', rows: 'docs/results/heldout.rows.json', csv: 'docs/results/heldout.csv', lock: 'experiments/heldout.lock.json', out: 'docs/RESULTS.md',
});

/** @param {string[]} argv @returns {typeof DEFAULTS} @throws {Error} for unknown arguments */
export function parseResultsDocArgs(argv) {
  const a = { ...DEFAULTS };
  for (const arg of argv) {
    const m = /^--(heldout|training|training-rows|rows|csv|lock|out)=(.+)$/s.exec(arg);
    if (!m) throw new Error(`unknown argument: ${arg}`);
    a[m[1] === 'training-rows' ? 'trainingRows' : m[1]] = m[2];
  }
  return a;
}

const read = (p, what) => { try { return readFileSync(resolve(p)); } catch (e) { throw new Error(`cannot read ${what} ${p}: ${e.message}`); } };
const json = (p, what) => { try { return JSON.parse(read(p, what).toString('utf8')); } catch (e) { throw new Error(`cannot parse ${what} ${p}: ${e.message}`); } };
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** Build the document text from the files named in `a`. @returns {string} @throws {Error} for missing inputs or failed guards */
export function generate(a) {
  const heldout = json(a.heldout, 'the held-out analysis');
  const training = json(a.training, 'the training analysis');
  const lock = json(a.lock, 'the lock file');
  const rowsBuf = read(a.rows, 'the rows');
  const rowsFile = JSON.parse(rowsBuf.toString('utf8'));
  if (rowsFile.set !== 'heldout' || !Array.isArray(rowsFile.rows)) throw new Error(`${a.rows} is not a held-out rows file`);
  const pairs = pairContrasts(rowsFile.rows, PROTOCOL, { waves: [5, 9, 13], modes: ['adaptive', 'adaptive2', 'counter'], analysis: heldout });
  const trainingRows = loadTrainingRows(resolve(a.trainingRows));
  const replicationPairs = replicationPairTable(rowsFile.rows, trainingRows, PROTOCOL);
  const distinct = distinctRows(replicationTable(heldout, training), K_ALIASES);
  return buildResultsDoc({ heldout, training, lock, pairContrasts: pairs, replicationPairs, distinct, rowsSha256: sha(rowsBuf), csvSha256: sha(read(a.csv, 'the CSV')), protocolHash: protocolHash() });
}

/** The CLI body. @param {string[]} argv @returns {number} the exit code */
export function main(argv) {
  let a;
  try { a = parseResultsDocArgs(argv); } catch (e) { console.error(e.message); return 2; }
  try {
    const doc = generate(a);
    writeFileSync(resolve(a.out), doc);
    console.log(`${resolve(a.out)}  ${Buffer.byteLength(doc)} bytes`);
    return 0;
  } catch (e) { console.error(e.message); return 1; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
