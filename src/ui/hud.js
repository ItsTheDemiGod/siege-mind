// Top HUD bar (inside the 80 px strip): gold / lives / wave on the left, speed + pause + settings on the right.
import { config } from '../data/config.js';
import { h, iconButton } from './dom.js';
import { iconSvg } from './icons.js';

const reduced = () => document.documentElement.classList.contains('reduced-motion');

function chip(icon, label, numClass = 'num', extra = '') {
  const num = h('span', { class: numClass, text: '0' });
  const root = h('div', { class: `chip ${extra}`.trim(), role: 'group', 'aria-label': label }, [
    h('span', { html: iconSvg(icon, 22) }),
    h('span', { class: 'label', text: label }),
    num,
  ]);
  return { root, num };
}

/** Restart a one-shot CSS animation class. */
function pulse(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // reflow so the animation can replay
  el.classList.add(cls);
}

/**
 * @param {{root: HTMLElement, handlers: {togglePause: () => void, setSpeed: (n: number) => void, openSettings: () => void, toggleDirector?: () => void}}} o toggleDirector adds the Director overlay button (Adaptive and Random modes only)
 * @returns {{set: Function, setSpeed: (n: number) => void, setPaused: (p: boolean) => void, setDirectorPressed: (on: boolean) => void}}
 */
export function createHud({ root, handlers }) {
  const gold = chip('gold', 'Gold', 'num', 'chip--gold');
  const lives = chip('lives', 'Lives');
  const wave = chip('wave', 'Wave', 'num num--wide');
  const shown = { gold: 0, lives: 0 };
  const anim = { gold: 0, lives: 0 };

  const speedButtons = config.sim.speeds.map((n) => {
    const b = iconButton({
      icon: `speed${n}`, label: `Speed x${n}`, tooltip: `Speed x${n} (${n})`, onClick: () => handlers.setSpeed(n), className: 'btn btn--icon',
    });
    b.setAttribute('aria-pressed', 'false');
    return b;
  });
  const pauseBtn = iconButton({ icon: 'pause', label: 'Pause', tooltip: 'Pause (Space)', onClick: () => handlers.togglePause() });
  const settingsBtn = iconButton({ icon: 'settings', label: 'Settings', tooltip: 'Settings', onClick: () => handlers.openSettings() });

  const directorBtn = handlers.toggleDirector
    ? iconButton({ icon: 'director', label: 'Director overlay (I)', tooltip: 'Director overlay (I)', onClick: () => handlers.toggleDirector(), className: 'btn btn--icon btn--director' })
    : null;
  directorBtn?.setAttribute('aria-pressed', 'false');

  const bar = h('div', { class: 'hud' }, [
    h('div', { class: 'hud-cluster' }, [gold.root, lives.root, wave.root]),
    h('div', { class: 'hud-cluster' }, [...(directorBtn ? [directorBtn] : []), ...speedButtons, pauseBtn, settingsBtn]),
  ]);
  root.append(bar);

  /** Count a displayed number toward `target` over durNormal; instant under reduced motion. */
  function countTo(key, el, target) {
    cancelAnimationFrame(anim[key]);
    const from = shown[key];
    if (reduced() || from === target) { shown[key] = target; el.textContent = String(target); return; }
    const t0 = performance.now();
    const dur = config.ui.durNormal * 1000;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      shown[key] = Math.round(from + (target - from) * t);
      el.textContent = String(shown[key]);
      if (t < 1) anim[key] = requestAnimationFrame(tick);
    };
    anim[key] = requestAnimationFrame(tick);
  }

  let last = { gold: null, lives: null };
  return {
    bar, // the HUD element, so other UI (the build tray) can live inside the strip
    /** @param {{gold?: number, lives?: number, wave?: number, waveTotal?: number}} v */
    set({ gold: g, lives: l, wave: w, waveTotal }) {
      // lives and gold animate; the wave chip shows "current / total"
      if (g !== undefined && g !== last.gold) {
        countTo('gold', gold.num, g);
        if (last.gold !== null) pulse(gold.root, 'is-pop');
        last.gold = g;
      }
      if (l !== undefined && l !== last.lives) {
        countTo('lives', lives.num, l);
        if (last.lives !== null && l < last.lives) pulse(lives.root, 'is-hurt');
        last.lives = l;
      }
      if (w !== undefined) wave.num.textContent = `${w} / ${waveTotal ?? config.game.totalWaves}`;
    },
    setDirectorPressed(on) {
      if (!directorBtn) return;
      directorBtn.setAttribute('aria-pressed', String(on));
      directorBtn.classList.toggle('is-active', on);
    },
    setSpeed(n) {
      speedButtons.forEach((b, i) => {
        const on = config.sim.speeds[i] === n;
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('is-active', on);
      });
    },
    setPaused(paused) {
      pauseBtn.innerHTML = iconSvg(paused ? 'play' : 'pause', 20);
      pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
      pauseBtn.setAttribute('data-tooltip', paused ? 'Resume (Space)' : 'Pause (Space)');
      pauseBtn.classList.toggle('is-active', paused);
    },
  };
}
