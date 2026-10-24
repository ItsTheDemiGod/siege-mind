import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileCursor, describeTile, cycleSelection, resolveEnter, nextCursorState } from '../src/ui/tileCursor.js';
import { createMap } from '../src/sim/map.js';
import { DEFAULT_MAP } from '../src/data/map.js';
import { createGame, startGame } from '../src/sim/game.js';
import { placeTower, sellTower } from '../src/sim/towers.js';

const map = createMap(DEFAULT_MAP);
const at = (c) => { const p = c.get(); return [p.col, p.row]; };
const cursorAt = (col, row) => { const c = createTileCursor(map); c.set(col, row); return c; };
const newGame = () => { const g = createGame({ seed: 1, startGold: 100000 }); startGame(g); return g; };

test('the cursor starts on the buildable tile nearest the map centre (ties: smaller row, then column)', () => {
  assert.deepEqual(at(createTileCursor(map)), [9, 5]); // (10, 5) is blocked; (9, 5) and (10, 6) are one step away and the row 5 one wins
  assert.deepEqual(createTileCursor(map).nearestBuildable(0, 1), { col: 0, row: 0 }); // the spawn tile: (0,0) and (0,2) are tied, row 0 wins
  assert.deepEqual(createTileCursor(map).nearestBuildable(5, 0), { col: 5, row: 0 });
  assert.deepEqual(createTileCursor(map).nearestBuildable(1, 1), { col: 1, row: 0 }); // (1,0) before (0,1)? (0,1) is the spawn: (1,0) and (1,2) are tied, row 0 wins
});

test('moving jumps over path, spawn, exit and blocked tiles in all four directions', () => {
  let c = cursorAt(5, 0);
  assert.equal(c.move('down'), true); // (5,1) is path: lands on (5,2)
  assert.deepEqual(at(c), [5, 2]);
  c = cursorAt(8, 2);
  assert.equal(c.move('right'), true); // (9,2) blocked
  assert.deepEqual(at(c), [10, 2]);
  assert.equal(c.move('left'), true);
  assert.deepEqual(at(c), [7, 2]); // jumps back over both blocked tiles
  c = cursorAt(3, 3);
  assert.equal(c.move('down'), true); // (3,4) is path
  assert.deepEqual(at(c), [3, 5]);
  assert.equal(c.move('up'), true);
  assert.deepEqual(at(c), [3, 3]);
  c = cursorAt(18, 6);
  assert.equal(c.move('down'), true); // (18,7) is path, (18,8) free
  assert.deepEqual(at(c), [18, 8]);
});

test('moving stays put and returns false at the edges and when nothing is buildable ahead', () => {
  let c = cursorAt(19, 0);
  assert.equal(c.move('right'), false);
  assert.equal(c.move('up'), false);
  assert.deepEqual(at(c), [19, 0]);
  c = cursorAt(0, 9);
  assert.equal(c.move('left'), false);
  assert.equal(c.move('down'), false);
  c = cursorAt(18, 1); // row 1 is path from column 1 to 17, the spawn at column 0: nothing to the left
  assert.equal(c.move('left'), false);
  assert.deepEqual(at(c), [18, 1]);
  assert.equal(c.move('diagonal'), false);
});

test('set accepts any tile inside the map (a pointer may rest on a path tile) and rejects the outside', () => {
  const c = createTileCursor(map);
  assert.equal(c.set(3, 1), true);
  assert.deepEqual(at(c), [3, 1]);
  assert.equal(c.set(3, 1), false);
  assert.equal(c.set(-1, 0), false);
  assert.equal(c.set(20, 0), false);
  assert.equal(c.set(0, 10), false);
  assert.deepEqual(at(c), [3, 1]);
  assert.equal(c.move('up'), true); // from a path tile the next buildable tile above
  assert.deepEqual(at(c), [3, 0]);
});

test('describe gives free, occupied, path, blocked and outside texts with 1-based columns and rows', () => {
  const g = newGame();
  assert.equal(describeTile(g, 4, 2), 'Column 5, row 3: free');
  assert.equal(describeTile(g, 4, 1), 'Column 5, row 2: path');
  assert.equal(describeTile(g, 0, 1), 'Column 1, row 2: path'); // the spawn tile
  assert.equal(describeTile(g, 19, 7), 'Column 20, row 8: path'); // the exit tile
  assert.equal(describeTile(g, 8, 2), 'Column 9, row 3: blocked');
  assert.equal(describeTile(g, 40, 2), 'Column 41, row 3: outside the map');
  assert.equal(placeTower(g, 'mortar', 4, 2).ok, true);
  assert.equal(describeTile(g, 4, 2), 'Column 5, row 3: occupied by Mortar');
  const c = createTileCursor(g.map);
  c.set(4, 2);
  assert.equal(c.describe(g), 'Column 5, row 3: occupied by Mortar');
});

