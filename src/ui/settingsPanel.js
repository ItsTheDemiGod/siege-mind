// Settings modal: bound to the settings store; opening pauses the game, closing restores the previous paused state.
import { h } from './dom.js';

const FOCUSABLE = 'button, select, input, [tabindex]:not([tabindex="-1"])';

/** Switch row: <button role="switch" aria-checked>. */
function switchRow(label, hint, onToggle) {
  const sw = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label });
  sw.addEventListener('click', () => onToggle(sw.getAttribute('aria-checked') !== 'true'));
  const text = h('div', {}, [h('div', { text: label }), h('div', { class: 'hint', text: hint })]);
  return { sw, row: h('div', { class: 'row' }, [text, sw]) };
}

/**
 * @param {{root: HTMLElement, settings: object, game: {isPaused: () => boolean, setPaused: (p: boolean) => void}}} o
 * @returns {{open: () => void, close: () => void, readonly isOpen: boolean}}
 */
export function createSettingsPanel({ root, settings, game }) {
  let backdrop = null;
  let wasPaused = false;
  let opener = null;
  const refs = {};

  const sync = () => {
    if (!backdrop) return;
    refs.quality.value = settings.get('quality');
    for (const k of ['autoQuality', 'screenShake', 'reducedMotion', 'damageNumbers']) refs[k].setAttribute('aria-checked', String(settings.get(k)));
    refs.particleDensity.value = settings.get('particleDensity');
  };
  settings.subscribe(sync);

  const build = () => {
    refs.quality = h('select', { class: 'select', 'aria-label': 'Quality' },
      ['low', 'medium', 'high'].map((t) => h('option', { value: t, text: t[0].toUpperCase() + t.slice(1) })));
    refs.quality.addEventListener('change', () => settings.set('quality', refs.quality.value));

    const make = (key, label, hint) => {
      const { sw, row } = switchRow(label, hint, (v) => settings.set(key, v));
      refs[key] = sw;
      return row;
    };
    refs.particleDensity = h('input', { type: 'range', class: 'slider', min: '0.25', max: '1', step: '0.05', 'aria-label': 'Particle density' });
    refs.particleDensity.addEventListener('input', () => settings.set('particleDensity', Number(refs.particleDensity.value)));

    const panel = h('div', { class: 'panel modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title' }, [
      h('h2', { id: 'settings-title', text: 'Settings' }),
      h('div', { class: 'row' }, [h('div', { text: 'Quality' }), refs.quality]),
      make('autoQuality', 'Auto-lower quality', 'Drops one tier if FPS stays low'),
      make('screenShake', 'Screen shake', 'Camera kick on impacts'),
      make('reducedMotion', 'Reduced motion', 'Minimizes animation and effects'),
      make('damageNumbers', 'Floating damage numbers', 'Gold +N on kills is always shown'),
      h('div', { class: 'row' }, [h('div', { text: 'Particle density' }), refs.particleDensity]),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'btn btn--ghost', text: 'Reset', 'aria-label': 'Reset settings to defaults', onclick: () => settings.reset() }),
        h('button', { type: 'button', class: 'btn btn--primary', text: 'Close', 'aria-label': 'Close settings', onclick: () => close() }),
      ]),
    ]);
    const node = h('div', { class: 'modal-backdrop' }, [panel]);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    node.addEventListener('pointerdown', (e) => { if (e.target === node) close(); });
    return node;
  };

  function open() {
    if (backdrop) return;
    opener = document.activeElement;
    wasPaused = game.isPaused();
    game.setPaused(true);
    backdrop = build();
    root.append(backdrop);
    sync();
    refs.quality.focus();
  }

  function close() {
    if (!backdrop) return;
    backdrop.remove();
    backdrop = null;
    game.setPaused(wasPaused);
    if (opener && opener.isConnected) opener.focus();
  }

  return { open, close, get isOpen() { return backdrop !== null; } };
}
