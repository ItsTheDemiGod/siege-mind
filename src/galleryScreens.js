// Gallery section "4b Core and screens": the real drawBaseCore in every state, the real wave banner and the real end screens.
import { config } from './data/config.js';
import { createGlowCache } from './render/glow.js';
import { drawBaseCore } from './render/coreRenderer.js';
import { coreIntegrity } from './ui/coreIntegrity.js';
import { createWaveBanner } from './ui/waveBanner.js';
import { describeBanner } from './ui/bannerState.js';
import { buildEndModel } from './ui/endModel.js';
import { renderEndScreen } from './ui/endScreenView.js';
import { h } from './ui/dom.js';

const SIZE = 160;
const MAX_LIVES = 20;
const STATE_INDEX = { healthy: 0, damaged: 1, critical: 2, destroyed: 3 };
const LOOP_PAUSE = 1; // seconds held on the final frame of a looping animation
const END_TOTAL = config.game.quickTotal;
const NOOP = () => {};

/** Deterministic fake wave log for the end-screen previews: a few waves hurt, optionally ending in a failed wave. */
function fakeGame(result) {
  const lost = result === 'lost';
  const reached = lost ? 11 : END_TOTAL;
  const waveLog = [];
  for (let wave = 1; wave <= reached; wave++) {
    const failed = lost && wave === reached;
    waveLog.push({ wave, name: wave === 10 ? 'Set piece' : null, fixed: wave === 10, complete: !failed, livesLost: failed ? 6 : (wave * 7) % 5 === 0 ? 2 : (wave * 3) % 7 === 0 ? 1 : 0 });
  }
  const livesLost = waveLog.reduce((n, e) => n + e.livesLost, 0);
  return {
    result, seed: 12345, totalWaves: END_TOTAL, lives: Math.max(0, MAX_LIVES - livesLost), tick: 60 * 60 * 18, waveLog, waves: { current: reached },
    stats: { wavesCleared: lost ? reached - 1 : END_TOTAL, kills: 412, leaks: livesLost, goldFromKills: 1900, goldFromBonus: 700, towersBuilt: 18 },
  };
}

/**
 * @param {HTMLElement} host section element @param {() => boolean} isVisible
 * @param {{reducedMotion: () => boolean, setReducedMotion: (v: boolean) => void}} motion
 */
export function screensSection(host, isVisible, motion) {
  let tier = 'high';
  const glow = createGlowCache();
  const reduced = () => motion.reducedMotion();

  // ---- core states, looping destroyed and victory ----
  const cores = [
    ['Healthy 20/20', () => ({ lives: 20 })],
    ['Damaged 12/20', () => ({ lives: 12 })],
    ['Critical 4/20', () => ({ lives: 4 })],
    ['Destroyed (loop)', (t) => ({ lives: 0, destroyT: Math.min(1, (t % (config.fx.coreDestroySeconds + LOOP_PAUSE)) / config.fx.coreDestroySeconds) })],
    ['Victory (loop)', (t) => ({ lives: 20, victoryT: (t % config.fx.coreVictorySeconds) / config.fx.coreVictorySeconds })],
  ];
  const view = { segments: 0, state: 0, pulse: 0, destroyT: 0, victoryT: 0 };
  const cells = cores.map(([label, make]) => {
    const canvas = h('canvas', { width: SIZE, height: SIZE, 'aria-label': `Base core: ${label}` });
    return { label, make, canvas, ctx: canvas.getContext('2d') };
  });
  host.append(h('div', { class: 'g-row' }, cells.map((c) => h('figure', { class: 'g-cell' }, [c.canvas, h('figcaption', { class: 'note', text: c.label })]))));

  const tierRow = h('div', { class: 'g-row', role: 'radiogroup', 'aria-label': 'Core quality tier' });
  for (const t of ['low', 'medium', 'high']) {
    const input = h('input', { type: 'radio', name: 'core-tier', value: t });
    if (t === tier) input.checked = true;
    input.addEventListener('change', () => { tier = t; });
    tierRow.append(h('label', {}, [input, ` ${t}`]));
  }
  const rm = h('input', { type: 'checkbox' });
  rm.addEventListener('change', () => motion.setReducedMotion(rm.checked));
  tierRow.append(h('label', {}, [rm, ' reduced motion']));
  host.append(tierRow);

  const t0 = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!isVisible()) return;
    const time = (now - t0) / 1000;
    for (const c of cells) {
      const spec = c.make(time);
      const integrity = coreIntegrity(spec.lives, MAX_LIVES, config.fx);
      view.segments = integrity.segments;
      view.state = STATE_INDEX[integrity.state];
      view.destroyT = spec.destroyT ?? 0;
      view.victoryT = spec.victoryT ?? 0;
      c.ctx.clearRect(0, 0, SIZE, SIZE);
      c.ctx.save();
      c.ctx.translate(SIZE / 2, SIZE / 2);
      drawBaseCore(c.ctx, glow, 0, 0, time, view, config.quality[tier], reduced());
      c.ctx.restore();
    }
  };
  requestAnimationFrame(loop);

  // ---- wave banner ----
  const bannerHost = h('div', { class: 'g-banner-host' });
  const banner = createWaveBanner({ root: bannerHost, reducedMotion: reduced });
  const comp = { armoredGrunt: 6, swarmling: 16, fastRunner: 4 };
  const showBanner = (wave, fixed, name) => banner.show(describeBanner({ wave, name, fixed, composition: comp, hpMult: 2.4 }, END_TOTAL));
  host.append(h('h3', { text: 'Wave banner' }), bannerHost, h('div', { class: 'g-row' }, [
    h('button', { type: 'button', class: 'btn', text: 'Normal wave 4', onclick: () => showBanner(4, false, null) }),
    h('button', { type: 'button', class: 'btn', text: 'Set piece wave 10', onclick: () => showBanner(10, true, 'The Breach') }),
    h('button', { type: 'button', class: 'btn', text: `Final wave ${END_TOTAL}`, onclick: () => showBanner(END_TOTAL, true, 'Last Stand') }),
  ]));

  // ---- end screens inside a scaled 1280x720 stage ----
  const scaler = h('div', { class: 'g-scaler' });
  const stage = h('div', { class: 'g-end-stage' });
  scaler.append(stage);
  const fit = () => {
    const k = Math.min(1, (host.clientWidth || 960) / config.view.width);
    stage.style.transform = `scale(${k})`;
    scaler.style.height = `${config.view.height * k}px`;
  };
  fit();
  window.addEventListener('resize', fit);
  const showEnd = (result) => {
    const model = fakeGame(result);
    stage.replaceChildren();
    stage.append(renderEndScreen(buildEndModel(model), { onRetry: NOOP, onNewSeed: NOOP, onMenu: NOOP }).el);
  };
  host.append(h('h3', { text: 'End screens (preview with fake data)' }), h('div', { class: 'g-row' }, [
    h('button', { type: 'button', class: 'btn', text: 'Show victory', onclick: () => showEnd('won') }),
    h('button', { type: 'button', class: 'btn', text: 'Show defeat', onclick: () => showEnd('lost') }),
    h('button', { type: 'button', class: 'btn btn--ghost', text: 'Clear', onclick: () => stage.replaceChildren() }),
  ]), scaler);
}
