import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SHOTS, SHOT_WIDTH, SHOT_HEIGHT, SHOT_MAX_BYTES, SHOT_MIN_BYTES, pngSize, validateShot } from '../tools/browser-check/shotList.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** A buffer with a valid PNG signature and IHDR (nothing after it): enough for pngSize; padded to a chosen length for the byte-range checks. */
function fakePng(width, height, length = 24) {
  const b = Buffer.alloc(Math.max(length, 24));
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

test('pngSize reads the IHDR and rejects other data', () => {
  assert.deepEqual(pngSize(fakePng(1280, 720)), { width: 1280, height: 720 });
  assert.deepEqual(pngSize(new Uint8Array(fakePng(3, 5))), { width: 3, height: 5 });
  assert.throws(() => pngSize(Buffer.from('hello world, definitely not a png file')), /not a PNG/);
  assert.throws(() => pngSize(Buffer.alloc(10)), /not a PNG/);
  const noIhdr = fakePng(1, 1);
  noIhdr.write('IDAT', 12, 'ascii');
  assert.throws(() => pngSize(noIhdr), /IHDR/);
});

test('validateShot checks the size and the byte range and reports every problem', () => {
  const want = { width: SHOT_WIDTH, height: SHOT_HEIGHT };
  assert.deepEqual(validateShot(fakePng(1280, 720, 100000), want), []);
  assert.match(validateShot(fakePng(1280, 700, 100000), want)[0], /1280x700, expected 1280x720/);
  assert.match(validateShot(fakePng(1280, 720, SHOT_MIN_BYTES - 1), want)[0], /blank/);
  assert.match(validateShot(fakePng(1280, 720, SHOT_MAX_BYTES + 1), want)[0], /maximum/);
  assert.equal(validateShot(fakePng(10, 10, 100), want).length, 2, 'wrong size and too small');
  assert.deepEqual(validateShot(fakePng(1280, 900, 50000), { ...want, height: 900 }), []);
  assert.deepEqual(validateShot(Buffer.from('nope nope nope nope nope nope'), want), ['not a PNG file']);
});

test('the shot list has ten unique, numbered names and URLs that exist or are game URLs', () => {
  assert.equal(SHOTS.length, 10);
  assert.equal(new Set(SHOTS.map((s) => s.name)).size, 10);
  SHOTS.forEach((s, i) => assert.ok(s.name.startsWith(String(i + 1).padStart(2, '0') + '-'), s.name));
  for (const s of SHOTS) {
    assert.ok(s.url.startsWith('/'), s.url);
    const path = s.url.split('?')[0];
    if (path === '/' || path.endsWith('.html')) assert.ok(existsSync(ROOT + (path === '/' ? 'index.html' : path.slice(1))), `${s.url} must exist`);
    assert.equal(typeof s.prepare, 'string');
    assert.ok(s.prepare.includes('ok'), `${s.name} must report a readiness result`);
  }
  for (const s of SHOTS.filter((x) => x.url.includes('__siege') || x.url.includes('debug=1'))) assert.ok(/mode=|seed=1/.test(s.url), s.url); // debug games are seeded
});

test('the committed screenshots exist and are exactly 1280x720 PNGs within the size bounds', () => {
  for (const s of SHOTS) {
    const file = `${ROOT}docs/screens/${s.name}.png`;
    assert.ok(existsSync(file), `${s.name}.png is missing: run npm run shots`);
    assert.deepEqual(validateShot(readFileSync(file), { width: SHOT_WIDTH, height: SHOT_HEIGHT }), [], s.name);
  }
});
