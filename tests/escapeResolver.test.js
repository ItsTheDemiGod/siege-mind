import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEscape } from '../src/ui/escapeResolver.js';

const idle = { menuOpen: false, howToOpen: false, pauseMenuOpen: false, endScreenOpen: false, settingsOpen: false, buildMode: 'idle', gameOver: false };
const r = (o) => resolveEscape({ ...idle, ...o });

test('nothing open: Esc opens the pause menu', () => {
  assert.equal(r({}), 'open-pause-menu');
});

test('placing and selection come before the pause menu', () => {
  assert.equal(r({ buildMode: 'placing' }), 'cancel-placing');
  assert.equal(r({ buildMode: 'selected' }), 'clear-selection');
});

test('priority table', () => {
  const table = [
    [{ howToOpen: true }, 'close-howto'],
    [{ howToOpen: true, menuOpen: true }, 'close-howto'],
    [{ howToOpen: true, pauseMenuOpen: true, settingsOpen: true }, 'close-howto'],
    [{ menuOpen: true }, 'none'],
    [{ menuOpen: true, settingsOpen: true }, 'none'],
    [{ menuOpen: true, pauseMenuOpen: true }, 'none'],
    [{ settingsOpen: true }, 'none'],
    [{ settingsOpen: true, pauseMenuOpen: true }, 'none'],
    [{ settingsOpen: true, endScreenOpen: true, buildMode: 'placing' }, 'none'],
    [{ pauseMenuOpen: true }, 'close-pause-menu'],
    [{ pauseMenuOpen: true, endScreenOpen: true }, 'close-pause-menu'],
    [{ pauseMenuOpen: true, buildMode: 'placing' }, 'close-pause-menu'],
    [{ endScreenOpen: true, gameOver: true }, 'hide-end-screen'],
    [{ endScreenOpen: true, buildMode: 'selected', gameOver: true }, 'hide-end-screen'],
    [{ gameOver: true }, 'none'],
    [{ gameOver: true, buildMode: 'placing' }, 'cancel-placing'],
    [{ gameOver: true, buildMode: 'selected' }, 'clear-selection'],
    [{ buildMode: 'placing', pauseMenuOpen: false }, 'cancel-placing'],
  ];
  for (const [state, expected] of table) assert.equal(r(state), expected, JSON.stringify(state));
});

test('exactly one valid action for every combination', () => {
  const valid = new Set(['none', 'close-howto', 'close-pause-menu', 'hide-end-screen', 'cancel-placing', 'clear-selection', 'open-pause-menu']);
  const bools = [false, true];
  for (const menuOpen of bools) for (const howToOpen of bools) for (const pauseMenuOpen of bools) for (const endScreenOpen of bools)
    for (const settingsOpen of bools) for (const gameOver of bools) for (const buildMode of ['idle', 'placing', 'selected']) {
      const a = resolveEscape({ menuOpen, howToOpen, pauseMenuOpen, endScreenOpen, settingsOpen, buildMode, gameOver });
      assert.ok(valid.has(a));
      if (settingsOpen && !howToOpen) assert.equal(a, 'none');
    }
});

test('Phase 7: the Director report and overlay fit into the priority table', () => {
  const table = [
    [{ reportOpen: true }, 'close-report'],
    [{ reportOpen: true, howToOpen: true }, 'close-howto'],
    [{ reportOpen: true, menuOpen: true }, 'close-report'],
    [{ reportOpen: true, pauseMenuOpen: true, endScreenOpen: true }, 'close-report'],
    [{ reportOpen: true, endScreenOpen: true, gameOver: true }, 'close-report'],
    [{ overlayOpen: true }, 'close-overlay'],
    [{ overlayOpen: true, buildMode: 'placing' }, 'cancel-placing'],
    [{ overlayOpen: true, buildMode: 'selected' }, 'clear-selection'],
    [{ overlayOpen: true, pauseMenuOpen: true }, 'close-pause-menu'],
    [{ overlayOpen: true, endScreenOpen: true, gameOver: true }, 'hide-end-screen'],
    [{ overlayOpen: true, gameOver: true }, 'none'],
    [{ overlayOpen: true, settingsOpen: true }, 'none'],
    [{ overlayOpen: true, menuOpen: true }, 'none'],
    [{ overlayOpen: false, reportOpen: false }, 'open-pause-menu'],
  ];
  for (const [state, expected] of table) assert.equal(r(state), expected, JSON.stringify(state));
});
