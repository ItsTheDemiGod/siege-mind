// The first-run hint card on the real map: clear of every path, spawn and exit tile and of every other fixed element of the 1280x720 stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { createMap } from '../src/sim/map.js';
import { DEFAULT_MAP } from '../src/data/map.js';
import { HINT_GEOMETRY as G } from '../src/ui/tutorialText.js';
import { HINT_CANDIDATES, avoidRectsFor, hintRectFor, placeHintCard, tileRects } from '../src/ui/hintPlacement.js';

const { width: stageW, height: stageH, hudHeight: hudH } = config.view;
const hits = (a, b) => a.left < b.left + b.w && b.left < a.left + a.w && a.top < b.top + b.h && b.top < a.top + a.h;
const map = createMap(DEFAULT_MAP);

test('on the real map the card avoids every path, spawn and exit tile and every fixed UI element, and stays inside the stage', () => {
  const card = hintRectFor(map, G.width, G.maxHeight, G.margin);
  const { path } = tileRects(map, config.world.tileSize, hudH);
  assert.ok(path.length > 0);
  for (const t of path) assert.ok(!hits(card, t), `path tile ${JSON.stringify(t)}`);
  for (const a of avoidRectsFor()) assert.ok(!hits(card, a), JSON.stringify(a));
  assert.ok(card.left >= G.margin && card.top >= hudH && card.left + card.w <= stageW - G.margin && card.top + card.h <= stageH - G.margin);
  assert.ok(HINT_CANDIDATES.length >= 8);
});

test('the spawn and exit tiles are among the blocked tiles', () => {
  const { path } = tileRects(map, config.world.tileSize, hudH);
  const has = (col, row) => path.some((t) => t.left === col * 64 && t.top === hudH + row * 64);
  assert.ok(has(0, 1) && has(19, 7));
});

const base = { stageW: 100, stageH: 100, hudH: 10, cardW: 20, cardH: 20, margin: 5, blockedRects: [], avoidRects: [] };
const rect = (left, top, w, h) => ({ left, top, w, h });

test('placeHintCard picks the candidate covering the fewest buildable tiles; ties go to the earlier candidate', () => {
  const buildableRects = [rect(10, 20, 20, 20), rect(10, 40, 20, 20), rect(50, 20, 20, 20)];
  const candidates = [[10, 20], [50, 20], [70, 70]]; // covers 1 (first tile), 1 (third tile), 0
  assert.deepEqual(placeHintCard({ ...base, candidates, buildableRects }), rect(70, 70, 20, 20));
  assert.deepEqual(placeHintCard({ ...base, candidates: candidates.slice(0, 2), buildableRects }), rect(10, 20, 20, 20), 'tie: earlier candidate');
});

test('placeHintCard skips candidates that hit a blocked or avoided rect, leave the stage or enter the HUD', () => {
  const candidates = [[10, 20], [0, 20], [10, 5], [80, 20], [40, 40]];
  const got = placeHintCard({ ...base, candidates, blockedRects: [rect(10, 20, 5, 5)], avoidRects: [] });
  assert.deepEqual(got, rect(40, 40, 20, 20)); // (10,20) blocked, (0,20) under the margin, (10,5) in the HUD, (80,20) off the right edge
  assert.deepEqual(placeHintCard({ ...base, candidates: [[10, 20], [40, 40]], avoidRects: [rect(10, 20, 5, 5)] }), rect(40, 40, 20, 20));
});

test('placeHintCard throws when no candidate is valid', () => {
  assert.throws(() => placeHintCard({ ...base, candidates: [[10, 20]], blockedRects: [rect(0, 0, 100, 100)] }), RangeError);
  assert.throws(() => placeHintCard({ ...base, candidates: [] }), RangeError);
});
