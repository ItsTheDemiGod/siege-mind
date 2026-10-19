// Main menu: mode, game length and seed, then Start (a page navigation, so a new game is a clean boot). Dialog with a focus trap.
import { MODES, LENGTH_OPTIONS, RANDOM_CONTROL, RESEARCH_ARMS } from '../data/menuText.js';
import { config } from '../data/config.js';
import { h } from './dom.js';
import { createRadioGroup } from './radioGroup.js';
import { trapTab } from './focusTrap.js';
import { parseSeedInput, buildPlayUrl, parseModeParam } from './menuState.js';

const TAGLINE = 'A tower defense where the enemy learns.';
const SEED_ERRORS = {
  too_large: 'That number is too large (maximum 4294967295).',
  bad_chars: 'Use letters, digits, - and _ only.',
  too_long: 'Text seeds can be at most 24 characters.',
};

/**
 * @param {{root: HTMLElement, pause: {lock: Function, unlock: Function}, params: URLSearchParams, randomSeed: () => number,
 *   navigate?: (url: string) => void, href?: () => string, openHowTo: () => void, openSettings: () => void}} o
 * @returns {{open: () => void, close: () => void, readonly isOpen: boolean}}
 */
export function createMainMenu({ root, pause, params, randomSeed, openHowTo, openSettings, navigate = (u) => window.location.assign(u), href = () => window.location.href }) {
  const wavesParam = Number(params.get('waves'));
  let mode = parseModeParam(params.get('mode')).mode; // 'random' (URL only) is kept until the player picks a radio
  let waves = config.game.allowedTotals.includes(wavesParam) ? wavesParam : config.game.quickTotal;

  const noteFor = (id) => (id === 'random' ? `${RANDOM_CONTROL.label}: ${RANDOM_CONTROL.blurb}` : RESEARCH_ARMS[id] ? `${RESEARCH_ARMS[id].label}: ${RESEARCH_ARMS[id].blurb}` : MODES.find((m) => m.id === id)?.blurb ?? '');
  const modeNote = h('p', { class: 'menu-mode-note', 'aria-live': 'polite', text: noteFor(mode) });
  const modeGroup = createRadioGroup({
    label: 'Mode', selected: mode === 'adaptive' ? 'adaptive' : 'static',
    options: MODES.map((m) => ({ id: m.id, label: m.label, blurb: m.blurb, available: m.available })),
    onChange: (id) => { mode = id; modeNote.textContent = noteFor(mode); },
  });
  const lengthGroup = createRadioGroup({
    label: 'Game length', selected: String(waves),
    options: LENGTH_OPTIONS.map((l) => ({ id: String(l.waves), label: l.label, blurb: l.blurb })),
    onChange: (id) => { waves = Number(id); },
  });
  const seedInput = h('input', { type: 'text', class: 'input', id: 'menu-seed', placeholder: 'Random', autocomplete: 'off', maxlength: '32', 'aria-describedby': 'menu-seed-error' });
  if (params.has('seed')) seedInput.value = params.get('seed');
  const seedError = h('div', { class: 'form-error', id: 'menu-seed-error', role: 'alert', 'aria-live': 'assertive' });
  const clearError = () => { seedError.textContent = ''; seedInput.removeAttribute('aria-invalid'); };
  const randomBtn = h('button', { type: 'button', class: 'btn', text: 'Random', 'aria-label': 'Fill in a random seed' });
  randomBtn.addEventListener('click', () => { seedInput.value = String(randomSeed()); clearError(); });
  seedInput.addEventListener('input', clearError);

  const start = h('button', { type: 'button', class: 'btn btn--primary menu-start', text: 'Start' });
  start.addEventListener('click', () => {
    const text = seedInput.value.trim();
    const r = text === '' ? { ok: true, seed: randomSeed() } : parseSeedInput(text);
    if (!r.ok) {
      seedError.textContent = SEED_ERRORS[r.reason] ?? 'That seed is not valid.';
      seedInput.setAttribute('aria-invalid', 'true');
      seedInput.focus();
      return;
    }
    navigate(buildPlayUrl(href(), { seed: r.seed, mode, waves }));
  });

  const links = h('div', { class: 'menu-links' }, [
    h('button', { type: 'button', class: 'btn', text: 'How to play', onclick: () => openHowTo() }),
    h('button', { type: 'button', class: 'btn', text: 'Settings', onclick: () => openSettings() }),
    h('a', { class: 'btn', href: 'gallery.html', text: 'Gallery' }),
  ]);
  const card = h('div', { class: 'panel menu-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'menu-title' }, [
    h('h1', { id: 'menu-title', class: 'menu-title', text: 'SIEGE MIND' }),
    h('p', { class: 'menu-tagline', text: TAGLINE }),
    h('div', { class: 'menu-field' }, [h('div', { class: 'menu-label', text: 'Mode' }), modeGroup.el, modeNote]),
    h('div', { class: 'menu-field' }, [h('div', { class: 'menu-label', text: 'Game length' }), lengthGroup.el]),
    h('div', { class: 'menu-field' }, [
      h('label', { class: 'menu-label', for: 'menu-seed', text: 'Seed (optional)' }),
      h('div', { class: 'menu-seed' }, [seedInput, randomBtn]), seedError,
    ]),
    start, links,
  ]);
  card.style.setProperty('--menu-width', `${config.ui.menuWidth}px`);
  const backdrop = h('div', { class: 'menu-backdrop' }, [card]);
  backdrop.addEventListener('keydown', trapTab(card));
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === seedInput) start.click(); });

  let isOpen = false;
  return {
    open() { if (isOpen) return; isOpen = true; pause.lock('menu'); root.append(backdrop); start.focus(); },
    close() { if (!isOpen) return; isOpen = false; pause.unlock('menu'); backdrop.remove(); },
    get isOpen() { return isOpen; },
  };
}
