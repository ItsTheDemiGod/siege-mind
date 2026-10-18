// Toasts in an aria-live region; auto-dismiss, at most 3 visible.
import { config } from '../data/config.js';
import { h } from './dom.js';

const MAX_VISIBLE = 3;
const DEFAULT_SECONDS = 3;

/**
 * @param {{root: HTMLElement}} o
 * @returns {{show: (message: string, opts?: {kind?: string, seconds?: number}) => void}}
 */
export function createToaster({ root }) {
  const region = h('div', { class: 'toasts', 'aria-live': 'polite', role: 'status' });
  root.append(region);

  const dismiss = (toast) => {
    if (!toast.isConnected) return;
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), config.ui.durNormal * 1000);
  };

  return {
    /** @param {string} message @param {{kind?: 'director'|undefined, seconds?: number}} [opts] */
    show(message, { kind, seconds = DEFAULT_SECONDS } = {}) {
      const toast = h('div', { class: kind ? `toast toast--${kind}` : 'toast', text: message });
      region.append(toast);
      while (region.querySelectorAll('.toast:not(.is-leaving)').length > MAX_VISIBLE) {
        dismiss(region.querySelector('.toast:not(.is-leaving)'));
      }
      setTimeout(() => dismiss(toast), seconds * 1000);
    },
  };
}
