import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('test runner works', () => {
  assert.equal(1 + 1, 2);
});

test('package.json is named siege-mind', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'siege-mind');
});
