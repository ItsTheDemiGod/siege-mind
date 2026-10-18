import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('every z-index in style.css uses a --z-* token', () => {
  const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
  const found = [...css.matchAll(/z-index\s*:\s*([^;}]+)/g)].map((m) => m[1].trim());
  assert.ok(found.length >= 5);
  for (const v of found) assert.match(v, /^var\(--z-[a-z]+\)$/, `raw z-index: ${v}`);
});
