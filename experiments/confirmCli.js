// CLI: npm run confirm -- --in=docs/results/heldout.rows.json --out=docs/results/heldout-confirmatory
//      npm run confirm -- --in=docs/results/firstlook-train6.rows.json --out=docs/results/confirm-dryrun-train --dry-run
// The confirmatory run needs rows from the locked held-out run of the CURRENT protocol; a dry run (training data) must say so in its file name.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL, protocolHash } from './protocol.js';
import { analyzeConfirmatory, formatConfirmatory, confirmatoryToMarkdown } from './confirmatory.js';

/** @param {string[]} argv @returns {{in: string, out: string, dryRun: boolean}} @throws {Error} for unknown or missing arguments */
export function parseConfirmArgs(argv) {
  const a = { in: null, out: null, dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') { a.dryRun = true; continue; }
    const m = /^--(in|out)=(.+)$/s.exec(arg);
    if (!m) throw new Error(`unknown argument: ${arg}`);
    a[m[1]] = m[2];
  }
  if (!a.in) throw new Error('--in=<rows file> is required');
  if (!a.out) throw new Error('--out=<output base name> is required');
  return a;
}

/**
 * Decide whether a rows file may be evaluated. Pure.
 * @param {{set?: string, protocolVersion?: number, protocolHash?: string, runIndex?: number}} file the rows file header
 * @param {{out: string, dryRun: boolean}} args @param {{version: number, hash: string}} current
 * @returns {{ok: boolean, message: string, label: 'CONFIRMATORY'|'EXPLORATORY DRY RUN'}}
 */
export function checkConfirmInputs(file, args, current) {
  const named = /dryrun/i.test(args.out);
  if (args.dryRun) {
    if (!named) return { ok: false, label: 'EXPLORATORY DRY RUN', message: 'a dry run must write to an output base name that contains "dryrun" (for example docs/results/confirm-dryrun-train)' };
    return { ok: true, label: 'EXPLORATORY DRY RUN', message: `dry run: set ${String(file.set)}, protocol version ${String(file.protocolVersion)}, hash ${String(file.protocolHash)} (set and hash checks skipped)` };
  }
  const refuse = (message) => ({ ok: false, label: 'CONFIRMATORY', message });
  if (named) return refuse('a confirmatory output base name must not contain "dryrun"');
  if (file.set !== 'heldout') return refuse(`the rows are not from the held-out set (set ${String(file.set)}); use --dry-run for training data`);
  if (file.protocolVersion !== current.version) return refuse(`the rows were produced under protocol version ${String(file.protocolVersion)}, the current version is ${current.version}`);
  if (file.protocolHash !== current.hash) return refuse(`protocol hash mismatch: rows ${String(file.protocolHash)}, current ${current.hash}`);
  if (!Number.isInteger(file.runIndex) || file.runIndex < 1) return refuse('the rows have no lock run index: they were not produced through the held-out lock');
  return { ok: true, label: 'CONFIRMATORY', message: `held-out data evaluated ${file.runIndex} time(s) (run index ${file.runIndex})` };
}

const REAL = { readFile: (p) => readFileSync(p, 'utf8'), writeFile: (p, t) => writeFileSync(p, t), mkdir: (d) => mkdirSync(d, { recursive: true }), log: (m) => console.log(m), error: (m) => console.error(m) };

/** The CLI body. @param {string[]} argv @param {Partial<typeof REAL>} [deps] @returns {number} the exit code */
export function main(argv, deps = {}) {
  const d = { ...REAL, ...deps };
  let a;
  try { a = parseConfirmArgs(argv); } catch (e) { d.error(e.message); return 2; }
  let file;
  try { file = JSON.parse(d.readFile(resolve(a.in))); } catch (e) { d.error(`cannot read ${a.in}: ${e.message}`); return 1; }
  if (!file || !Array.isArray(file.rows)) { d.error(`${a.in} has no rows array`); return 1; }
  const check = checkConfirmInputs(file, a, { version: PROTOCOL.version, hash: protocolHash() });
  if (!check.ok) { d.error(`refused: ${check.message}`); return 1; }
  d.log(check.message);
  const result = analyzeConfirmatory(file.rows, { protocol: PROTOCOL, label: check.label });
  d.log(formatConfirmatory(result));
  if (!result.completeness.complete) { d.error('the data are incomplete: no statistic was computed and nothing was written'); return 1; }
  const base = resolve(a.out);
  d.mkdir(dirname(base));
  d.writeFile(`${base}.json`, `${JSON.stringify(result, null, 1)}\n`);
  d.writeFile(`${base}.md`, confirmatoryToMarkdown(result));
  d.log(`wrote ${base}.json and .md`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
