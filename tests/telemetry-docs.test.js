import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGame } from '../src/sim/game.js';
import { attachTelemetry } from '../src/sim/telemetry.js';
import { ENEMY_CSV_COLUMNS, WAVE_CSV_COLUMNS, WAVE_TYPE_CSV_COLUMNS, TOWER_CSV_COLUMNS } from '../src/sim/telemetrySchema.js';

const doc = readFileSync(fileURLToPath(new URL('../docs/TELEMETRY.md', import.meta.url)), 'utf8');

test('docs/TELEMETRY.md mentions every CSV column', () => {
  for (const [name, list] of Object.entries({ ENEMY_CSV_COLUMNS, WAVE_CSV_COLUMNS, WAVE_TYPE_CSV_COLUMNS, TOWER_CSV_COLUMNS })) {
    for (const col of list) assert.ok(doc.includes(col), `${name}: ${col} is not documented`);
  }
});

test('docs/TELEMETRY.md mentions every top-level key of a real run', () => {
  const run = attachTelemetry(createGame({ seed: 1, debugSpawnEveryTicks: 0 }), { detail: 'full' }).getRun();
  for (const key of Object.keys(run)) assert.ok(doc.includes(`\`${key}\``), `top-level key ${key} is not documented`);
});
