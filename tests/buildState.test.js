import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBuildState } from '../src/ui/buildState.js';

test('starts idle', () => {
  const b = createBuildState();
  assert.deepEqual(b.state, { mode: 'idle', typeId: null, towerId: null, hoverCol: null, hoverRow: null });
});

test('armTower enters placing; arming the same type again toggles off; another type switches', () => {
  const b = createBuildState();
  b.armTower('lance');
  assert.deepEqual([b.state.mode, b.state.typeId], ['placing', 'lance']);
  b.armTower('mortar');
  assert.deepEqual([b.state.mode, b.state.typeId], ['placing', 'mortar']);
  b.armTower('mortar');
  assert.deepEqual([b.state.mode, b.state.typeId], ['idle', null]);
});

test('arming clears a selection; selecting clears the armed type', () => {
  const b = createBuildState();
  b.selectTower(7);
  b.armTower('frost');
  assert.deepEqual([b.state.mode, b.state.typeId, b.state.towerId], ['placing', 'frost', null]);
  b.selectTower(9);
  assert.deepEqual([b.state.mode, b.state.typeId, b.state.towerId], ['selected', null, 9]);
});

test('cancel leaves placing and selected; clearSelection only affects selected', () => {
  const b = createBuildState();
  b.armTower('lance');
  b.clearSelection();
  assert.equal(b.state.mode, 'placing'); // clearSelection does not cancel placing
  b.cancel();
  assert.equal(b.state.mode, 'idle');
  b.selectTower(3);
  b.cancel();
  assert.deepEqual([b.state.mode, b.state.towerId], ['idle', null]);
  b.selectTower(3);
  b.clearSelection();
  assert.equal(b.state.mode, 'idle');
  assert.doesNotThrow(() => { b.cancel(); b.clearSelection(); });
});

test('hover is stored and may be null; it survives mode changes', () => {
  const b = createBuildState();
  b.setHover(4, 5);
  b.armTower('lance');
  assert.deepEqual([b.state.hoverCol, b.state.hoverRow], [4, 5]);
  b.setHover(null, null);
  assert.deepEqual([b.state.hoverCol, b.state.hoverRow], [null, null]);
});

test('onSellOrRemove clears only the matching selection', () => {
  const b = createBuildState();
  b.selectTower(5);
  b.onSellOrRemove(6);
  assert.equal(b.state.mode, 'selected');
  b.onSellOrRemove(5);
  assert.deepEqual([b.state.mode, b.state.towerId], ['idle', null]);
  b.armTower('lance');
  b.onSellOrRemove(5);
  assert.equal(b.state.mode, 'placing');
});

test('route: placing -> place; tower tile -> select; empty -> deselect or deselect-then-debug', () => {
  const b = createBuildState();
  assert.equal(b.route({ towerAtTile: null, debugToolsEnabled: false }), 'deselect');
  assert.equal(b.route({ towerAtTile: null, debugToolsEnabled: true }), 'deselect-then-debug');
  assert.equal(b.route({ towerAtTile: 4, debugToolsEnabled: true }), 'select');
  b.armTower('lance');
  assert.equal(b.route({ towerAtTile: 4, debugToolsEnabled: true }), 'place');
  assert.equal(b.route({ towerAtTile: null, debugToolsEnabled: false }), 'place');
});

test('subscribers fire on changes only and can unsubscribe', () => {
  const b = createBuildState();
  let n = 0;
  const off = b.subscribe(() => n++);
  b.setHover(1, 1);
  b.setHover(1, 1); // unchanged
  b.armTower('lance');
  assert.equal(n, 2);
  b.cancel();
  off();
  b.armTower('lance');
  assert.equal(n, 3);
});
