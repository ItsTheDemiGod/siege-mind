// CLI: npm run analyze -- --in=docs/results/tuning.rows.json --out=docs/results/tuning-summary [--allow-hash-mismatch]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, formatAnalysis, analysisToMarkdown } from './analyze.js';
import { protocolHash, PROTOCOL_PREVIOUS_HASHES } from './protocol.js';

/** @param {string[]} argv @returns {{in: string, out: string|null, allowHashMismatch: boolean}} @throws {Error} for unknown or missing arguments */
export function parseAnalyzeArgs(argv) {
  const a = { in: null, out: null, allowHashMismatch: false };
  for (const arg of argv) {
    if (arg === '--allow-hash-mismatch') { a.allowHashMismatch = true; continue; }
    const m = /^--(in|out)=(.+)$/s.exec(arg);
    if (!m) throw new Error(`unknown argument: ${arg}`);
    a[m[1]] = m[2];
  }
  if (!a.in) throw new Error('--in=<rows file> is required');
  return a;
}

/**
 * Decide whether rows may be analyzed under the current protocol. Pure.
 * @param {string} rowsHash the protocolHash recorded in the rows file @param {string} currentHash @param {Record<number, string>} previousHashes version -> hash
 * @param {boolean} allowMismatch the --allow-hash-mismatch switch
 * @returns {{ok: boolean, note: string|null}} ok when the hash is current, a known earlier version (with a note), or the mismatch is allowed
 */
export function checkProtocolHash(rowsHash, currentHash, previousHashes, allowMismatch) {
  if (rowsHash === currentHash) return { ok: true, note: null };
  const version = Object.keys(previousHashes).find((v) => previousHashes[v] === rowsHash);
  if (version !== undefined) return { ok: true, note: `rows were produced under protocol version ${version}` };
  return { ok: Boolean(allowMismatch), note: null };
}

function main() {
  let a;
  try { a = parseAnalyzeArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); return 2; }
  let text;
  try { text = readFileSync(resolve(a.in), 'utf8'); } catch (e) { console.error(`cannot read ${a.in}: ${e.message}`); return 1; }
  let file;
  try { file = JSON.parse(text); } catch (e) { console.error(`${a.in} is not valid JSON: ${e.message}`); return 1; }
  if (!Array.isArray(file.rows)) { console.error(`${a.in} has no rows array`); return 1; }
  const check = checkProtocolHash(file.protocolHash, protocolHash(), PROTOCOL_PREVIOUS_HASHES, a.allowHashMismatch);
  if (check.note) console.log(check.note);
  else if (file.protocolHash !== protocolHash()) {
    console.error(`protocol hash mismatch:
  file    ${file.protocolHash}
  current ${protocolHash()}`);
    if (!check.ok) { console.error('the rows were produced under a different protocol; pass --allow-hash-mismatch to analyze them anyway'); return 1; }
  }
  const result = analyze(file.rows, undefined, { set: file.set });
  console.log(formatAnalysis(result));
  if (a.out) {
    mkdirSync(dirname(resolve(a.out)), { recursive: true });
    writeFileSync(`${resolve(a.out)}.json`, `${JSON.stringify(result, null, 1)}\n`);
    writeFileSync(`${resolve(a.out)}.md`, analysisToMarkdown(result));
    console.log(`wrote ${resolve(a.out)}.json and .md`);
  }
  if (!result.completeness.complete) { console.error('the data are incomplete: see the completeness line'); return 1; }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
