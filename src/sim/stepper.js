// Fixed-timestep accumulator. Pure math: the caller supplies frame durations, no clocks here.
import { config } from '../data/config.js';

const EPSILON = 1e-9; // stops float error from losing a step (e.g. 59 x 1/60 + 1/60 < 1)

/**
 * Create a stepper.
 * @param {{stepSeconds?: number, maxFrameSeconds?: number, maxStepsPerFrame?: number}} [options]
 * @returns {{advance: (frameSeconds: number, speed: number, paused: boolean) => number, requestSingleStep: () => void, reset: () => void, readonly alpha: number}}
 */
export function createStepper({
  stepSeconds = config.sim.stepSeconds,
  maxFrameSeconds = config.sim.maxFrameSeconds,
  maxStepsPerFrame = config.sim.maxStepsPerFrame,
} = {}) {
  let accumulator = 0;
  let alpha = 0;
  let singleStep = false;

  return {
    /**
     * Number of whole sim steps to run this frame. Speed scales accumulated time, never the step size.
     * @param {number} frameSeconds - real time since the previous frame
     * @param {number} speed - 1, 2 or 3
     * @param {boolean} paused
     * @returns {number}
     */
    advance(frameSeconds, speed, paused) {
      if (paused) {
        if (!singleStep) return 0;
        singleStep = false;
        accumulator = 0;
        alpha = 1; // show the new state exactly
        return 1;
      }
      singleStep = false;
      const dt = Math.min(Math.max(frameSeconds, 0), maxFrameSeconds);
      accumulator += dt * speed;
      let steps = Math.floor(accumulator / stepSeconds + EPSILON);
      if (steps > maxStepsPerFrame) {
        steps = maxStepsPerFrame;
        accumulator = 0; // drop the backlog instead of spiralling
      } else {
        accumulator = Math.max(0, accumulator - steps * stepSeconds);
      }
      alpha = Math.min(accumulator / stepSeconds, 1 - EPSILON);
      return steps;
    },
    /** Queue one step; only honoured while paused. */
    requestSingleStep() {
      singleStep = true;
    },
    reset() {
      accumulator = 0;
      alpha = 0;
      singleStep = false;
    },
    get alpha() {
      return alpha;
    },
  };
}
