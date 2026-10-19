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

test('docs/EXPERIMENT.md documents amendment A1 and the planned next steps', () => {
  assert.ok(doc.includes('Amendments'));
  assert.ok(doc.includes('A1'));
  assert.ok(doc.includes('tiltObserved'));
  assert.ok(doc.includes('Planned next steps'));
  assert.ok(doc.includes('AFTER the tuning-set results had been seen'));
});

test('docs/EXPERIMENT.md documents amendment A2, the contrast hypotheses, the sensitivity analysis and the reward contrast', () => {
  for (const w of ['A2', 'ablation', 'contrast', 'reward contrast', 'Reward contrast', 'sensitivity', 'Sensitivity', 'empirical null', 'protocol version 3', 'noFrost', 'Early-ends']) assert.ok(doc.includes(w), w);
  assert.ok(doc.includes('made after seeing the tuning results of protocol versions 1 and 2 and the Phase 8B diagnostics') || doc.includes('after seeing the tuning results of protocol versions 1 and 2 and the Phase 8B diagnostics, before any held-out run'));
  assert.ok(doc.includes('A3'));
});

test('docs/EXPERIMENT.md documents the first look at the new arms and the plan for the next phase', () => {
  for (const w of ['First look', 'fixed-wave', 'validation', 'validation.lock.json', 'adaptive2', 'counter', 'Nothing was tuned', 'exactly 0 by construction', 'alpha in {0.35, 0.5, 0.7}', 'amendment A3']) assert.ok(doc.includes(w), w);
  assert.ok(doc.includes('before any validation or held-out run'));
});

test('docs/EXPERIMENT.md records the validation-split incident', () => {
  for (const w of ['Incident log', 'not pristine', 'tests/cli-lock.test.js']) assert.ok(doc.includes(w), w);
});

test('docs/EXPERIMENT.md has the Diagnostics and Figures sections and names the six figures', () => {
  assert.ok(doc.includes('## Diagnostics'));
  assert.ok(doc.includes('## Figures'));
  for (const f of ['fig1-forest.svg', 'fig2-lives-lost.svg', 'fig3-win-rate.svg', 'fig4-weights.svg', 'fig5-tilt-alignment.svg', 'fig6-diagnostics.svg']) assert.ok(doc.includes(f), f);
  for (const w of ['etaStyle', 'noise floor', 'npm run diagnose', 'npm run figures']) assert.ok(doc.includes(w), w);
});
