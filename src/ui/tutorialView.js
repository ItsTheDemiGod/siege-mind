// The first-run hint card: placed once at a position clear of the path (see hintPlacement.js), text via textContent, never over a dialog. The state lives in tutorialState.js.
import { h } from './dom.js';
import { HINTS, HINT_GEOMETRY } from './tutorialText.js';

/**
 * @param {{root: HTMLElement, rect: {left: number, top: number}, tutorial: ReturnType<import('./tutorialState.js').createTutorial>, isSuspended: () => boolean, hints?: readonly {id: string, text: string}[]}} o
 * @returns {{update: () => void, el: HTMLElement}} update() syncs the card with the state (call it a few times per second)
 */
export function createTutorialView({ root, rect, tutorial, isSuspended, hints = HINTS }) {
  const g = HINT_GEOMETRY;
  const text = h('p', { class: 'hint-text' });
  const gotIt = h('button', { type: 'button', class: 'btn btn--primary', text: 'Got it', 'aria-label': 'Dismiss hint', onclick: () => { tutorial.dismiss(); update(); } });
  const skip = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Skip all hints', onclick: () => { tutorial.skipAll(); update(); } });
  const el = h('div', { class: 'hint-card panel', role: 'status', 'aria-live': 'polite', hidden: true }, [text, h('div', { class: 'hint-actions' }, [gotIt, skip])]);
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${g.width}px`;
  el.style.maxHeight = `${g.maxHeight}px`;
  root.append(el);
  let shownId = null;

  function update() {
    const id = isSuspended() ? null : tutorial.current();
    if (id === shownId) return;
    shownId = id;
    if (id === null) { el.hidden = true; return; }
    text.textContent = hints.find((x) => x.id === id).text;
    el.hidden = false;
    el.classList.remove('is-in');
    void el.offsetWidth; // restart the fade (a layout read, not an allocation)
    el.classList.add('is-in');
  }
  return { update, el };
}
