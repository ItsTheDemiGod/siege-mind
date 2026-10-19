// The first-run hint card (top left under the HUD) against every other fixed element of the 1280x720 stage, with the real constants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { HINT_GEOMETRY as G } from '../src/ui/tutorialText.js';

const { width: stageW, height: stageH, hudHeight: hudH } = config.view;
const rect = (left, top, w, h) => ({ left, top, w, h });
const hits = (a, b) => a.left < b.left + b.w && b.left < a.left + a.w && a.top < b.top + b.h && b.top < a.top + a.h;
const { directorOverlayWidth: ow, directorOverlayMaxHeight: oh, directorOverlayMargin: om, waveControlWidth: cw, waveControlHeight: ch, waveControlBottomMargin: cb,
  wavePreviewWidth: pw, wavePreviewHeight: ph, wavePreviewGap: pg, towerPanelWidth: tw, towerPanelHeight: th, towerPanelMargin: tm } = config.ui;

const card = rect(G.left, hudH + G.topOffset, G.width, G.maxHeight);

test('the hint card sits under the HUD strip, inside the stage, with the specified margin', () => {
  assert.equal(card.top, hudH + 8);
  assert.equal(card.left, G.margin);
  assert.ok(card.left + card.w <= stageW && card.top + card.h <= stageH);
  assert.ok(!hits(card, rect(0, 0, stageW, hudH)), 'not over the HUD strip');
});

test('the hint card never intersects the banner, the Director overlay, the debug panel, the bottom panels, the wave control or the wave preview', () => {
  const banner = rect((stageW - 600) / 2, hudH + 72, 600, stageH - hudH - 72); // at most 600 wide, centered, from HUD height + 72 down
  const overlay = rect(stageW - om - ow, hudH + om, ow, oh);
  const debug = rect((stageW - 560) / 2, hudH, 560, stageH - hudH);
  const panels = [rect(tm, stageH - tm - th, tw, th), rect(stageW - tm - tw, stageH - tm - th, tw, th)];
  const control = rect((stageW - cw) / 2, stageH - cb - ch, cw, ch);
  const preview = rect((stageW - pw) / 2, control.top - pg - ph, pw, ph);
  for (const [name, r] of Object.entries({ banner, overlay, debug, panel0: panels[0], panel1: panels[1], control, preview })) assert.ok(!hits(card, r), `${name} ${JSON.stringify(r)}`);
});
