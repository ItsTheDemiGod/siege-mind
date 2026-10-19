// Pure: how damaged the base core looks, from the lives left. Segments are the lit arcs of its ring.

/**
 * @param {number} lives @param {number} maxLives
 * @param {{coreSegments: number, coreDamagedBelow: number, coreCriticalBelow: number}} cfgFx
 * @returns {{fraction: number, segments: number, state: 'healthy'|'damaged'|'critical'|'destroyed'}}
 */
export function coreIntegrity(lives, maxLives, cfgFx) {
  if (typeof lives !== 'number' || !Number.isFinite(lives) || lives < 0) throw new RangeError(`lives must be a finite number >= 0, got ${String(lives)}`);
  if (typeof maxLives !== 'number' || !Number.isFinite(maxLives) || maxLives <= 0) throw new RangeError(`maxLives must be a finite number > 0, got ${String(maxLives)}`);
  const fraction = Math.min(1, lives / maxLives);
  const segments = lives <= 0 ? 0 : Math.max(1, Math.ceil((cfgFx.coreSegments * lives) / maxLives));
  let state = 'healthy';
  if (lives <= 0) state = 'destroyed';
  else if (fraction < cfgFx.coreCriticalBelow) state = 'critical';
  else if (fraction < cfgFx.coreDamagedBelow) state = 'damaged';
  return { fraction, segments: Math.min(segments, cfgFx.coreSegments), state };
}
