// Pause menu (opened with Esc): Resume, Settings, How to play, and Restart / Quit which need a second click.
import { config } from '../data/config.js';
import { h } from './dom.js';
import { trapTab } from './focusTrap.js';
import { createConfirmClick } from './confirmClick.js';

/**
 * @param {{root: HTMLElement, pause: {lock: Function, unlock: Function}, onRestart: () => void, onQuit: () => void,
 *   openSettings: () => void, openHowTo: () => void, onDownload?: () => void, now?: () => number, isMuted?: () => boolean, toggleMute?: () => void}} o isMuted/toggleMute add the Sound toggle
 * @returns {{open: () => void, close: () => void, readonly isOpen: boolean}}
 */
export function createPauseMenu({ root, pause, onRestart, onQuit, openSettings, openHowTo, onDownload, now = () => performance.now() / 1000, isMuted, toggleMute }) {
  let backdrop = null;
  let opener = null;
  const timers = [];

  function close() {
    if (!backdrop) return;
    timers.splice(0).forEach(clearTimeout);
    backdrop.remove();
    backdrop = null;
    pause.unlock('pause-menu');
    if (opener && opener.isConnected) opener.focus();
  }

  /** A button that needs two clicks within the confirm window; its label says so while armed. */
  function confirmButton(label, action) {
    const gate = createConfirmClick(config.ui.confirmWindowSeconds);
    const b = h('button', { type: 'button', class: 'btn btn--danger', text: label });
    b.addEventListener('click', () => {
      if (gate.click(now()) === 'confirm') { action(); return; }
      b.textContent = 'Click again to confirm';
      timers.push(setTimeout(() => { b.textContent = label; gate.reset(); }, config.ui.confirmWindowSeconds * 1000));
    });
    return b;
  }

  function open() {
    if (backdrop) return;
    opener = document.activeElement;
    pause.lock('pause-menu');
    let soundBtn = null;
    if (isMuted && toggleMute) {
      const label = () => (isMuted() ? 'Sound: off' : 'Sound: on');
      soundBtn = h('button', { type: 'button', class: 'btn', text: label(), 'aria-pressed': String(!isMuted()) });
      soundBtn.addEventListener('click', () => { toggleMute(); soundBtn.textContent = label(); soundBtn.setAttribute('aria-pressed', String(!isMuted())); }); // the menu stays open
    }
    const resume = h('button', { type: 'button', class: 'btn btn--primary', text: 'Resume', onclick: close });
    const card = h('div', { class: 'panel modal pause-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pause-title' }, [
      h('h2', { id: 'pause-title', text: 'Paused' }),
      h('div', { class: 'pause-list' }, [
        resume,
        h('button', { type: 'button', class: 'btn', text: 'Settings', onclick: () => openSettings() }),
        h('button', { type: 'button', class: 'btn', text: 'How to play', onclick: () => openHowTo() }),
        soundBtn ?? '',
        onDownload ? h('button', { type: 'button', class: 'btn', text: 'Download run data', 'aria-label': 'Download run data as JSON', onclick: () => onDownload() }) : '',
        confirmButton('Restart', onRestart),
        confirmButton('Quit to menu', onQuit),
      ]),
    ]);
    backdrop = h('div', { class: 'modal-backdrop' }, [card]);
    backdrop.addEventListener('keydown', trapTab(card));
    root.append(backdrop);
    resume.focus();
  }

  return { open, close, get isOpen() { return backdrop !== null; } };
}
