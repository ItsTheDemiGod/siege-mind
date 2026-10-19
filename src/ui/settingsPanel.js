// Settings modal: bound to the settings store; while open it holds the 'settings' pause lock.
import { h } from './dom.js';
import { trapTab } from './focusTrap.js';
import { percentText } from './volumeText.js';

/** Switch row: <button role="switch" aria-checked>. */
function switchRow(label, hint, onToggle) {
  const sw = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label });
  sw.addEventListener('click', () => onToggle(sw.getAttribute('aria-checked') !== 'true'));
  const text = h('div', {}, [h('div', { text: label }), h('div', { class: 'hint', text: hint })]);
  return { sw, row: h('div', { class: 'row' }, [text, sw]) };
}

/** Range input bound to one number setting, with a spoken value (aria-valuetext). */
function volumeSlider(label, onInput) {
  const input = h('input', { type: 'range', class: 'slider', min: '0', max: '1', step: '0.05', 'aria-label': label });
  const speak = () => input.setAttribute('aria-valuetext', percentText(Number(input.value)));
  input.addEventListener('input', () => { speak(); onInput(Number(input.value)); });
  input.speak = speak;
  return input;
}

/**
 * @param {{root: HTMLElement, settings: object, pause: {lock: (r: string) => void, unlock: (r: string) => void},
 *   audioAvailable?: () => boolean, onResetHints?: () => void}} o
 * @returns {{open: () => void, close: () => void, readonly isOpen: boolean}}
 */
export function createSettingsPanel({ root, settings, pause, audioAvailable = () => true, onResetHints }) {
  let backdrop = null;
  let opener = null;
  const refs = {};

  const sync = () => {
    if (!backdrop) return;
    refs.quality.value = settings.get('quality');
    for (const k of ['autoQuality', 'screenShake', 'reducedMotion', 'damageNumbers']) refs[k].setAttribute('aria-checked', String(settings.get(k)));
    refs.particleDensity.value = settings.get('particleDensity');
    refs.sound.setAttribute('aria-checked', String(!settings.get('muted')));
    for (const k of ['masterVolume', 'sfxVolume']) { refs[k].value = settings.get(k); refs[k].speak(); }
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

    const sound = switchRow('Sound effects', 'Procedural sounds; press M to mute', (v) => settings.set('muted', !v));
    refs.sound = sound.sw;
    refs.masterVolume = volumeSlider('Master volume', (v) => settings.set('masterVolume', v));
    refs.sfxVolume = volumeSlider('Effects volume', (v) => settings.set('sfxVolume', v));
    const available = audioAvailable();
    if (!available) for (const c of [refs.sound, refs.masterVolume, refs.sfxVolume]) c.disabled = true;
    const resetHints = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Reset hints', 'aria-label': 'Show the first-run hints again', onclick: () => { if (onResetHints) onResetHints(); } });

    const panel = h('div', { class: 'panel modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title' }, [
      h('h2', { id: 'settings-title', text: 'Settings' }),
      h('div', { class: 'row' }, [h('div', { text: 'Quality' }), refs.quality]),
      make('autoQuality', 'Auto-lower quality', 'Drops one tier if FPS stays low'),
      make('screenShake', 'Screen shake', 'Camera kick on impacts'),
      make('reducedMotion', 'Reduced motion', 'Minimizes animation and effects'),
      make('damageNumbers', 'Floating damage numbers', 'Gold +N on kills is always shown'),
      h('div', { class: 'row' }, [h('div', { text: 'Particle density' }), refs.particleDensity]),
      h('h3', { class: 'group-title', text: 'Sound' }),
      ...(available ? [] : [h('div', { class: 'hint', role: 'status', text: 'Sound is not available in this browser' })]),
      sound.row,
      h('div', { class: 'row' }, [h('div', { text: 'Master volume' }), refs.masterVolume]),
      h('div', { class: 'row' }, [h('div', { text: 'Effects volume' }), refs.sfxVolume]),
      h('div', { class: 'row' }, [h('div', {}, [h('div', { text: 'First-run hints' }), h('div', { class: 'hint', text: 'Show the short tips again' })]), resetHints]),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'btn btn--ghost', text: 'Reset', 'aria-label': 'Reset settings to defaults', onclick: () => settings.reset() }),
        h('button', { type: 'button', class: 'btn btn--primary', text: 'Close', 'aria-label': 'Close settings', onclick: () => close() }),
      ]),
    ]);
    const node = h('div', { class: 'modal-backdrop' }, [panel]);
    node.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    node.addEventListener('keydown', trapTab(panel));
    node.addEventListener('pointerdown', (e) => { if (e.target === node) close(); });
    return node;
  };

  function open() {
    if (backdrop) return;
    opener = document.activeElement;
    pause.lock('settings');
    backdrop = build();
    root.append(backdrop);
    sync();
    refs.quality.focus();
  }

  function close() {
    if (!backdrop) return;
    backdrop.remove();
    backdrop = null;
    pause.unlock('settings');
    if (opener && opener.isConnected) opener.focus();
  }

  return { open, close, get isOpen() { return backdrop !== null; } };
}
