// The committed demo fixture is a snapshot; this test does NOT compare it with a fresh run (regenerate it with npm run fixture:demo when the sim changes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateRun } from '../src/sim/telemetrySchema.js';
import { buildDirectorReport } from '../src/ui/directorReport.js';

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/fixtures/demo-adaptive-w15.json', import.meta.url)), 'utf8'));

test('the demo fixture is a valid 15-wave adaptive run with adapted waves', () => {
  assert.deepEqual(validateRun(fixture), []);
  assert.equal(fixture.meta.mode, 'adaptive');
  assert.equal(fixture.meta.totalWaves, 15);
  assert.ok(fixture.waves.some((w) => w.director && w.director.reason === 'adapted'));
});

test('the Director report can be built from the fixture', () => {
  const report = buildDirectorReport(fixture);
  assert.equal(report.available, true);
  assert.ok(report.insights.length >= 3, report.insights.join(' | '));
});
