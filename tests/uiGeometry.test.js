// Layout geometry of the Phase 7 UI at the 1280x720 logical stage, derived from config and from the numbers in style.css (read from disk, so drift is caught).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from '../src/data/config.js';
import { endCardLayout } from '../src/ui/endCardLayout.js';

const css = readFileSync(fileURLToPath(new URL('../src/ui/style.css', import.meta.url)), 'utf8');
const grab = (re, what) => { const m = re.exec(css); assert.ok(m, `style.css: ${what} not found`); return m; };
const token = (name) => Number(grab(new RegExp(`--${name}: (\\d+)px;`), name)[1]);

const { width: stageW, height: stageH, hudHeight: hudH } = config.view;
const trayM = grab(/\.build-tray \{[^}]*?left: (\d+)px;[^}]*?width: (\d+)px/s, '.build-tray');
const tray = { left: Number(trayM[1]), top: 0, w: Number(trayM[2]), h: hudH };
const buttonW = Number(grab(/\.btn--icon \{ width: (\d+)px/, '.btn--icon width')[1]);
const gap = token('space-4'); // .hud-cluster gap
const padX = token('space-5'); // .hud horizontal padding
assert.match(css, /\.hud-cluster \{[^}]*gap: var\(--space-4\)/);
assert.match(css, /\.hud \{[^}]*padding: 0 var\(--space-5\)/s);

const rect = (left, top, w, h) => ({ left, top, w, h });
const hits = (a, b) => a.left < b.left + b.w && b.left < a.left + a.w && a.top < b.top + b.h && b.top < a.top + a.h;

/** Rectangles of the right HUD cluster's buttons, left to right (the director button first when present). */
function rightCluster(count) {
  const total = count * buttonW + (count - 1) * gap;
  const left = stageW - padX - total;
  return Array.from({ length: count }, (_, i) => rect(left + i * (buttonW + gap), (hudH - buttonW) / 2, buttonW, buttonW));
}

test('the director HUD button sits left of the speed buttons and clears the tower tray and every other control', () => {
  const buttons = rightCluster(6); // director, speed x3, pause, settings
  const [director, ...others] = buttons;
  assert.ok(!hits(director, tray), `director button ${JSON.stringify(director)} vs tray ${JSON.stringify(tray)}`);
  assert.ok(director.left >= tray.left + tray.w, 'a clear gap to the tray');
  for (const b of others) assert.ok(!hits(director, b));
  for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) assert.ok(!hits(buttons[i], buttons[j]));
  for (const b of buttons) assert.ok(!hits(b, tray) && b.left + b.w <= stageW - padX + 0.001);
  assert.equal(others[0].left, director.left + buttonW + gap, 'directly left of the first speed button');
});

const { directorOverlayWidth: ow, directorOverlayMaxHeight: oh, directorOverlayMargin: om, waveControlWidth: cw, waveControlHeight: ch, waveControlBottomMargin: cb,
  wavePreviewWidth: pw, wavePreviewHeight: ph, wavePreviewGap: pg, towerPanelWidth: tw, towerPanelHeight: th, towerPanelMargin: tm } = config.ui;
const overlay = rect(stageW - om - ow, hudH + om, ow, oh);

test('the overlay is top right under the HUD strip and stays on the stage', () => {
  assert.equal(overlay.left + overlay.w, stageW - om);
  assert.equal(overlay.top, hudH + om);
  assert.ok(!hits(overlay, rect(0, 0, stageW, hudH)));
  assert.ok(overlay.top + overlay.h <= stageH);
});

test('the overlay never intersects the tower panels, wave control, wave preview, debug panel or the widest banner', () => {
  const panels = [rect(tm, stageH - tm - th, tw, th), rect(stageW - tm - tw, stageH - tm - th, tw, th)]; // bottom-left and bottom-right
  const control = rect((stageW - cw) / 2, stageH - cb - ch, cw, ch);
  const preview = rect((stageW - pw) / 2, control.top - pg - ph, pw, ph);
  const debug = rect((stageW - 560) / 2, hudH, 560, stageH - hudH); // top centre, max width 560, any height
  const banner = rect((stageW - 600) / 2, hudH, 600, stageH - hudH); // at most 600 wide, centered, any height
  for (const [name, r] of Object.entries({ panel0: panels[0], panel1: panels[1], control, preview, debug, banner })) {
    assert.ok(!hits(overlay, r), `overlay vs ${name}`);
  }
});

test('the wave control keeps clear of the stage bottom edge and of the preview', () => {
  const control = rect((stageW - cw) / 2, stageH - cb - ch, cw, ch);
  assert.ok(control.top + control.h <= stageH - cb);
  assert.ok(control.left >= 0 && control.left + control.w <= stageW);
  assert.equal(cw, 360);
  assert.ok(cw <= 420, 'never wider than 420');
});

test('the report modal and the end card clear the HUD strip and fit the stage', () => {
  const { top, maxHeight } = endCardLayout({ stageH, hudH, margin: config.ui.reportMargin });
  const card = rect((stageW - config.ui.reportWidth) / 2, top, config.ui.reportWidth, maxHeight);
  assert.ok(!hits(card, rect(0, 0, stageW, hudH)));
  assert.ok(card.left >= 0 && card.left + card.w <= stageW);
  assert.ok(card.top + card.h <= stageH);
  const endCard = rect((stageW - config.ui.endScreenWidth) / 2, top, config.ui.endScreenWidth, maxHeight);
  assert.ok(!hits(endCard, rect(0, 0, stageW, hudH)));
});
