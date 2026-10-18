// Tiny DOM helper shared by the UI modules.
import { iconSvg } from './icons.js';

/**
 * Create an element. attrs: `class`, `text`, `html` (trusted icon markup only), `on<event>` handlers, `data-*`/aria-* as attributes.
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {(Node|string)[]} [children]
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

/**
 * Icon button: real <button> with an aria-label, optional tooltip text.
 * @param {{icon: string, label: string, tooltip?: string, onClick: (e: Event) => void, className?: string}} o
 * @returns {HTMLButtonElement}
 */
export function iconButton({ icon, label, tooltip, onClick, className = 'btn btn--icon' }) {
  const b = h('button', { type: 'button', class: className, 'aria-label': label, 'data-tooltip': tooltip ?? label, html: iconSvg(icon, 20) });
  b.addEventListener('click', (e) => {
    onClick(e);
    b.blur(); // so Space never re-triggers a focused button
  });
  return b;
}
