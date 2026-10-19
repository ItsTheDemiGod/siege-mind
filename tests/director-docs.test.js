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
