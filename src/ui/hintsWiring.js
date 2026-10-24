// Connects the first-run hints to a game: sim events and the settings store feed the pure state machine, a 4 Hz timer advances time and syncs the card.
import { EVENT_TYPES } from '../sim/events.js';
import { createTutorial, OVERLAY_OPENED } from './tutorialState.js';
import { createTutorialView } from './tutorialView.js';
import { hintRectFor } from './hintPlacement.js';
import { HINT_GEOMETRY as G } from './tutorialText.js';

const TICK_SECONDS = 0.25;
const FEED = [EVENT_TYPES.TOWER_PLACED, EVENT_TYPES.WAVE_STARTED, EVENT_TYPES.WAVE_ENDED, EVENT_TYPES.TOWER_UPGRADED, EVENT_TYPES.GAME_OVER];

/**
 * @param {{game: object, settings: {get: Function, set: Function}, root: HTMLElement, debug: boolean, isSuspended: () => boolean}} o isSuspended: a dialog is open
 * @returns {{tutorial: object, overlayOpened: () => void}}
 */
export function wireHints({ game, settings, root, debug, isSuspended }) {
  const tutorial = createTutorial({
    getStep: () => settings.get('tutorialStep'), setStep: (n) => settings.set('tutorialStep', n),
    enabled: () => settings.get('tutorialHints'), setEnabled: (on) => settings.set('tutorialHints', on), debug, mode: game.mode,
  });
  const view = createTutorialView({ root, rect: hintRectFor(game.map, G.width, G.maxHeight, G.margin), tutorial, isSuspended });
  for (const type of FEED) game.events.on(type, (payload) => tutorial.onEvent(type, payload));
  tutorial.onEvent(EVENT_TYPES.GAME_STARTED, { phase: game.waves.phase, towers: game.towers.length, nextWave: game.waves.nextWave });
  setInterval(() => { if (!isSuspended()) tutorial.tick(TICK_SECONDS); view.update(); }, TICK_SECONDS * 1000);
  return { tutorial, overlayOpened: () => tutorial.onEvent(OVERLAY_OPENED, {}) };
}
