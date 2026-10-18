// Browser-only: Path2D objects built lazily ONCE per (type, level) from the pure shape data, then reused every frame.
import { TOWER_SHAPES, tierMark } from './towerShapes.js';

const TAU = Math.PI * 2;
const THIN_MAX = 2; // line widths below this use the thin stroke

function groupPaths(parts) {
  const g = { fill: new Path2D(), stroke: new Path2D(), thin: new Path2D(), thick: new Path2D(), dashed: new Path2D(), bright: new Path2D(), brightFill: new Path2D() };
  for (const p of parts) {
    const target = p.bright ? g.bright : g.stroke;
    if (p.t === 'poly') {
      const path = new Path2D();
      path.moveTo(p.pts[0], p.pts[1]);
      for (let i = 2; i < p.pts.length; i += 2) path.lineTo(p.pts[i], p.pts[i + 1]);
      path.closePath();
      if (p.fill) (p.bright ? g.brightFill : g.fill).addPath(path);
      target.addPath(path);
    } else if (p.t === 'circle') {
      const path = new Path2D();
      path.arc(p.x, p.y, p.r, 0, TAU);
      if (p.fill) (p.bright ? g.brightFill : g.fill).addPath(path);
      target.addPath(path);
    } else if (p.t === 'ring') {
      const path = new Path2D();
      path.arc(0, 0, p.r, 0, TAU);
      (p.dash ? g.dashed : target).addPath(path);
    } else if (p.t === 'line') {
      const path = new Path2D();
      path.moveTo(p.x1, p.y1);
      path.lineTo(p.x2, p.y2);
      (p.bright ? g.bright : p.w < THIN_MAX ? g.thin : g.thick).addPath(path);
    }
  }
  return g;
}

const cache = {}; // cache[type][level]: plain lookups, no string keys per frame
const tierCache = [];

/** @returns {{base: object, turret: object, barrel: object}} Path2D groups for a tower type and level (built once). */
export function towerPaths(type, level) {
  const byLevel = cache[type] ?? (cache[type] = []);
  let entry = byLevel[level];
  if (!entry) {
    const shape = TOWER_SHAPES[type][level];
    entry = { base: groupPaths(shape.base), turret: groupPaths(shape.turret), barrel: groupPaths(shape.barrel) };
    byLevel[level] = entry;
  }
  return entry;
}

/** @returns {Path2D} the chevron tier mark for a level (built once). */
export function tierPath(level) {
  if (!tierCache[level]) {
    const path = new Path2D();
    for (const c of tierMark(level)) {
      path.moveTo(c[0], c[1]);
      path.lineTo(c[2], c[3]);
      path.lineTo(c[4], c[5]);
    }
    tierCache[level] = path;
  }
  return tierCache[level];
}
