// Wave banner: a short announcement under the HUD when a wave starts. One persistent live region, so screen readers hear it.
import { config } from '../data/config.js';
import { h } from './dom.js';
import { compositionChips } from './compositionChips.js';

const TOP_OFFSET = 72; // below the HUD strip

/**
 * @param {{root: HTMLElement, reducedMotion: () => boolean}} o
 * @returns {{show: (desc: object) => void, hide: () => void, dispose: () => void}}
 */
export function createWaveBanner({ root, reducedMotion }) {
  const kicker = h('div', { class: 'wb-kicker' });
  const title = h('div', { class: 'wb-title' });
  const chips = h('div', { class: 'wb-chips' });
  const hp = h('div', { class: 'wb-hp' });
  const director = h('div', { class: 'wb-director', hidden: true });
  const el = h('div', { class: 'wave-banner', role: 'status', 'aria-live': 'polite', hidden: true }, [kicker, title, chips, hp, director]);
  el.style.top = `${config.view.hudHeight + TOP_OFFSET}px`;
  root.append(el);
  let timer = 0;

  function hide() {
    clearTimeout(timer);
    el.hidden = true;
    el.classList.remove('is-in');
  }

  /** @param {{kicker: string, title: string, fixed: boolean, final: boolean, items: object[], hpLine: string, seconds: number}} d describeBanner result */
  function show(d) {
    clearTimeout(timer);
    kicker.textContent = d.kicker;
    title.textContent = d.title;
    hp.textContent = d.hpLine;
    director.hidden = !d.directorLine;
    director.textContent = d.directorLine ?? '';
    chips.replaceChildren(...compositionChips(d.items));
    el.classList.toggle('is-fixed', d.fixed);
    el.classList.toggle('is-final', d.final);
    el.hidden = false;
    el.classList.remove('is-in');
    if (!reducedMotion()) { void el.offsetWidth; el.classList.add('is-in'); } // restart the slide-in; reduced motion just appears
    timer = setTimeout(hide, d.seconds * 1000);
  }

  return { show, hide, dispose() { hide(); el.remove(); } };
}
