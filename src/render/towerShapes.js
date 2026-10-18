// Pure tower shape data (no DOM). Local coordinates: +x is the aim direction, origin at the tower centre.
// Parts: { t: 'poly', pts: [x,y,...], fill } | { t: 'circle', x, y, r, fill } | { t: 'line', x1, y1, x2, y2, w } | { t: 'ring', r, dash }
// Groups: base (does not rotate), turret (rotates with the aim), barrel (turret part that recoils backwards).
// `bright` parts are drawn at full brightness (level-2 upgrades); `liquid`/`bubbles`/`lens` are special markers.

const TAU = Math.PI * 2;
const poly = (pts, fill = true, bright = false) => ({ t: 'poly', pts, fill, bright });
const circle = (x, y, r, fill = true, bright = false) => ({ t: 'circle', x, y, r, fill, bright });
const line = (x1, y1, x2, y2, w = 2, bright = false) => ({ t: 'line', x1, y1, x2, y2, w, bright });
const ring = (r, dash = null, bright = false) => ({ t: 'ring', r, dash, bright });

/** Regular polygon points. */
function reg(n, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(Math.cos(rot + (i / n) * TAU) * r, Math.sin(rot + (i / n) * TAU) * r);
  return pts;
}

/** Rotated rectangle points centred at (cx,cy) with half sizes hw (along angle) and hh. */
function box(cx, cy, hw, hh, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].flatMap(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

const mirrorY = (pts) => pts.map((v, i) => (i % 2 ? -v : v));

function lance(level) {
  const turret = [poly([-10, 0, 0, -6, 14, 0, 0, 6])];
  if (level >= 1) turret.push(poly([-4, -6, -11, -13, 3, -6]), poly(mirrorY([-4, -6, -11, -13, 3, -6])));
  const bright = level >= 2;
  const barrel = [line(4, -2.5, 28, -2.5, 1.6, bright), line(4, 2.5, 28, 2.5, 1.6, bright)];
  if (bright) barrel.push(circle(28, 0, 2.6, true, true));
  return { base: [poly(reg(6, 14))], turret, barrel, muzzle: { x: 28, y: 0 }, lens: bright ? { x: 28, y: 0, r: 2.6 } : null };
}

function mortar(level) {
  const base = [poly(reg(8, 22, Math.PI / 8)), ring(14)];
  if (level >= 1) for (let k = 0; k < 4; k++) base.push(poly(box(Math.cos(Math.PI / 4 + (k * Math.PI) / 2) * 22, Math.sin(Math.PI / 4 + (k * Math.PI) / 2) * 22, 3.4, 4.2, Math.PI / 4 + (k * Math.PI) / 2)));
  if (level >= 2) base.push(ring(18, null, true));
  const turret = [circle(0, 0, 8)];
  const barrel = [poly([0, -6, 16, -7.5, 16, 7.5, 0, 6])];
  if (level >= 2) barrel.push(poly([10, -9, 13.5, -9, 13.5, 9, 10, 9], true, true));
  return { base, turret, barrel, muzzle: { x: 16, y: 0 }, lens: null };
}

function frost(level) {
  const len = level >= 1 ? 19 : 16;
  const turret = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * TAU) / 6;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    turret.push(line(0, 0, ca * len, sa * len, 2));
    turret.push(poly([ca * len, sa * len, Math.cos(a + 0.35) * (len - 3), Math.sin(a + 0.35) * (len - 3), Math.cos(a - 0.35) * (len - 3), Math.sin(a - 0.35) * (len - 3)]));
    if (level >= 1) {
      for (const side of [-1, 1]) {
        const b = a + side * (Math.PI / 4);
        turret.push(line(ca * 9, sa * 9, ca * 9 + Math.cos(b) * 5, sa * 9 + Math.sin(b) * 5, 1.5));
      }
    }
  }
  turret.push(poly(reg(6, 5)));
  const base = level >= 2 ? [ring(22, [4, 4], true)] : [];
  return { base, turret, barrel: [], muzzle: { x: 0, y: 0 }, lens: null };
}

function poison(level) {
  const bright = level >= 2;
  const turret = [circle(0, 0, 13), { t: 'liquid', r: 9, fill: 0.4, bright }, { t: 'bubbles', r: 8 }];
  if (level >= 1) turret.push(circle(-6, 12.5, 5), line(-6, 7.5, -6, 8.5, 2));
  if (level >= 2) turret.push(circle(-6, -12.5, 5), line(-6, -7.5, -6, -8.5, 2));
  const barrel = [poly([8, -3.2, 20, -2, 20, 2, 8, 3.2])];
  return { base: [], turret, barrel, muzzle: { x: 20, y: 0 }, lens: null };
}

function sniper(level) {
  const base = [ring(17)];
  for (let k = 0; k < 4; k++) {
    const a = (k * TAU) / 4;
    base.push(line(Math.cos(a) * 17, Math.sin(a) * 17, Math.cos(a) * 23, Math.sin(a) * 23, 2));
  }
  const turret = [poly([-8, -6, 8, -6, 12, 0, 8, 6, -8, 6]), poly([-2, -10.5, 10, -10.5, 10, -6.5, -2, -6.5])];
  if (level >= 2) turret.push(poly([10, -10.5, 18, -10.5, 18, -7.5, 10, -7.5], true, true), line(-4, 6, -10, 16, 1.8), line(-4, -6, -10, -16, 1.8));
  const barrel = [line(6, 0, 36, 0, 2.2, level >= 2)];
  if (level >= 1) barrel.push(poly([22, -4, 26, -4, 26, 4, 22, 4]));
  return { base, turret, barrel, muzzle: { x: 36, y: 0 }, lens: { x: 14, y: -8.5, r: 1.8 } };
}

const BUILDERS = { lance, mortar, frost, poison, sniper };

const freezeDeep = (o) => {
  if (o && typeof o === 'object') { Object.values(o).forEach(freezeDeep); Object.freeze(o); }
  return o;
};

/** TOWER_SHAPES[type][level] -> { base, turret, barrel, muzzle, lens }. */
export const TOWER_SHAPES = freezeDeep(Object.fromEntries(Object.entries(BUILDERS).map(([id, fn]) => [id, [0, 1, 2].map((l) => fn(l))])));

/** Tier mark under the base: chevron polylines (shape, not color, shows the level). Points are [x,y,...] relative to (0, offsetY). */
export function tierMark(level) {
  const chevrons = [];
  for (let i = 0; i < level; i++) chevrons.push([-4.5, i * 4, 0, i * 4 + 3, 4.5, i * 4]);
  return chevrons;
}

/** Every point of a shape (circles/rings sampled) in local coordinates, for envelope and silhouette checks. */
export function shapePoints(shape) {
  const pts = [];
  const add = (x, y) => pts.push([x, y]);
  for (const group of [shape.base, shape.turret, shape.barrel]) {
    for (const p of group) {
      if (p.t === 'poly') for (let i = 0; i < p.pts.length; i += 2) add(p.pts[i], p.pts[i + 1]);
      else if (p.t === 'line') { add(p.x1, p.y1); add(p.x2, p.y2); }
      else if (p.t === 'circle') for (let k = 0; k < 12; k++) add(p.x + Math.cos((k / 12) * TAU) * p.r, p.y + Math.sin((k / 12) * TAU) * p.r);
      else if (p.t === 'ring') for (let k = 0; k < 12; k++) add(Math.cos((k / 12) * TAU) * p.r, Math.sin((k / 12) * TAU) * p.r);
      else if (p.t === 'liquid' || p.t === 'bubbles') { /* inside the body: no extra extent */ }
    }
  }
  return pts;
}
