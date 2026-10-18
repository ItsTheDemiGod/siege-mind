import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWER_SHAPES, shapePoints, tierMark } from '../src/render/towerShapes.js';
import { TOWER_VISUALS } from '../src/data/towerVisuals.js';
import { TOWER_ORDER } from '../src/data/towers.js';

const SLACK = 4; // plates, rings and flasks may sit slightly outside the body radius

test('every (type, level) exists and is frozen', () => {
  for (const id of TOWER_ORDER) {
    assert.equal(TOWER_SHAPES[id].length, 3);
    for (const s of TOWER_SHAPES[id]) {
      assert.ok(Object.isFrozen(s));
      assert.ok(Array.isArray(s.base) && Array.isArray(s.turret) && Array.isArray(s.barrel));
      assert.ok(Number.isFinite(s.muzzle.x) && Number.isFinite(s.muzzle.y));
    }
  }
});

test('every coordinate is finite and inside the body + barrel envelope', () => {
  for (const id of TOWER_ORDER) {
    const v = TOWER_VISUALS[id];
    const limit = Math.max(v.bodyRadius, v.barrelLength) + SLACK;
    TOWER_SHAPES[id].forEach((s, level) => {
      for (const [x, y] of shapePoints(s)) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), `${id} L${level} finite`);
        assert.ok(Math.hypot(x, y) <= limit, `${id} L${level}: ${Math.hypot(x, y).toFixed(1)} > ${limit}`);
      }
    });
  }
});

test('the barrel reaches the configured length and the muzzle sits at its tip', () => {
  for (const id of TOWER_ORDER) {
    const v = TOWER_VISUALS[id];
    TOWER_SHAPES[id].forEach((s) => {
      assert.ok(Math.abs(s.muzzle.x - v.barrelLength) < 1e-9, `${id} muzzle.x ${s.muzzle.x} vs ${v.barrelLength}`);
    });
  }
});

test('higher levels never remove parts', () => {
  for (const id of TOWER_ORDER) {
    const count = (s) => s.base.length + s.turret.length + s.barrel.length;
    const c = TOWER_SHAPES[id].map(count);
    assert.ok(c[1] >= c[0] && c[2] >= c[1], `${id}: ${c}`);
  }
  assert.deepEqual([tierMark(0).length, tierMark(1).length, tierMark(2).length], [0, 1, 2]);
});

// Silhouette descriptor: aspect ratio, the 8-sector radial profile (max distance per 45 degree sector, relative to the
// largest), barrel length, mean radius (hollow vs filled) and part count. Two towers are "alike" if their descriptors are close. The threshold 0.08 sits well below the smallest
// distance between any two different towers at any level (checked below, printed on failure) and well above 0
// (a tower compared with itself is 0, and different levels of one tower are allowed to be close).
const SECTORS = 8;
function descriptor(shape) {
  const points = shapePoints(shape);
  const prof = new Array(SECTORS).fill(0);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxR = 0;
  for (const [x, y] of points) {
    const a = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
    const sec = Math.min(SECTORS - 1, Math.floor((a / (Math.PI * 2)) * SECTORS));
    const r = Math.hypot(x, y);
    prof[sec] = Math.max(prof[sec], r);
    maxR = Math.max(maxR, r);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const aspect = (maxX - minX) / Math.max(1e-9, maxY - minY) / 2; // /2 keeps it on a scale comparable to the profile
  const meanR = points.reduce((sum, [x, y]) => sum + Math.hypot(x, y), 0) / points.length;
  const parts = shape.base.length + shape.turret.length + shape.barrel.length;
  // aspect, 8-sector profile, barrel length vs size, mean radius vs size (hollow vs filled), part count
  return [aspect, ...prof.map((p) => p / maxR), shape.muzzle.x / maxR, meanR / maxR, parts / 20];
}
const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length);

test('the five silhouettes are pairwise distinct at every level', () => {
  const THRESH = 0.08;
  let closest = { d: Infinity, pair: '' };
  for (let i = 0; i < TOWER_ORDER.length; i++) {
    for (let j = i + 1; j < TOWER_ORDER.length; j++) {
      for (let li = 0; li < 3; li++) {
        for (let lj = 0; lj < 3; lj++) {
          const d = dist(descriptor(TOWER_SHAPES[TOWER_ORDER[i]][li]), descriptor(TOWER_SHAPES[TOWER_ORDER[j]][lj]));
          if (d < closest.d) closest = { d, pair: `${TOWER_ORDER[i]}L${li} vs ${TOWER_ORDER[j]}L${lj}` };
        }
      }
    }
  }
  assert.ok(closest.d >= THRESH, `closest pair ${closest.pair}: ${closest.d.toFixed(3)}`);
});
