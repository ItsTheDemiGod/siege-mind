// Enforces Architecture Rules 1 and 3: src/sim/ stays DOM-free, clock-free and uses no Math.random.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/sim/', import.meta.url));
const FORBIDDEN = [
  /\bwindow\b/i, /\bdocument\b/i, /\bnavigator\b/i, /\bcanvas\b/i, /\brequestAnimationFrame\b/i,
  /\blocalStorage\b/i, /\bMath\.random\b/i, /\bDate\.now\b/i, /\bperformance\.now\b/i,
];
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  test(`src/sim/${file} is pure`, () => {
    const code = stripComments(readFileSync(join(dir, file), 'utf8'));
    for (const re of FORBIDDEN) assert.ok(!re.test(code), `${file} uses ${re}`);
  });
}
