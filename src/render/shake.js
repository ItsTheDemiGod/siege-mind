// Screen shake: trauma-based, smooth noise from fixed sine phases drawn once from the fx rng.

const MAX_OFFSET = 8; // logical px at full trauma
const DECAY = 1.6; // trauma lost per second
const FREQ = 24;

/**
 * @param {{rng: {range: (a: number, b: number) => number}}} options - the fx rng (never the sim rng)
 * @returns {{add: Function, update: Function, setEnabled: Function, reset: Function, readonly offsetX: number, readonly offsetY: number, readonly trauma: number}}
 */
export function createShake({ rng }) {
  const phase = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
  let trauma = 0;
  let t = 0;
  let enabled = true;
  let ox = 0;
  let oy = 0;

  const recompute = () => {
    const k = trauma * trauma * MAX_OFFSET;
    ox = k * (Math.sin(t * FREQ + phase[0]) * 0.6 + Math.sin(t * FREQ * 1.7 + phase[1]) * 0.4);
    oy = k * (Math.sin(t * FREQ * 1.3 + phase[2]) * 0.6 + Math.sin(t * FREQ * 2.1 + phase[3]) * 0.4);
  };

  return {
    add(intensity) {
      if (enabled) trauma = Math.min(1, trauma + intensity);
    },
    update(dt) {
      if (!enabled || trauma <= 0) { ox = 0; oy = 0; trauma = enabled ? 0 : trauma; return; }
      t += dt;
      trauma = Math.max(0, trauma - DECAY * dt);
      recompute();
    },
    /** Disabled (setting off or reduced motion) means offsets stay 0. */
    setEnabled(on) {
      enabled = on;
      if (!on) { trauma = 0; ox = 0; oy = 0; }
    },
    reset() { trauma = 0; ox = 0; oy = 0; },
    get enabled() { return enabled; },
    get offsetX() { return ox; },
    get offsetY() { return oy; },
    get trauma() { return trauma; },
  };
}
