// Browser wiring for building: pointer handling and hotkeys. Issues commands through sim functions only.
import { TOWER_ORDER, TOWERS } from '../data/towers.js';
import { placeTower, upgradeTower, sellTower, setTargetMode, towerAt } from '../sim/towers.js';
import { reasonText } from './towerInfo.js';

/**
 * @param {{game: object, canvas: HTMLCanvasElement, renderer: object, buildState: object, toaster: {show: Function},
 *   debugTools: object|null, isModalOpen: () => boolean}} o
 * @returns {{extraKeys: Record<string, Function>, actions: object}}
 */
export function createBuildController({ game, canvas, renderer, buildState, toaster, debugTools, isModalOpen }) {
  const world = { x: 0, y: 0 };
  const { map } = game;
  const tileOf = (e) => {
    renderer.clientToWorld(e, world);
    return map.worldToTile(world.x, world.y);
  };

  // Commands the UI may issue (the panel and hotkeys share these).
  const actions = {
    upgrade(id) {
      const r = upgradeTower(game, id);
      if (!r.ok) toaster.show(reasonText(r.reason));
      return r.ok;
    },
    sell(id) {
      const r = sellTower(game, id);
      if (r.ok) buildState.onSellOrRemove(id);
      return r.ok;
    },
    setMode(id, mode) { return setTargetMode(game, id, mode); },
  };

  canvas.addEventListener('pointermove', (e) => {
    const tile = tileOf(e);
    buildState.setHover(tile ? tile.col : null, tile ? tile.row : null);
  });
  canvas.addEventListener('pointerleave', () => buildState.setHover(null, null));
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); buildState.cancel(); });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const tile = tileOf(e);
    const found = tile ? towerAt(game, tile.col, tile.row) : null;
    const action = buildState.route({ towerAtTile: found ? found.id : null, debugToolsEnabled: debugTools !== null });
    if (action === 'place') {
      if (!tile) return;
      const r = placeTower(game, buildState.state.typeId, tile.col, tile.row);
      if (!r.ok) toaster.show(reasonText(r.reason));
    } else if (action === 'select') {
      buildState.selectTower(found.id);
    } else {
      buildState.clearSelection();
      if (action === 'deselect-then-debug') {
        const handled = debugTools.handleMapClick(world.x, world.y);
        if (!handled) renderer.handleClick(e.clientX, e.clientY); // plain test effect (debug only)
      }
    }
  });

  const guard = (fn) => (e) => { if (!isModalOpen()) fn(e); };
  const extraKeys = {};
  for (const id of TOWER_ORDER) extraKeys[TOWERS[id].hotkey] = guard(() => buildState.armTower(id));
  extraKeys.u = guard(() => { if (buildState.state.mode === 'selected') actions.upgrade(buildState.state.towerId); });
  const sellKey = guard((e) => {
    if (buildState.state.mode === 'selected') { e.preventDefault(); actions.sell(buildState.state.towerId); }
  });
  extraKeys.Delete = sellKey;
  extraKeys.Backspace = sellKey;
  extraKeys.Escape = guard(() => buildState.cancel());
  return { extraKeys, actions };
}
