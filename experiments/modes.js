// The game modes the experiment tooling knows. PROTOCOL.modes are the pre-registered modes; the extra arms (Phase 9A-2a) are research arms that are
// allowed only for the tuning set until amendment A3 registers them for the held-out run.
import { PROTOCOL } from './protocol.js';

export const PROTOCOL_MODES = Object.freeze([...PROTOCOL.modes]);
export const EXTRA_MODES = Object.freeze(['adaptive2', 'counter', 'prior']);
export const ALL_MODES = Object.freeze([...PROTOCOL_MODES, ...EXTRA_MODES]);

/** @param {string} set 'calibration'|'tuning'|'heldout' @returns {readonly string[]} the modes the runner accepts for that set */
export const modesAllowedFor = allowedModesFor;

/**
 * The modes the runner accepts per set. The held-out run uses EXACTLY the six confirmatory modes (no subsets). Calibration keeps the protocol modes.
 * @param {'calibration'|'tuning'|'heldout'} set @returns {readonly string[]} @throws {RangeError} for an unknown set
 */
export function allowedModesFor(set) {
  if (set === 'tuning') return ALL_MODES;
  if (set === 'calibration') return PROTOCOL_MODES;
  if (set === 'heldout') return PROTOCOL.confirmatory.modes;
  throw new RangeError(`unknown seed set: ${String(set)}`);
}
