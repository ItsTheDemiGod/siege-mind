// Debug keys and click-to-apply tools (Phase 2). Issues commands through exported sim functions only; never edits enemy fields.
import { ENEMY_ORDER } from '../data/enemies.js';
import {
  DEBUG_TOOLS, DEBUG_SPAWN_KEYS, DEBUG_SPAWN_ALL_KEY, DEBUG_NUKE_KEY, DEFAULT_DEBUG_TOOL,
} from '../data/debugTools.js';
import { queueEnemy, findEnemyAt, forEachEnemyInRadius, nukeAll } from '../sim/enemies.js';
import { applyDamage } from '../sim/damage.js';
import { applyStatus } from '../sim/statuses.js';

const PAD = 8; // click tolerance beyond an enemy's radius
const SPLASH_RING_SECONDS = 0.4;

/**
 * @param {{game: object, fx: object, toaster: {show: Function}}} o
 * @returns {{extraKeys: Record<string, Function>, handleMapClick: (x: number, y: number) => boolean, readonly toolLabel: string}}
 */
export function createDebugTools({ game, fx, toaster }) {
  let tool = DEBUG_TOOLS.find((t) => t.id === DEFAULT_DEBUG_TOOL);
  const extraKeys = {};

  for (const [key, type] of Object.entries(DEBUG_SPAWN_KEYS)) extraKeys[key] = () => queueEnemy(game, type);
  extraKeys[DEBUG_SPAWN_ALL_KEY] = () => { for (const type of ENEMY_ORDER) queueEnemy(game, type); };
  extraKeys[DEBUG_NUKE_KEY] = () => nukeAll(game);
  for (const t of DEBUG_TOOLS) {
    extraKeys[t.key] = () => { tool = t; toaster.show(`Debug tool: ${t.label}`); };
  }

  const hit = (enemy) => {
    if (tool.kind === 'status') applyStatus(game, enemy, { ...tool.status, source: 'debug' });
    else applyDamage(game, enemy, { ...tool.packet, source: 'debug' });
  };

  return {
    extraKeys,
    /** @returns {boolean} true if the click hit something (otherwise the caller shows the plain test effect) */
    handleMapClick(x, y) {
      if (tool.kind === 'area') {
        fx.ring(x, y, { size0: 6, size1: tool.radius, life: SPLASH_RING_SECONDS });
        forEachEnemyInRadius(game, x, y, tool.radius, hit);
        return true; // the ring is the feedback even on an empty patch
      }
      const e = findEnemyAt(game, x, y, PAD);
      if (!e) return false;
      hit(e);
      return true;
    },
    get toolLabel() { return tool.label; },
  };
}
