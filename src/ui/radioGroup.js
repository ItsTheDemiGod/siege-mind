// Accessible radio group built from buttons: role radiogroup/radio, aria-checked, roving tabindex, arrow-key navigation.
import { h } from './dom.js';

/**
 * @param {{label: string, options: {id: string, label: string, blurb?: string, available?: boolean}[], selected: string, onChange: (id: string) => void}} o
 * @returns {{el: HTMLElement, set: (id: string) => void, get: () => string}}
 */
export function createRadioGroup({ label, options, selected, onChange }) {
  let current = selected;
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', class: 'radio', role: 'radio', 'data-id': o.id }, [
      h('span', { class: 'radio-label', text: o.label }),
      o.blurb ? h('span', { class: 'radio-blurb', text: o.blurb }) : '',
    ]);
    if (o.available === false) b.setAttribute('aria-disabled', 'true');
    return b;
  });
  const el = h('div', { class: 'radio-group', role: 'radiogroup', 'aria-label': label }, buttons);

  const paint = () => buttons.forEach((b) => {
    const on = b.dataset.id === current;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  const choose = (id, focus) => {
    const i = options.findIndex((o) => o.id === id);
    if (i < 0 || options[i].available === false) return;
    current = id;
    paint();
    if (focus) buttons[i].focus();
    onChange(id);
  };
  buttons.forEach((b, i) => {
    b.addEventListener('click', () => choose(options[i].id, false));
    b.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      for (let k = 1; k <= options.length; k++) { // skip unavailable options
        const j = (i + step * k + options.length * k) % options.length;
        if (options[j].available !== false) { choose(options[j].id, true); return; }
      }
    });
  });
  paint();
  return { el, set(id) { current = id; paint(); }, get: () => current };
}
