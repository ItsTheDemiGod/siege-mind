// Monospace debug readout (bottom-left of the stage), toggled with the backquote key.
import { h } from './dom.js';

/**
 * @param {{root: HTMLElement, visible?: boolean}} o
 * @returns {{update: (text: string) => void, toggle: () => void}}
 */
export function createDebugPanel({ root, visible = true }) {
  const pre = h('pre', { class: 'debug-panel', 'aria-hidden': 'true' });
  pre.hidden = !visible;
  root.append(pre);
  return {
    update(text) { if (!pre.hidden) pre.textContent = text; },
    toggle() { pre.hidden = !pre.hidden; },
  };
}
