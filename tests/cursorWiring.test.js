import { test } from 'node:test';
import assert from 'node:assert/strict';

// The wiring creates one hidden live-region element; give Node a minimal document for the dom helper.
class FakeNode { constructor() { this.children = []; this.attrs = {}; this.textContent = ''; this.className = ''; } setAttribute(k, v) { this.attrs[k] = v; } append(...c) { this.children.push(...c); } addEventListener() {} }
globalThis.document = { createElement: () => new FakeNode() };
const { wireCursor } = await import('../src/ui/cursorWiring.js');
const { createBuildState } = await import('../src/ui/buildState.js');
const { createGame, startGame } = await import('../src/sim/game.js');
const { placeTower } = await import('../src/sim/towers.js');

function setup({ blocked = false } = {}) {
  const game = createGame({ seed: 1, startGold: 100000 });
  startGame(game);
  const buildState = createBuildState();
  const calls = [];
  const state = { blocked };
  const root = new FakeNode();
  const { keys, cursor } = wireCursor({ root, game, buildState, build: { placeAt: (c, r) => calls.push(['place', c, r]) }, waveControl: { start: () => calls.push(['start']) }, blocked: () => state.blocked, overlayOpen: () => false });
  const live = root.children[0];
  const press = (key) => { const ev = { prevented: false, preventDefault() { this.prevented = true; } }; keys[key](ev); return ev; };
  return { game, buildState, calls, keys, cursor, live, press, state };
}

test('arming a tower shows the ghost at the cursor and announces the tile; the live region is polite and hidden visually', () => {
  const s = setup();
  assert.equal(s.live.className, 'sr-only');
  assert.equal(s.live.attrs['aria-live'], 'polite');
  s.buildState.armTower('lance');
  assert.deepEqual([s.buildState.state.hoverCol, s.buildState.state.hoverRow], [9, 5]);
  assert.equal(s.live.textContent, 'Column 10, row 6: free');
});

test('arrows move the ghost only while placing, prevent scrolling then, and do nothing otherwise or behind a dialog', () => {
  const s = setup();
  assert.equal(s.press('ArrowRight').prevented, false); // idle: not intercepted
  assert.equal(s.buildState.state.hoverCol, null);
  s.buildState.armTower('lance');
  const ev = s.press('ArrowRight');
  assert.equal(ev.prevented, true);
  assert.deepEqual([s.buildState.state.hoverCol, s.buildState.state.hoverRow], [12, 5]); // jumps over the two blocked tiles
  assert.equal(s.live.textContent, 'Column 13, row 6: free');
  s.press('ArrowDown');
  assert.deepEqual([s.buildState.state.hoverCol, s.buildState.state.hoverRow], [12, 6]);
  s.state.blocked = true;
  const blocked = s.press('ArrowLeft');
  assert.equal(blocked.prevented, false);
  assert.deepEqual([s.buildState.state.hoverCol, s.buildState.state.hoverRow], [12, 6]);
});

test('moving the pointer hands control back: the next arrow starts from the hovered tile', () => {
  const s = setup();
  s.buildState.armTower('mortar');
  s.buildState.setHover(3, 3);
  s.press('ArrowRight');
  assert.deepEqual([s.buildState.state.hoverCol, s.buildState.state.hoverRow], [4, 3]);
});

test('Enter places at the cursor while placing, starts the wave otherwise, and does nothing behind a dialog', () => {
  const s = setup();
  s.press('Enter');
  assert.deepEqual(s.calls, [['start']]);
  s.buildState.armTower('lance');
  s.press('ArrowRight');
  s.press('Enter');
  assert.deepEqual(s.calls.at(-1), ['place', 12, 5]);
  assert.equal(s.calls.filter((c) => c[0] === 'start').length, 1, 'Enter while placing does not start the wave');
  s.buildState.cancel();
  s.state.blocked = true;
  const n = s.calls.length;
  s.press('Enter');
  assert.equal(s.calls.length, n);
  s.state.blocked = false;
  s.game.waves.phase = 'running'; // a wave in progress cannot be started
  s.press('Enter');
  assert.equal(s.calls.length, n);
});

test('[ and ] select the previous and next tower like a click, and do nothing without towers or behind a dialog', () => {
  const s = setup();
  s.press(']');
  assert.equal(s.buildState.state.mode, 'idle');
  const ids = [[4, 2], [5, 2]].map(([c, r]) => { placeTower(s.game, 'lance', c, r); return s.game.towers.at(-1).id; });
  s.press(']');
  assert.deepEqual([s.buildState.state.mode, s.buildState.state.towerId], ['selected', ids[0]]);
  s.press(']');
  assert.equal(s.buildState.state.towerId, ids[1]);
  s.press(']');
  assert.equal(s.buildState.state.towerId, ids[0]);
  s.press('[');
  assert.equal(s.buildState.state.towerId, ids[1]);
  s.state.blocked = true;
  s.press(']');
  assert.equal(s.buildState.state.towerId, ids[1]);
});
