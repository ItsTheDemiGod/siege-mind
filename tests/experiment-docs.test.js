import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROTOCOL } from '../experiments/protocol.js';

const doc = readFileSync(fileURLToPath(new URL('../docs/EXPERIMENT.md', import.meta.url)), 'utf8');

test('docs/EXPERIMENT.md pre-registers every hypothesis, metric, style and the lock', () => {
  for (const h of PROTOCOL.hypotheses) assert.ok(doc.includes(h.id), `hypothesis ${h.id}`);
  for (const m of ['livesLost', 'won', 'finalWave', 'leakFraction', 'penetration', 'tiltAligned']) assert.ok(doc.includes(m), `metric ${m}`);
  for (const s of PROTOCOL.styles) assert.ok(doc.includes(s), `style ${s}`);
  for (const w of ['experiments/heldout.lock.json', 'held-out', 'tuning', 'calibration', 'Holm', 'bootstrap', 'sign-flip']) assert.ok(doc.includes(w), w);
});

test('docs/EXPERIMENT.md matches the registered seed sets, knobs and thresholds', () => {
  const { tuning, heldout, calibration } = PROTOCOL.seedSets;
  assert.ok(doc.includes(`${calibration.start}-${calibration.start + calibration.count - 1}`));
  assert.ok(doc.includes(`${tuning.start}-${tuning.start + tuning.count - 1}`));
  assert.ok(doc.includes(`${heldout.start}-${heldout.start + heldout.count - 1}`));
  assert.ok(doc.includes(`tilePool ${PROTOCOL.botKnobs.tilePool}, focusWeight ${PROTOCOL.botKnobs.focusWeight}, upgradeAfter ${PROTOCOL.botKnobs.upgradeAfter}`));
  assert.ok(doc.includes(String(PROTOCOL.stats.seed)));
  assert.ok(doc.includes(String(PROTOCOL.stats.alignmentThreshold)));
});
