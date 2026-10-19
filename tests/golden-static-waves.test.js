// The golden files were generated from the Phase 5 code BEFORE the shared composer existed. Never regenerate them:
// if this test fails, the refactor changed the static waves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATIC_WAVES, STATIC_THREAT } from '../src/data/waves.js';

const read = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`./golden/${name}`, import.meta.url)), 'utf8'));

test('STATIC_WAVES deep-equals the golden file', () => {
  const golden = read('static-waves.json');
  assert.equal(golden.length, 30);
  assert.equal(STATIC_WAVES.length, 30);
  assert.deepEqual(JSON.parse(JSON.stringify(STATIC_WAVES)), golden);
});

test('STATIC_THREAT deep-equals the golden file', () => {
  const golden = read('static-threat.json');
  assert.equal(golden.length, 30);
  assert.equal(STATIC_THREAT.length, 30);
  assert.deepEqual([...STATIC_THREAT], golden);
});
