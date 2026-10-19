// Audio may only start after a user gesture: listen once for the first gesture event, call onUnlock and remove every listener.
import { audioConfig } from './audioConfig.js';

/**
 * @param {{target: {addEventListener: Function, removeEventListener: Function}, events?: string[], onUnlock: () => void}} o
 * @returns {() => void} unbind (idempotent)
 */
export function bindUnlock({ target, events = audioConfig.unlockEvents, onUnlock }) {
  let bound = true;
  const unbind = () => {
    if (!bound) return;
    bound = false;
    for (const e of events) target.removeEventListener(e, handler, true);
  };
  function handler() {
    unbind();
    onUnlock();
  }
  for (const e of events) target.addEventListener(e, handler, true);
  return unbind;
}
