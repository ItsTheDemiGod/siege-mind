// Monospace debug readout (top centre, just below the HUD strip), toggled with the backquote key.
import { config } from '../data/config.js';
import { h } from './dom.js';

/**
 * @param {{root: HTMLElement, visible?: boolean}} o
 * @returns {{update: (text: string) => void, toggle: () => void}}
 */
export function createDebugPanel({ root, visible = true }) {
  const pre = h('pre', { class: 'debug-panel', 'aria-hidden': 'true' });
  pre.hidden = !visible;
  pre.style.top = `${config.view.hudHeight + 8}px`; // top centre, just below the HUD strip
  root.append(pre);
  return {
    update(text) { if (!pre.hidden) pre.textContent = text; },
    toggle() { pre.hidden = !pre.hidden; },
  };
}
