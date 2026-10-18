import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMap, validateMap } from '../src/sim/map.js';
import { DEFAULT_MAP } from '../src/data/map.js';

const map = createMap(DEFAULT_MAP);
const clone = () => structuredClone(DEFAULT_MAP);
const setCell = (def, col, row, ch) => {
  def.grid[row] = def.grid[row].slice(0, col) + ch + def.grid[row].slice(col + 1);
  return def;
};

test('default map validates and has the expected tile counts', () => {
  assert.doesNotThrow(() => validateMap(DEFAULT_MAP));
  const counts = { total: 0, path: 0, blocked: 0, buildable: 0 };
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      counts.total++;
      if (map.isPath(c, r)) counts.path++;
      else if (map.tileAt(c, r) === '#') counts.blocked++;
      else if (map.isBuildable(c, r)) counts.buildable++;
    }
  }
  assert.deepEqual(counts, { total: 200, path: 56, blocked: 6, buildable: 138 });
  assert.equal(map.buildableCells().length, 138);
  assert.equal(map.width, 1280);
  assert.equal(map.height, 640);
});

test('path length is exactly 3520', () => {
  assert.equal(map.path.totalLength, 3520);
});

test('path endpoints are the spawn and exit tile centers', () => {
  const out = { x: 0, y: 0, angle: 0 };
  const spawn = map.tileToWorld(0, 1);
  const exit = map.tileToWorld(19, 7);
  map.path.positionAt(0, out);
  assert.deepEqual([out.x, out.y], [spawn.x, spawn.y]);
  map.path.positionAt(map.path.totalLength, out);
  assert.deepEqual([out.x, out.y], [exit.x, exit.y]);
});

test('segment ends land on waypoint centers; angles match direction', () => {
  const out = { x: 0, y: 0, angle: 0 };
  const lens = [17, 3, 15, 3, 17].map((n) => n * 64);
  const angles = [0, Math.PI / 2, Math.PI, Math.PI / 2, 0];
  let d = 0;
  lens.forEach((len, i) => {
    // sample slightly inside the segment for its angle, then exactly at its end for position
    map.path.positionAt(d + len / 2, out);
    assert.ok(Math.abs(out.angle - angles[i]) < 1e-9, `segment ${i} angle ${out.angle}`);
    d += len;
    map.path.positionAt(d, out);
    const w = DEFAULT_MAP.waypoints[i + 1];
    const c = map.tileToWorld(w.col, w.row);
    assert.deepEqual([out.x, out.y], [c.x, c.y]);
  });
});

test('distance outside [0,total] is clamped', () => {
  const a = { x: 0, y: 0, angle: 0 };
  const b = { x: 0, y: 0, angle: 0 };
  map.path.positionAt(-50, a);
  map.path.positionAt(0, b);
  assert.deepEqual(a, b);
  map.path.positionAt(99999, a);
  map.path.positionAt(map.path.totalLength, b);
  assert.deepEqual(a, b);
});

test('progressAt', () => {
  const total = map.path.totalLength;
  assert.equal(map.path.progressAt(0), 0);
  assert.equal(map.path.progressAt(total), 1);
  const mid = map.path.progressAt(total / 2);
  assert.ok(mid > 0 && mid < 1);
  assert.equal(map.path.progressAt(-5), 0);
  assert.equal(map.path.progressAt(total * 2), 1);
});

test('worldToTile and tileToWorld are inverses; outside returns null', () => {
  for (const [c, r] of [[0, 0], [19, 9], [5, 5], [17, 4]]) {
    const w = map.tileToWorld(c, r);
    assert.deepEqual(map.worldToTile(w.x, w.y), { col: c, row: r });
  }
  assert.equal(map.worldToTile(-1, 10), null);
  assert.equal(map.worldToTile(10, -1), null);
  assert.equal(map.worldToTile(1280, 10), null);
  assert.equal(map.worldToTile(10, 640), null);
  assert.equal(map.tileAt(20, 0), null);
});

test('isBuildable is false on path, spawn, exit and blocked tiles', () => {
  assert.equal(map.isBuildable(5, 1), false);
  assert.equal(map.isBuildable(0, 1), false);
  assert.equal(map.isBuildable(19, 7), false);
  assert.equal(map.isBuildable(8, 2), false);
  assert.equal(map.isBuildable(0, 0), true);
});

