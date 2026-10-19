import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from '../src/data/config.js';
import { DECISION_KEYS } from '../src/sim/director.js';

const read = (name) => readFileSync(fileURLToPath(new URL(`../docs/${name}`, import.meta.url)), 'utf8');

for (const name of ['DIRECTOR.md', 'TELEMETRY.md']) {
  test(`docs/${name} mentions every config.director key and every decision key`, () => {
    const doc = read(name);
    for (const key of Object.keys(config.director)) assert.ok(doc.includes(key), `${name}: config key ${key}`);
    for (const key of DECISION_KEYS) assert.ok(doc.includes(key), `${name}: decision key ${key}`);
  });
}

test('docs/DIRECTOR.md describes the overlay and every report insight rule', () => {
  const doc = read('DIRECTOR.md');
  assert.ok(doc.includes("Director's Report"));
  assert.ok(doc.includes('Reading the overlay'));
  for (let n = 1; n <= 5; n++) assert.ok(doc.includes(`Insight ${n}`), `Insight ${n}`);
});

test('docs/DIRECTOR.md documents Director v2 and the counter arm: every config key and every decision key', async () => {
  const { DECISION_KEYS_V2 } = await import('../src/sim/directorV2.js');
  const { DECISION_KEYS_COUNTER } = await import('../src/sim/directorCounter.js');
  const doc = read('DIRECTOR.md');
  assert.ok(doc.includes('Director v2 (adaptive2)') && doc.includes('Informed counter arm (counter)'));
  const v2Part = doc.slice(doc.indexOf('## Director v2 (adaptive2)'), doc.indexOf('## Informed counter arm (counter)'));
  const counterPart = doc.slice(doc.indexOf('## Informed counter arm (counter)'));
  for (const key of Object.keys(config.directorV2)) assert.ok(v2Part.includes(key), `directorV2 key ${key}`);
  for (const key of Object.keys(config.counter)) assert.ok(counterPart.includes(key), `counter key ${key}`);
  for (const key of DECISION_KEYS_V2) assert.ok(doc.includes(key), `v2 decision key ${key}`);
  for (const key of DECISION_KEYS_V2.filter((k) => !DECISION_KEYS.includes(k))) assert.ok(v2Part.includes(key), `new v2 decision key ${key}`);
  for (const key of ['norm', 'shrunk']) assert.ok(v2Part.includes(key), key);
  for (const key of DECISION_KEYS_COUNTER.filter((k) => !DECISION_KEYS.includes(k))) assert.ok(counterPart.includes(key), `new counter decision key ${key}`);
  assert.ok(v2Part.includes('Full games') && counterPart.includes('ceiling'));
});
