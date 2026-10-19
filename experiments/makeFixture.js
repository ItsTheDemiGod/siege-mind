// Writes docs/fixtures/demo-adaptive-w15.json: a 15-wave adaptive run (balanced bot, seed 1, summary telemetry) for the gallery and the tests.
// Regenerate with `npm run fixture:demo` whenever the sim changes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playGame } from './playthrough.js';
import { getBot } from './bots.js';
import { runToJson } from '../src/sim/telemetryExport.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/fixtures/demo-adaptive-w15.json');

const { run } = playGame({ seed: 1, totalWaves: 15, bot: getBot('balanced'), mode: 'adaptive', telemetry: 'summary', meta: { app: 'siege-mind-fixture' } });
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, runToJson(run));
console.log(`wrote ${OUT}`);
