// How-to-play dialog: the steps and a one-line guide to each enemy. Escape is handled by the single resolver in main.js.
import { HOW_TO_STEPS, ENEMY_BLURBS } from '../data/menuText.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';
import { h } from './dom.js';
import { iconSvg, enemyIconName } from './icons.js';
import { trapTab } from './focusTrap.js';

/**
 * @param {{root: HTMLElement, pause: {lock: Function, unlock: Function}}} o
 * @returns {{open: () => void, close: () => void, readonly isOpen: boolean}}
 */
export function createHowToPlay({ root, pause }) {
  let backdrop = null;
  let opener = null;

  function close() {
    if (!backdrop) return;
    backdrop.remove();
    backdrop = null;
    pause.unlock('howto');
    if (opener && opener.isConnected) opener.focus();
  }

  function open() {
    if (backdrop) return;
    opener = document.activeElement;
    pause.lock('howto');
    const steps = h('ol', { class: 'howto-steps' }, HOW_TO_STEPS.map((t) => h('li', { text: t })));
    const enemies = h('ul', { class: 'howto-enemies' }, ENEMY_ORDER.map((id) => h('li', {}, [
      h('span', { html: iconSvg(enemyIconName(id), 22) }),
      h('span', {}, [h('strong', { text: ENEMIES[id].name }), h('span', { text: ` — ${ENEMY_BLURBS[id]}` })]),
    ])));
    const closeBtn = h('button', { type: 'button', class: 'btn btn--primary', text: 'Close', 'aria-label': 'Close how to play', onclick: close });
    const card = h('div', { class: 'panel modal howto-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'howto-title' }, [
      h('h2', { id: 'howto-title', text: 'How to play' }), steps, h('h3', { text: 'The enemies' }), enemies,
      h('div', { class: 'actions' }, [closeBtn]),
    ]);
    backdrop = h('div', { class: 'modal-backdrop howto-backdrop' }, [card]);
    backdrop.addEventListener('keydown', trapTab(card));
    root.append(backdrop);
    closeBtn.focus();
  }

  return { open, close, get isOpen() { return backdrop !== null; } };
}