test('invalid: wrong row count', () => {
  const d = clone();
  d.grid.pop();
  assert.throws(() => validateMap(d), /rows/);
});
test('invalid: wrong row length', () => {
  const d = clone();
  d.grid[0] += '.';
  assert.throws(() => validateMap(d), /columns/);
});
test('invalid: unknown character', () => {
  assert.throws(() => validateMap(setCell(clone(), 0, 0, 'X')), /Unknown map character/);
});
test('invalid: no spawn', () => {
  assert.throws(() => validateMap(setCell(clone(), 0, 1, 'P')), /spawn/);
});
test('invalid: two exits', () => {
  assert.throws(() => validateMap(setCell(clone(), 18, 7, 'E')), /exit/);
});
test('invalid: fewer than 2 waypoints', () => {
  const d = clone();
  d.waypoints = [d.waypoints[0]];
  assert.throws(() => validateMap(d), /2 waypoints/);
});
test('invalid: waypoint out of bounds', () => {
  const d = clone();
  d.waypoints[2] = { col: 17, row: 40 };
  assert.throws(() => validateMap(d), /out of bounds/);
});
test('invalid: non-axis-aligned waypoints', () => {
  const d = clone();
  d.waypoints[1] = { col: 17, row: 2 };
  assert.throws(() => validateMap(d), /axis-aligned/);
});
test('invalid: identical consecutive waypoints', () => {
  const d = clone();
  d.waypoints.splice(1, 0, { ...d.waypoints[0] });
  assert.throws(() => validateMap(d), /identical/);
});
test('invalid: first waypoint not on spawn', () => {
  const d = clone();
  d.waypoints[0] = { col: 1, row: 1 };
  assert.throws(() => validateMap(d), /spawn tile/);
});
test('invalid: last waypoint not on exit', () => {
  const d = clone();
  d.waypoints[5] = { col: 18, row: 7 };
  assert.throws(() => validateMap(d), /exit tile/);
});
test('invalid: stray path tile off the polyline', () => {
  assert.throws(() => validateMap(setCell(clone(), 10, 9, 'P')), /not on the waypoint polyline/);
});
test('invalid: polyline tile not marked as path', () => {
  assert.throws(() => validateMap(setCell(clone(), 5, 1, '.')), /not marked as path/);
});

// ---- path.sampleAt (lane offsets with corner blending) ----
const sp = { x: 0, y: 0, angle: 0 };
const nearTo = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('sampleAt: lane 0 equals positionAt away from corners; heading is the segment angle mid-segment', () => {
  const ref = { x: 0, y: 0, angle: 0 };
  for (const d of [100, 600, 1200, 1700, 2500, 3300]) {
    map.path.sampleAt(d, 0, sp);
    map.path.positionAt(d, ref);
    nearTo(sp.x, ref.x); nearTo(sp.y, ref.y); nearTo(sp.angle, ref.angle);
  }
});

test('sampleAt: continuous through all corners for lanes +10 and -10', () => {
  for (const lane of [10, -10]) {
    let prev = { ...map.path.sampleAt(0, lane, { x: 0, y: 0, angle: 0 }) };
    for (let d = 1; d <= map.path.totalLength; d++) {
      map.path.sampleAt(d, lane, sp);
      assert.ok(Math.hypot(sp.x - prev.x, sp.y - prev.y) <= 3, `jump at ${d} lane ${lane}`);
      prev = { ...sp };
    }
  }
});

test('sampleAt: heading turns smoothly by PI/2 through a corner', () => {
  const corner = 17 * 64; // end of the first segment
  let prev = map.path.sampleAt(corner - 45, 0, { x: 0, y: 0, angle: 0 }).angle;
  const start = prev;
  let last = prev;
  for (let d = corner - 44; d <= corner + 45; d++) {
    map.path.sampleAt(d, 0, sp);
    assert.ok(Math.abs(sp.angle - last) <= 0.1, `angle jump at ${d}`);
    assert.ok(sp.angle >= last - 1e-12, 'monotonic'); // right turn: angle increases
    last = sp.angle;
  }
  nearTo(Math.abs(last - start), Math.PI / 2, 1e-9);
});

test('sampleAt: clamps distance and reuses out', () => {
  const a = map.path.sampleAt(-100, 5, { x: 0, y: 0, angle: 0 });
  const b = map.path.sampleAt(0, 5, { x: 0, y: 0, angle: 0 });
  assert.deepEqual(a, b);
  const c = map.path.sampleAt(1e9, 5, { x: 0, y: 0, angle: 0 });
  const d = map.path.sampleAt(map.path.totalLength, 5, { x: 0, y: 0, angle: 0 });
  assert.deepEqual(c, d);
  const out = { x: 0, y: 0, angle: 0 };
  assert.equal(map.path.sampleAt(100, 0, out), out);
});
