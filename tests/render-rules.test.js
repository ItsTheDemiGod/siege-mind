// Enforces Phase 1B rules: no shadowBlur / ctx.filter anywhere in the browser code, no Math.random in visuals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const jsIn = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`);

const visual = [...jsIn('src/render'), ...jsIn('src/ui'), 'src/gallery.js', 'src/galleryStatic.js'].filter((f) => existsSync(join(root, f)));
const all = [...visual, 'src/main.js'];

for (const file of all) {
  test(`${file}: no shadowBlur or ctx.filter`, () => {
    const code = strip(readFileSync(join(root, file), 'utf8'));
    assert.ok(!/shadowBlur/.test(code), 'shadowBlur');
    assert.ok(!/\bctx\.filter\b/.test(code), 'ctx.filter');
  });
}
for (const file of visual) {
  test(`${file}: no Math.random`, () => {
    assert.ok(!/Math\.random/.test(strip(readFileSync(join(root, file), 'utf8'))));
  });
}

import { shouldRebuild } from '../src/render/layers.js';

test('static layer rebuild policy: first build immediate, changes throttled to 150 ms', () => {
  assert.equal(shouldRebuild(null, 'a', 0, 0), true);
  assert.equal(shouldRebuild('a', 'a', 0, 1000), false);
  assert.equal(shouldRebuild('a', 'b', 1000, 1100), false);
  assert.equal(shouldRebuild('a', 'b', 1000, 1150), true);
});
