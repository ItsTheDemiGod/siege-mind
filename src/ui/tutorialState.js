// First-run hints as a pure state machine. The step (how many hints were seen) is persisted through injected getStep/setStep; time only advances through
// tick(dt); nothing here touches the DOM, a clock or the sim. Hints appear strictly in order: build, start, upgrade, director.
import { EVENT_TYPES } from '../sim/events.js';
import { HINTS, HINT_GEOMETRY, DIRECTOR_HINT_MODES } from './tutorialText.js';

/** A custom (non-sim) event the UI sends when the Director overlay opens. */
export const OVERLAY_OPENED = 'overlay_opened';
const AUTO_HIDE = new Set(['upgrade', 'director']); // build and start stay until the player does what they ask for

/**
 * @param {{hints?: readonly {id: string}[], getStep: () => number, setStep: (n: number) => void, enabled: () => boolean, setEnabled?: (on: boolean) => void, debug?: boolean, mode: string,
 *   geometry?: {autoHideSeconds: number, delaySeconds: number}}} o
 * @returns {{onEvent: (type: string, payload?: object) => void, tick: (dtSeconds: number) => void, current: () => string | null, dismiss: () => void, skipAll: () => void, reset: () => void}}
 */
export function createTutorial({ hints = HINTS, getStep, setStep, enabled, setEnabled = () => {}, debug = false, mode, geometry = HINT_GEOMETRY }) {
  const idx = (id) => hints.findIndex((x) => x.id === id);
  let armed = null; // { id, left } waiting for the delay
  let shown = null; // { id, age }
  const active = () => enabled() && !debug;
  const stepOf = (id) => idx(id);

  function arm(id) {
    if (!active() || armed || shown || getStep() !== stepOf(id) || stepOf(id) < 0) return;
    armed = { id, left: geometry.delaySeconds };
  }
  /** The hint with this id is done (seen, acted on or dismissed): drop it and advance the persisted step. */
  function complete(id) {
    if (armed && armed.id === id) armed = null;
    if (shown && shown.id === id) shown = null;
    if (getStep() === stepOf(id)) setStep(stepOf(id) + 1);
  }
  const isNow = (id) => (shown && shown.id === id) || (armed && armed.id === id);

  return {
    onEvent(type, payload = {}) {
      if (!active()) return;
      switch (type) {
        case EVENT_TYPES.GAME_STARTED:
          if (payload.phase === 'prep' && payload.towers === 0 && payload.nextWave === 1) arm('build');
          break;
        case EVENT_TYPES.TOWER_PLACED:
          if (getStep() === stepOf('build')) { complete('build'); arm('start'); }
          else if (getStep() === stepOf('start') && !isNow('start')) arm('start');
          break;
        case EVENT_TYPES.WAVE_STARTED:
          if (getStep() === stepOf('start')) complete('start'); // shown or not, the player has started the wave
          else if (isNow('upgrade')) complete('upgrade');
          if (getStep() === stepOf('director') && DIRECTOR_HINT_MODES.includes(mode) && payload.director && payload.director.reason === 'adapted') arm('director');
          break;
        case EVENT_TYPES.WAVE_ENDED:
          arm('upgrade');
          break;
        case EVENT_TYPES.TOWER_UPGRADED:
          if (isNow('upgrade')) complete('upgrade');
          break;
        case OVERLAY_OPENED:
          if (isNow('director')) complete('director');
          break;
        case EVENT_TYPES.GAME_OVER:
          armed = null; shown = null;
          break;
        default:
      }
    },
    tick(dt) {
      if (!active()) return;
      if (armed) {
        armed.left -= dt;
        if (armed.left <= 0) { shown = { id: armed.id, age: 0 }; armed = null; }
      } else if (shown) {
        shown.age += dt;
        if (AUTO_HIDE.has(shown.id) && shown.age >= geometry.autoHideSeconds) complete(shown.id);
      }
    },
    current: () => (active() && shown ? shown.id : null),
    dismiss() { if (shown) complete(shown.id); },
    skipAll() { armed = null; shown = null; setStep(hints.length); setEnabled(false); },
    reset() { armed = null; shown = null; setStep(0); setEnabled(true); },
  };
}
