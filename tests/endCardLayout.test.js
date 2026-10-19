import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { endCardLayout } from '../src/ui/endCardLayout.js';

test('the card rectangle never intersects the HUD strip and stays inside the stage', () => {
  for (const margin of [config.ui.reportMargin, config.ui.towerPanelMargin]) {
    const { top, maxHeight } = endCardLayout({ stageH: config.view.height, hudH: config.view.hudHeight, margin });
    assert.ok(top >= config.view.hudHeight, 'clears the HUD strip');
    assert.ok(top + maxHeight <= config.view.height, 'inside the stage');
    assert.equal(top, config.view.hudHeight + margin);
    assert.equal(maxHeight, config.view.height - config.view.hudHeight - 2 * margin);
    assert.equal(config.view.height - (top + maxHeight), margin, 'same margin below');
  }
});

test('invalid inputs throw', () => {
  const ok = { stageH: 720, hudH: 80, margin: 12 };
  for (const bad of [{ stageH: NaN }, { hudH: Infinity }, { margin: 0 }, { margin: -4 }, { stageH: '720' }, { hudH: 0 }]) {
    assert.throws(() => endCardLayout({ ...ok, ...bad }), RangeError, JSON.stringify(bad));
  }
  assert.throws(() => endCardLayout({ stageH: 100, hudH: 80, margin: 12 }), /no room/);
  assert.throws(() => endCardLayout({ stageH: 104, hudH: 80, margin: 12 }), /no room/);
  assert.doesNotThrow(() => endCardLayout({ stageH: 105, hudH: 80, margin: 12 }));
});
