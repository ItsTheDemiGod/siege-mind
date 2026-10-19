// Helper of tests/study-freeze.test.js (not a test file: the glob only matches *.test.js).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** sha256 over every .js file under src/sim and src/data: sorted relative paths, CRLF normalized to LF, input = path + newline + contents + newline. */
export function simHash(root = ROOT) {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p);
    }
  };
  for (const d of ['src/sim', 'src/data']) walk(join(root, d));
  const h = createHash('sha256');
  for (const rel of files.map((f) => relative(root, f).split(sep).join('/')).sort()) h.update(`${rel}\n${readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n')}\n`);
  return h.digest('hex');
}
