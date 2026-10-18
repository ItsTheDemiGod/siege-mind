import { test } from 'node:test';
import assert from 'node:assert/strict';
import { towerAnim, smoothAngle, spinAngle } from '../src/render/towerAnim.js';
import { TOWER_VISUALS } from '../src/data/towerVisuals.js';
import { getTowerStats } from '../src/sim/towers.js';

const DT = 1 / 60;
const out = () => ({ buildT: 0, recoil: 0, flash: 0, charge: 0 });
const lance = TOWER_VISUALS.lance;
const sniper = TOWER_VISUALS.sniper;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

// A tower that fired at tick 100 (cooldown was just set to the interval) and is observed `k` ticks later.
const fired = (type, k, extra = {}) => {
  const stats = getTowerStats(type, 0);
  return { stats, tower: { builtTick: 0, shots: 1, cooldown: Math.max(0, stats.intervalTicks - k), targetId: 5, ...extra } };
};

test('never fired: no recoil or flash', () => {
  const o = towerAnim({ builtTick: 0, shots: 0, cooldown: 0, targetId: -1 }, getTowerStats('lance', 0), 500, DT, lance, out());
  assert.deepEqual([o.recoil, o.flash], [0, 0]);
});

test('just fired: full recoil and flash; mid-decay; fully decayed', () => {
  const { tower, stats } = fired('lance', 0);
  const a = towerAnim(tower, stats, 100, DT, lance, out());
  near(a.recoil, 1); near(a.flash, 1);
  const b = fired('lance', 3);
  const m = towerAnim(b.tower, b.stats, 103, DT, lance, out());
  assert.ok(m.recoil > 0 && m.recoil < 1 && m.flash > 0 && m.flash < 1);
  const c = fired('lance', 20); // 20 ticks = 0.33 s > recoil 0.18 and flash 0.07
  const d = towerAnim(c.tower, c.stats, 120, DT, lance, out());
  assert.deepEqual([d.recoil, d.flash], [0, 0]);
});

test('decay is monotonic and never NaN or negative', () => {
  let prevR = 2;
  let prevF = 2;
  for (let k = 0; k < 53; k++) {
    for (const a of [0, 0.5, 0.99]) {
      const { tower, stats } = fired('lance', k);
      const o = towerAnim(tower, stats, 100 + k + a, DT, lance, out());
      for (const v of Object.values(o)) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, `${k}: ${JSON.stringify(o)}`);
    }
    const { tower, stats } = fired('lance', k);
    const o = towerAnim(tower, stats, 100 + k, DT, lance, out());
    assert.ok(o.recoil <= prevR + 1e-12 && o.flash <= prevF + 1e-12);
    prevR = o.recoil; prevF = o.flash;
  }
});

test('buildT ramps from 0 to 1 over buildSeconds', () => {
  const t = { builtTick: 10, shots: 0, cooldown: 0, targetId: -1 };
  const s = getTowerStats('lance', 0);
  near(towerAnim(t, s, 10, DT, lance, out()).buildT, 0);
  assert.ok(towerAnim(t, s, 15, DT, lance, out()).buildT > 0);
  near(towerAnim(t, s, 10 + lance.buildSeconds / DT, DT, lance, out()).buildT, 1);
  near(towerAnim(t, s, 1000, DT, lance, out()).buildT, 1);
});

test('charge: only with a target and only inside the final window', () => {
  const s = getTowerStats('sniper', 0); // interval 210
  const mk = (cooldown, targetId) => ({ builtTick: 0, shots: 1, cooldown, targetId });
  assert.equal(towerAnim(mk(150, 5), s, 100, DT, sniper, out()).charge, 0); // 2.5 s out
  assert.equal(towerAnim(mk(36, 5), s, 100, DT, sniper, out()).charge, 0); // exactly at the window start (0.6 s)
  const mid = towerAnim(mk(18, 5), s, 100, DT, sniper, out()).charge;
  assert.ok(mid > 0.4 && mid < 0.6, `mid ${mid}`);
  assert.equal(towerAnim(mk(0, 5), s, 100, DT, sniper, out()).charge, 1); // ready and aiming
  assert.equal(towerAnim(mk(18, -1), s, 100, DT, sniper, out()).charge, 0); // no target
  assert.equal(towerAnim(mk(18, 5), getTowerStats('lance', 0), 100, DT, lance, out()).charge, 0); // chargeSeconds 0
});

test('smoothAngle takes the shortest arc across +/-PI and never overshoots', () => {
  const a = smoothAngle(3.0, -3.0, 1, 0.01); // shortest way is increasing through PI
  assert.ok(a > 3.0 || a < -3.1, `${a}`);
  near(smoothAngle(0, 1, 10, 1), 1); // would overshoot: clamps at the target
  near(smoothAngle(0, 1, 1, 0.25), 0.25);
  near(smoothAngle(0, -1, 1, 0.25), -0.25);
  let ang = 3.0;
  for (let i = 0; i < 200; i++) ang = smoothAngle(ang, -3.0, 2, DT);
  near(ang, -3.0, 1e-9);
});

test('turnRate 0 leaves the angle unchanged; spinAngle', () => {
  assert.equal(smoothAngle(1.2, -2, 0, 1), 1.2);
  assert.equal(smoothAngle(1.2, -2, 5, 0), 1.2);
  assert.equal(spinAngle(2, 0.6), 1.2);
  assert.equal(spinAngle(5, 0), 0);
});
