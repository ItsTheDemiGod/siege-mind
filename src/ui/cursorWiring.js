// Connects the keyboard tile cursor to the game: arrow keys move the placement ghost, Enter places or starts the wave, [ and ] cycle the selected tower,
// and a visually hidden live region announces the tile. Browser wiring only; the decisions are in tileCursor.js.
import { createTileCursor, cycleSelection, resolveEnter } from './tileCursor.js';
import { h } from './dom.js';

const ARROWS = Object.freeze({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' });

/**
 * @param {{root: HTMLElement, game: object, buildState: object, build: {placeAt: (col: number, row: number) => void}, waveControl: {start: () => void},
 *   blocked: () => boolean, overlayOpen: () => boolean}} o blocked: a dialog is open or the game ended
 * @returns {{keys: Record<string, (e: KeyboardEvent) => void>, cursor: object}} keys to merge into the extra key table
 */
export function wireCursor({ root, game, buildState, build, waveControl, blocked, overlayOpen }) {
  const cursor = createTileCursor(game.map);
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status', 'data-id': 'cursor-live' });
  root.append(live);
  const announce = () => { live.textContent = cursor.describe(game); };
  const show = () => { const p = cursor.get(); buildState.setHover(p.col, p.row); announce(); };

  // arming a tower shows the ghost at the cursor straight away (a pointer on the map keeps its own hover)
  buildState.subscribe(() => { if (buildState.state.mode === 'placing' && buildState.state.hoverCol === null) show(); });

  const fromPointer = () => { const s = buildState.state; if (s.hoverCol !== null) cursor.set(s.hoverCol, s.hoverRow); }; // the pointer handed control back
  const keys = {};
  for (const [key, dir] of Object.entries(ARROWS)) {
    keys[key] = (e) => {
      if (blocked() || buildState.state.mode !== 'placing') return;
      e.preventDefault(); // no page scrolling while the cursor is in use
      fromPointer();
      cursor.move(dir);
      show();
    };
  }
  keys.Enter = () => {
    const action = resolveEnter({ buildMode: buildState.state.mode, waveStartable: game.waves.phase === 'prep' || game.waves.phase === 'intermission', overlayOpen: overlayOpen(), dialogOpen: blocked() });
    if (action === 'place-at-cursor') { fromPointer(); const p = cursor.get(); build.placeAt(p.col, p.row); announce(); }
    else if (action === 'start-wave') waveControl.start();
  };
  const cycle = (direction) => () => {
    if (blocked()) return;
    const id = cycleSelection(game, direction, buildState.state.mode === 'selected' ? buildState.state.towerId : null);
    if (id !== null) buildState.selectTower(id);
  };
  keys[']'] = cycle(1);
  keys['['] = cycle(-1);
  return { keys, cursor };
}
