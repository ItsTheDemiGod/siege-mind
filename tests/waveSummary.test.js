import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWaveStrip, endSubtitle, lengthLabel } from '../src/ui/waveSummary.js';
import { ringDashOffset } from '../src/ui/waveControlState.js';

const entry = (wave, livesLost, complete = true, name = null) => ({ wave, name, fixed: false, complete, livesLost, kills: 1, leaks: livesLost });

test('all four statuses, heights and totals', () => {
  const log = [entry(1, 0), entry(2, 2), entry(3, 8, true, 'The Vanguard'), entry(4, 3, false)];
  const s = buildWaveStrip(log, 6);
  assert.deepEqual(s.cells.map((c) => c.status), ['clean', 'hurt', 'hurt', 'failed', 'unreached', 'unreached']);
  assert.equal(s.cells[0].heightFraction, 0);
  assert.equal(s.cells[2].heightFraction, 1);
  assert.equal(s.cells[1].heightFraction, 2 / 8);
  assert.equal(s.cells[3].heightFraction, 3 / 8);
  assert.equal(s.cells[4].heightFraction, 0);
  assert.equal(s.totalLivesLost, 13);
  assert.deepEqual(s.toughest, { wave: 3, name: 'The Vanguard', livesLost: 8 });
});

test('minimum height for any cell that lost lives or failed', () => {
  const s = buildWaveStrip([entry(1, 1), entry(2, 100)], 2);
  assert.equal(s.cells[0].heightFraction, 0.12);
  const failed = buildWaveStrip([entry(1, 0, false)], 1);
  assert.equal(failed.cells[0].status, 'failed');
  assert.equal(failed.cells[0].heightFraction, 0.12);
});

test('ties for toughest go to the earliest wave; no lives lost gives null', () => {
  assert.equal(buildWaveStrip([entry(1, 2), entry(2, 5), entry(3, 5)], 3).toughest.wave, 2);
  const clean = buildWaveStrip([entry(1, 0), entry(2, 0)], 2);
  assert.equal(clean.toughest, null);
  assert.equal(clean.totalLivesLost, 0);
  assert.ok(clean.cells.every((c) => c.heightFraction === 0));
});

test('an empty log is all unreached', () => {
  const s = buildWaveStrip([], 15);
  assert.equal(s.cells.length, 15);
  assert.ok(s.cells.every((c) => c.status === 'unreached'));
  assert.equal(s.toughest, null);
});

test('endSubtitle and lengthLabel', () => {
  assert.equal(endSubtitle('won', { totalWaves: 30, lives: 8, waves: { current: 30 } }), 'All 30 waves cleared with 8 lives left');
  assert.equal(endSubtitle('won', { totalWaves: 15, lives: 1, waves: { current: 15 } }), 'All 15 waves cleared with 1 life left');
  assert.equal(endSubtitle('lost', { totalWaves: 30, lives: 0, waves: { current: 12 } }), 'The core fell during wave 12');
  assert.equal(lengthLabel(15), 'Quick (15 waves)');
  assert.equal(lengthLabel(30), 'Full (30 waves)');
});

test('ringDashOffset: full ring at 1, empty at 0, clamped', () => {
  assert.equal(ringDashOffset(1, 100), 0);
  assert.equal(ringDashOffset(0, 100), 100);
  assert.equal(ringDashOffset(0.25, 100), 75);
  assert.equal(ringDashOffset(-3, 100), 100);
  assert.equal(ringDashOffset(9, 100), 0);
});
