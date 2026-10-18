// One shared tooltip node. Elements opt in with data-tooltip (and optional data-tooltip-title). Works on keyboard focus too.
import { config } from '../data/config.js';
import { h } from './dom.js';

/**
 * @param {{root: HTMLElement}} o - the scaled #ui-root; positions are computed in its logical coordinates
 * @returns {{hide: () => void, destroy: () => void}}
 */
export function createTooltip({ root }) {
  const node = h('div', { class: 'tooltip', role: 'tooltip' });
  root.append(node);
  let timer = 0;
  let current = null;

  const hide = () => {
    clearTimeout(timer);
    current = null;
    node.classList.remove('is-visible');
  };

  const show = (target) => {
    node.replaceChildren();
    const title = target.getAttribute('data-tooltip-title');
    if (title) node.append(h('div', { class: 't-title', text: title }));
    node.append(h('div', { text: target.getAttribute('data-tooltip') }));
    const rr = root.getBoundingClientRect();
    const scale = rr.width / root.offsetWidth || 1;
    const tr = target.getBoundingClientRect();
    const x = (tr.left - rr.left) / scale;
    const y = (tr.bottom - rr.top) / scale + 8;
    node.style.left = `${Math.max(8, Math.min(x, root.offsetWidth - node.offsetWidth - 8))}px`;
    node.style.top = `${y}px`;
    node.classList.add('is-visible');
  };

  const schedule = (target) => {
    if (target === current) return;
    hide();
    current = target;
    timer = setTimeout(() => show(target), config.ui.tooltipDelay * 1000);
  };

  const find = (e) => (e.target instanceof Element ? e.target.closest('[data-tooltip]') : null);
  const onOver = (e) => { const t = find(e); if (t) schedule(t); };
  const onOut = (e) => { if (find(e)) hide(); };
  const onKey = (e) => { if (e.key === 'Escape') hide(); };

  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerout', onOut);
  document.addEventListener('focusin', onOver);
  document.addEventListener('focusout', onOut);
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', hide);

  return {
    hide,
    destroy() {
      hide();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusin', onOver);
      document.removeEventListener('focusout', onOut);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', hide);
      node.remove();
    },
  };
}
