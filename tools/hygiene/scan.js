// CLI: npm run hygiene. Scans the git-tracked text files for personal paths, e-mail addresses, tokens and keys, tracked .env files and files over 1 MB.
// Exit 0 = nothing outside the allowlist, 1 = findings, 2 = the allowlist itself is not acceptable.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { scanFiles, validateAllowlist } from './rules.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BINARY = /\.(woff2|png|jpg|jpeg|gif|ico)$/i;

/** @returns {{path: string, text: string | null, size: number}[]} every tracked file; binary files have text null */
export function loadTracked(root = ROOT) {
  const names = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
  return names.map((path) => {
    const size = statSync(resolve(root, path)).size;
    if (BINARY.test(path)) return { path, text: null, size };
    const buf = readFileSync(resolve(root, path));
    return { path, text: buf.includes(0) ? null : buf.toString('utf8'), size };
  });
}

/** @returns {number} exit code */
export function main(root = ROOT, log = console.log) {
  const allowlist = JSON.parse(readFileSync(resolve(root, 'tools/hygiene/allowlist.json'), 'utf8'));
  const bad = validateAllowlist(allowlist);
  if (bad.length) { bad.forEach((p) => log(`allowlist: ${p}`)); return 2; }
  const files = loadTracked(root);
  const { findings, allowed } = scanFiles(files, allowlist);
  for (const f of findings) log(`${f.path}${f.line ? `:${f.line}` : ''}  ${f.rule}  ${f.sample}`);
  log(`${files.length} tracked files, ${files.reduce((n, f) => n + f.size, 0)} bytes, ${allowed.length} allowlisted finding(s), ${findings.length} finding(s)`);
  return findings.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
