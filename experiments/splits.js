// The train/validation split of the tuning seed set (Phase 9A-2): TRAIN is used to build baselines and to look at results,
// VALIDATION is run once through its own lock. Both are derived from seedsOf('tuning') so they can never drift from the protocol.
import { seedsOf } from './protocol.js';

const TUNING = seedsOf('tuning');
export const TRAIN_SEEDS = Object.freeze(TUNING.slice(0, 20));
export const VALIDATION_SEEDS = Object.freeze(TUNING.slice(20));

/** @param {'train'|'validation'|'all'} name @returns {number[]} a copy of the seeds @throws {RangeError} for an unknown name */
export function splitSeeds(name) {
  if (name === 'train') return [...TRAIN_SEEDS];
  if (name === 'validation') return [...VALIDATION_SEEDS];
  if (name === 'all') return [...TUNING];
  throw new RangeError(`unknown split: ${String(name)} (have: train, validation, all)`);
}
