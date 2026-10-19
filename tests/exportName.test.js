import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportFilename, mimeFor } from '../src/ui/exportName.js';

const run = (over = {}, result = {}) => ({ meta: { seed: 1, mode: 'static', totalWaves: 15, ...over }, result: { result: 'won', wave: 15, ...result } });

test('every kind gets its own extension and MIME type', () => {
  const r = run();
  assert.equal(exportFilename(r, 'json'), 'siege-mind_seed-1_static_quick_won-w15.json');
  assert.equal(exportFilename(r, 'waves-csv'), 'siege-mind_seed-1_static_quick_won-w15.waves.csv');
  assert.equal(exportFilename(r, 'wavetypes-csv'), 'siege-mind_seed-1_static_quick_won-w15.wavetypes.csv');
  assert.equal(exportFilename(r, 'towers-csv'), 'siege-mind_seed-1_static_quick_won-w15.towers.csv');
  assert.equal(exportFilename(r, 'enemies-csv'), 'siege-mind_seed-1_static_quick_won-w15.enemies.csv');
  assert.equal(mimeFor('json'), 'application/json');
  for (const k of ['waves-csv', 'wavetypes-csv', 'towers-csv', 'enemies-csv']) assert.equal(mimeFor(k), 'text/csv');
  assert.throws(() => mimeFor('xml'), RangeError);
  assert.throws(() => exportFilename(r, 'xml'), RangeError);
});

test('result and final wave appear in the name', () => {
  assert.equal(exportFilename(run({}, { result: 'lost', wave: 12 }), 'json'), 'siege-mind_seed-1_static_quick_lost-w12.json');
  assert.equal(exportFilename(run({}, { result: null, wave: 9 }), 'waves-csv'), 'siege-mind_seed-1_static_quick_inprogress-w9.waves.csv');
});

test('15 waves is quick, 30 is full, anything else shows the number', () => {
  assert.match(exportFilename(run({ totalWaves: 15 }), 'json'), /_quick_/);
  assert.match(exportFilename(run({ totalWaves: 30 }), 'json'), /_full_/);
  assert.match(exportFilename(run({ totalWaves: 20 }), 'json'), /_w20_/);
});

test('odd seeds are reduced to safe characters', () => {
  for (const seed of ['my seed', 'a/b\\c', '../../x', 'héllo', 'tab\there', '日本', '😀', 'ok_1.2-3']) {
    const name = exportFilename(run({ seed }), 'json');
    assert.match(name, /^[A-Za-z0-9._-]+$/, `${seed} -> ${name}`);
    assert.ok(!name.includes('/') && !name.includes('\\'));
  }
  assert.match(exportFilename(run({ seed: 'my seed' }), 'json'), /^siege-mind_seed-my-seed_/);
  assert.match(exportFilename(run({ seed: 'ok_1.2-3' }), 'json'), /^siege-mind_seed-ok_1.2-3_/);
  assert.match(exportFilename(run({ seed: '😀' }), 'json'), /^siege-mind_seed--_/);
});
