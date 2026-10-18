// Pure UI state machine for tower placement and selection (no DOM, no sim access).

/**
 * @returns {{
 *   state: {mode: 'idle'|'placing'|'selected', typeId: string|null, towerId: number|null, hoverCol: number|null, hoverRow: number|null},
 *   armTower: (typeId: string) => void, cancel: () => void, selectTower: (id: number) => void, clearSelection: () => void,
 *   setHover: (col: number|null, row: number|null) => void, onSellOrRemove: (id: number) => void,
 *   route: (click: {towerAtTile: number|null, debugToolsEnabled: boolean}) => string, subscribe: (fn: () => void) => () => void
 * }}
 */
export function createBuildState() {
  const state = { mode: 'idle', typeId: null, towerId: null, hoverCol: null, hoverRow: null };
  const listeners = [];
  const changed = () => { for (const l of listeners) l(); };

  return {
    state,
    /** Arm a tower type for placement; arming the same type again toggles placement off. Clears any selection. */
    armTower(typeId) {
      if (state.mode === 'placing' && state.typeId === typeId) {
        state.mode = 'idle';
        state.typeId = null;
      } else {
        state.mode = 'placing';
        state.typeId = typeId;
      }
      state.towerId = null;
      changed();
    },
    /** Leave placing or selected mode. */
    cancel() {
      if (state.mode === 'idle') return;
      state.mode = 'idle';
      state.typeId = null;
      state.towerId = null;
      changed();
    },
    selectTower(id) {
      state.mode = 'selected';
      state.towerId = id;
      state.typeId = null;
      changed();
    },
    /** Clear a selection (does nothing while placing). */
    clearSelection() {
      if (state.mode !== 'selected') return;
      state.mode = 'idle';
      state.towerId = null;
      changed();
    },
    setHover(col, row) {
      if (state.hoverCol === col && state.hoverRow === row) return;
      state.hoverCol = col;
      state.hoverRow = row;
      changed();
    },
    /** A tower was sold or removed: drop the selection if it was that tower. */
    onSellOrRemove(id) {
      if (state.mode === 'selected' && state.towerId === id) {
        state.mode = 'idle';
        state.towerId = null;
        changed();
      }
    },
    /** What should a left click on the map do? */
    route({ towerAtTile, debugToolsEnabled }) {
      if (state.mode === 'placing') return 'place';
      if (towerAtTile !== null && towerAtTile !== undefined) return 'select';
      return debugToolsEnabled ? 'deselect-then-debug' : 'deselect';
    },
    subscribe(fn) {
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
  };
}
