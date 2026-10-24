import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const yml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const runs = [...yml.matchAll(/^\s*- run: (.+)$/gm)].map((m) => m[1].trim());

test('CI runs on push to main and on pull requests', () => {
  assert.match(yml, /^name: CI$/m);
  assert.match(yml, /^on:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request:/m);
});

test('one ubuntu job with checkout (full history and tags), Node 22 and the three commands in order', () => {
  assert.equal((yml.match(/^ {2}[a-z-]+:\s*$/gm) ?? []).filter((l) => !/^ {2}(push|pull_request):/.test(l)).length, 1, 'exactly one job');
  assert.match(yml, /runs-on: ubuntu-latest/);
  assert.match(yml, /uses: actions\/checkout@v4\n\s+with:\n\s+fetch-depth: 0\n\s+fetch-tags: true/);
  assert.match(yml, /uses: actions\/setup-node@v4\n\s+with:\n\s+node-version: 22/);
  assert.deepEqual(runs, ['npm test', 'npm run build:site', 'npm run hygiene']);
});

test('every command the workflow runs is a package.json script', () => {
  const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
  for (const r of runs) assert.ok(scripts[r.replace(/^npm (run )?/, '')], r);
});
