// Tiny event bus: the sim emits, telemetry/audio/particles/UI subscribe.

export const EVENT_TYPES = Object.freeze({
  GAME_STARTED: 'game_started',
  WAVE_STARTED: 'wave_started',
  WAVE_ENDED: 'wave_ended',
  ENEMY_SPAWNED: 'enemy_spawned',
  ENEMY_KILLED: 'enemy_killed',
  ENEMY_LEAKED: 'enemy_leaked',
  TOWER_PLACED: 'tower_placed',
  TOWER_FIRED: 'tower_fired',
  GAME_OVER: 'game_over',
});

const KNOWN = new Set(Object.values(EVENT_TYPES));

/**
 * Create an event bus.
 * @param {{strict?: boolean, onError?: (error: unknown, type: string) => void}} [options]
 * @returns {object} bus with on/once/off/emit/listenerCount/clear
 */
export function createEventBus({ strict = true, onError } = {}) {
  /** @type {Map<string, Function[]>} lists are replaced, never mutated (copy-on-write) */
  const listeners = new Map();

  const check = (type) => {
    if (strict && !KNOWN.has(type)) throw new Error(`Unknown event type: ${type}`);
  };

  const off = (type, handler) => {
    const list = listeners.get(type);
    if (!list) return;
    const i = list.indexOf(handler);
    if (i >= 0) listeners.set(type, list.filter((_, j) => j !== i));
  };

  const on = (type, handler) => {
    check(type);
    listeners.set(type, [...(listeners.get(type) ?? []), handler]);
    return () => off(type, handler);
  };

  return {
    on,
    off,
    once(type, handler) {
      const unsubscribe = on(type, (payload) => {
        unsubscribe();
        handler(payload);
      });
      return unsubscribe;
    },
    emit(type, payload) {
      check(type);
      const list = listeners.get(type);
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        try {
          list[i](payload);
        } catch (error) {
          if (onError) onError(error, type);
          else console.error(`Event handler for "${type}" threw:`, error);
        }
      }
    },
    listenerCount: (type) => listeners.get(type)?.length ?? 0,
    clear() {
      listeners.clear();
    },
  };
}
