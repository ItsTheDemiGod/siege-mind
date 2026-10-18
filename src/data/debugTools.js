// Debug tools and keys (Phase 2). Click-to-apply tools; Phase 3 towers reuse the same sim entry points.

export const DEBUG_TOOLS = Object.freeze([
  Object.freeze({ id: 'direct40', key: 'z', label: 'Direct 40', kind: 'damage', packet: Object.freeze({ amount: 40, kind: 'direct' }) }),
  Object.freeze({ id: 'pierce40', key: 'x', label: 'Piercing 40', kind: 'damage', packet: Object.freeze({ amount: 40, kind: 'direct', armorPierce: true }) }),
  Object.freeze({ id: 'sniper60', key: 'c', label: 'Sniper 60', kind: 'damage', packet: Object.freeze({ amount: 60, kind: 'direct', armorPierce: true, shieldMult: 3 }) }),
  Object.freeze({ id: 'poison', key: 'v', label: 'Poison', kind: 'status', status: Object.freeze({ type: 'poison', dps: 6, duration: 4 }) }),
  Object.freeze({ id: 'frost', key: 'b', label: 'Frost', kind: 'status', status: Object.freeze({ type: 'slow', factor: 0.5, duration: 3 }) }),
  Object.freeze({ id: 'splash25', key: 'm', label: 'Splash 25', kind: 'area', packet: Object.freeze({ amount: 25, kind: 'direct' }), radius: 90 }),
]);

export const DEBUG_SPAWN_KEYS = Object.freeze({
  q: 'armoredGrunt', w: 'swarmling', e: 'fastRunner', r: 'regenerator', t: 'shieldedBruiser',
});
export const DEBUG_SPAWN_ALL_KEY = 'y';
export const DEBUG_NUKE_KEY = 'k';
export const DEFAULT_DEBUG_TOOL = 'direct40';
