// The game modes the experiment tooling knows. PROTOCOL.modes are the pre-registered modes; the extra arms (Phase 9A-2a) are research arms that are
// allowed only for the tuning set until amendment A3 registers them for the held-out run.
import { PROTOCOL } from './protocol.js';

export const PROTOCOL_MODES = Object.freeze([...PROTOCOL.modes]);
export const EXTRA_MODES = Object.freeze(['adaptive2', 'counter']);
export const ALL_MODES = Object.freeze([...PROTOCOL_MODES, ...EXTRA_MODES]);

/** @param {string} set 'calibration'|'tuning'|'heldout' @returns {readonly string[]} the modes the runner accepts for that set */
export const modesAllowedFor = (set) => (set === 'tuning' ? ALL_MODES : PROTOCOL_MODES);
