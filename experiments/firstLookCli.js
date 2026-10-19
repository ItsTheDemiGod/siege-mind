// CLI: npm run first-look -- --in=docs/results/firstlook-train.rows.json --out=docs/results/firstlook-train-summary
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstLook, formatFirstLook, firstLookToMarkdown } from './firstLook.js';

/** @param {string[]} argv @returns {{in: string, out: string|null}} @throws {Error} for unknown arguments or a missing --in */
export function parseFirstLookArgs(argv) {
  const out = { in: null, out: null };
  for (const a of argv) {
    const m = /^--(in|out)=(.+)$/s.exec(a);
    if (!m) throw new Error(`unknown argument: ${a}`);
    out[m[1]] = m[2];
  }
  if (!out.in) throw new Error('--in=<rows file> is required');
  return out;
}

function main() {
  let a;
  try { a = parseFirstLookArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); return 2; }
  let rows;
  try { rows = JSON.parse(readFileSync(resolve(a.in), 'utf8')).rows; } catch (e) { console.error(`cannot read ${a.in}: ${e.message}`); return 1; }
  if (!Array.isArray(rows)) { console.error(`${a.in} has no rows array`); return 1; }
  let result;
  try { result = firstLook(rows); } catch (e) { console.error(`cannot analyze ${a.in}: ${e.message}`); return 1; }
  console.log(formatFirstLook(result));
  if (a.out) {
    mkdirSync(dirname(resolve(a.out)), { recursive: true });
    writeFileSync(`${resolve(a.out)}.json`, `${JSON.stringify(result, null, 1)}\n`);
    writeFileSync(`${resolve(a.out)}.md`, firstLookToMarkdown(result));
    console.log(`wrote ${resolve(a.out)}.json and .md`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
