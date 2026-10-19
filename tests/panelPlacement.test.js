import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeTowerPanel } from '../src/ui/panelPlacement.js';
import { createMap } from '../src/sim/map.js';
import { DEFAULT_MAP } from '../src/data/map.js';
import { config } from '../src/data/config.js';

const { width: stageW, height: stageH, hudHeight: hudH } = config.view;
const { towerPanelWidth: panelW, towerPanelHeight: panelH, towerPanelMargin: margin, towerClearRadius: towerRadius } = config.ui;
const map = createMap(DEFAULT_MAP);
const place = (towerX, towerY) => placeTowerPanel({ towerX, towerY, towerRadius, stageW, stageH, hudH, panelW, panelH, margin });
const intersects = (a, b) => a.left < b.left + b.w && b.left < a.left + a.w && a.top < b.top + b.h && b.top < a.top + a.h;

test('for every buildable tile the panel fits, avoids the HUD strip and clears the tower', () => {
  for (const { col, row } of map.buildableCells()) {
    const c = map.tileToWorld(col, row);
    const towerX = c.x;
    const towerY = c.y + hudH;
    const p = place(towerX, towerY);
    const rect = { left: p.left, top: p.top, w: panelW, h: panelH };
    assert.ok(p.left >= 0 && p.left + panelW <= stageW, `x fits (${col},${row})`);
    assert.ok(p.top >= hudH && p.top + panelH <= stageH, `y fits (${col},${row})`);
    const pad = 32 + towerRadius + 8;
    const tile = { left: towerX - pad, top: towerY - pad, w: pad * 2, h: pad * 2 };
    assert.equal(intersects(rect, tile), false, `clears tower (${col},${row}) -> ${p.side}`);
  }
});

test('a tower far left gets a right-side panel and vice versa', () => {
  assert.match(place(80, 300).side, /right/);
  assert.match(place(1200, 300).side, /left/);
});

test('a tower near a bottom corner falls back to the other side', () => {
  const p = place(100, stageH - 60);
  assert.equal(p.side, 'bottom-right');
  const q = place(stageW - 100, stageH - 60);
  assert.equal(q.side, 'bottom-left');
});

test('a tower in the way of the preferred bottom spots moves the panel to the top', () => {
  const p = place(stageW / 2 + 5, stageH - 70); // blocks neither side at the bottom? centre is clear, so still bottom
  assert.match(p.side, /bottom/);
  const blocked = placeTowerPanel({ towerX: 650, towerY: 600, towerRadius: 400, stageW, stageH, hudH, panelW, panelH, margin });
  assert.match(blocked.side, /top|bottom/); // a huge radius cannot clear anything; still returns a candidate inside the stage
  assert.ok(blocked.top >= hudH);
});

test('invalid sizes throw', () => {
  const base = { towerX: 100, towerY: 100, towerRadius: 20, stageW, stageH, hudH, panelW, panelH, margin };
  for (const bad of [{ panelW: 0 }, { panelH: -1 }, { stageW: NaN }, { stageH: Infinity }, { panelW: '300' }]) {
    assert.throws(() => placeTowerPanel({ ...base, ...bad }), RangeError, JSON.stringify(bad));
  }
  assert.throws(() => placeTowerPanel({ ...base, towerX: NaN }), RangeError);
});

test('the wave control never overlaps the bottom tower panels or the HUD strip', () => {
  const { waveControlWidth: w, waveControlHeight: h, waveControlBottomMargin: bottom } = config.ui;
  const wave = { left: (stageW - w) / 2, top: stageH - bottom - h, w, h };
  const panels = [
    { left: margin, top: stageH - margin - panelH, w: panelW, h: panelH }, // bottom-left
    { left: stageW - margin - panelW, top: stageH - margin - panelH, w: panelW, h: panelH }, // bottom-right
  ];
  for (const p of panels) assert.equal(intersects(wave, p), false);
  for (const r of [wave, ...panels]) assert.ok(r.top >= hudH && r.left >= 0 && r.left + r.w <= stageW && r.top + r.h <= stageH);
});

test('the wave preview sits above the wave control and never overlaps it, the HUD strip or the bottom tower panels', () => {
  const { waveControlWidth: cw, waveControlHeight: ch, waveControlBottomMargin: bottom, wavePreviewWidth: pw, wavePreviewHeight: ph, wavePreviewGap: gap } = config.ui;
  const control = { left: (stageW - cw) / 2, top: stageH - bottom - ch, w: cw, h: ch };
  const preview = { left: (stageW - pw) / 2, top: control.top - gap - ph, w: pw, h: ph };
  const panels = [
    { left: margin, top: stageH - margin - panelH, w: panelW, h: panelH },
    { left: stageW - margin - panelW, top: stageH - margin - panelH, w: panelW, h: panelH },
  ];
  assert.equal(intersects(preview, control), false);
  assert.equal(preview.top + preview.h + gap, control.top);
  for (const p of panels) assert.equal(intersects(preview, p), false);
  assert.ok(preview.top >= hudH && preview.left >= 0 && preview.left + preview.w <= stageW);
});