test('cycleSelection wraps in id order, handles a missing current id and the empty case', () => {
  const g = newGame();
  assert.equal(cycleSelection(g, 1, null), null);
  assert.equal(cycleSelection(g, -1, 5), null);
  const ids = [[4, 2], [5, 2], [6, 2]].map(([c, r]) => placeTower(g, 'lance', c, r).id ?? g.towers.at(-1).id);
  assert.deepEqual(g.towers.map((t) => t.id), ids);
  const [a, b, c] = ids;
  assert.equal(cycleSelection(g, 1, null), a);
  assert.equal(cycleSelection(g, -1, null), c);
  assert.equal(cycleSelection(g, 1, a), b);
  assert.equal(cycleSelection(g, 1, c), a); // wraps forward
  assert.equal(cycleSelection(g, -1, a), c); // wraps back
  assert.equal(cycleSelection(g, 1, 9999), a); // the selected tower is gone: start from the first
  sellTower(g, b);
  assert.equal(cycleSelection(g, 1, a), c);
});

test('resolveEnter: a dialog takes the key; placing places only after the cursor moved, otherwise a startable wave starts (all 48 combinations)', () => {
  for (const buildMode of ['idle', 'placing', 'selected']) for (const waveStartable of [false, true]) for (const overlayOpen of [false, true]) for (const dialogOpen of [false, true]) for (const cursorMoved of [false, true]) {
    const expected = dialogOpen ? 'none' : buildMode === 'placing' && cursorMoved ? 'place-at-cursor' : waveStartable ? 'start-wave' : 'none';
    assert.equal(resolveEnter({ buildMode, waveStartable, overlayOpen, dialogOpen, cursorMoved }), expected, JSON.stringify({ buildMode, waveStartable, overlayOpen, dialogOpen, cursorMoved }));
  }
});

test('nextCursorState: only an arrow move sets the flag; arm, placed and cancel clear it; unknown actions throw', () => {
  assert.equal(nextCursorState(false, 'moved'), true);
  assert.equal(nextCursorState(true, 'moved'), true);
  for (const action of ['arm', 'placed', 'cancel']) for (const from of [false, true]) assert.equal(nextCursorState(from, action), false, action);
  assert.throws(() => nextCursorState(false, 'jump'), RangeError);
});

test('the keyboard sequence arm, move, place, Enter starts the wave', () => {
  let moved = false;
  const enter = (waveStartable) => resolveEnter({ buildMode: 'placing', waveStartable, overlayOpen: false, dialogOpen: false, cursorMoved: moved });
  moved = nextCursorState(moved, 'arm');
  assert.equal(enter(true), 'start-wave'); // armed, not moved
  moved = nextCursorState(moved, 'moved');
  assert.equal(enter(true), 'place-at-cursor');
  moved = nextCursorState(moved, 'placed');
  assert.equal(enter(true), 'start-wave');
  assert.equal(enter(false), 'none');
});

test('every buildable tile is reachable from every other within cols + rows arrow moves', () => {
  const cells = map.buildableCells();
  const key = (col, row) => row * map.cols + col;
  const limit = map.cols + map.rows;
  let worst = 0;
  for (const from of cells) {
    const dist = new Map([[key(from.col, from.row), 0]]);
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];
      for (const dir of ['left', 'right', 'up', 'down']) {
        const c = createTileCursor(map);
        c.set(cur.col, cur.row);
        if (!c.move(dir)) continue;
        const p = c.get();
        if (!dist.has(key(p.col, p.row))) { dist.set(key(p.col, p.row), dist.get(key(cur.col, cur.row)) + 1); queue.push(p); }
      }
    }
    for (const to of cells) {
      const d = dist.get(key(to.col, to.row));
      assert.ok(d !== undefined, `(${to.col},${to.row}) unreachable from (${from.col},${from.row})`);
      assert.ok(d <= limit, `(${from.col},${from.row}) to (${to.col},${to.row}) needs ${d} moves`);
      if (d > worst) worst = d;
    }
  }
  assert.ok(worst >= 1);
});
