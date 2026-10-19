// Gallery sections that need no live renderer: palette, typography, enemies, icons, UI kit, colorblind check.
import { THEME } from './render/theme.js';
import { contrastRatio, deltaE76, simulateColorblind, CVD_MATRICES } from './render/color.js';
import { ENEMY_TYPES, drawEnemyShape, drawSilhouette } from './render/shapes.js';
import { TOWER_ORDER } from './data/towers.js';
import { createGlowCache } from './render/glow.js';
import { ICONS, iconSvg } from './ui/icons.js';
import { h } from './ui/dom.js';
import { createHud } from './ui/hud.js';
import { createTooltip } from './ui/tooltip.js';
import { createToaster } from './ui/toast.js';
import { createSettingsPanel } from './ui/settingsPanel.js';

const ENEMY_LABEL = {
  armoredGrunt: 'Armored Grunt', swarmling: 'Swarmling', fastRunner: 'Fast Runner', regenerator: 'Regenerator', shieldedBruiser: 'Shielded Bruiser',
};

/** 1. Palette swatches with contrast against bg0. */
export function paletteSection(el) {
  const groups = { colors: THEME.colors, enemy: THEME.enemy, tower: THEME.tower };
  for (const [gname, group] of Object.entries(groups)) {
    el.append(h('h3', { text: gname }));
    const grid = h('div', { class: 'g-swatches' });
    for (const [name, hex] of Object.entries(group)) {
      grid.append(h('div', { class: 'g-swatch' }, [
        h('div', { class: 'chipcolor', style: `background:${hex}` }),
        h('div', { class: 'meta', text: `${name}` }),
        h('div', { class: 'meta mono', text: `${hex}  ${contrastRatio(hex, THEME.colors.bg0).toFixed(2)}:1` }),
      ]));
    }
    el.append(grid);
  }
}

/** 2. Typography, including a numerals row that measures whether digits jitter. */
export function typographySection(el) {
  for (const w of [500, 600, 700]) el.append(h('div', { class: 'sample-display', style: `font-weight:${w}`, text: `Rajdhani ${w} — SIEGE MIND 0123456789` }));
  for (const w of [400, 500, 600]) el.append(h('div', { class: 'sample-body', style: `font-weight:${w}`, text: `Inter ${w} — The Director re-weights the next wave.` }));
  el.append(h('div', { class: 'mono', text: 'Mono stack — tick 4491  time 74.85s  ticks/s 60' }));

  const measure = (text, tabular) => {
    const s = h('span', { class: 'sample-display', style: `font-size:32px;display:inline-block;font-variant-numeric:${tabular ? 'tabular-nums' : 'normal'}`, text });
    el.append(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
  };
  const row = (tabular) => {
    const w = [...'0123456789'].map((d) => measure(d, tabular));
    return { spread: Math.max(...w) - Math.min(...w), w };
  };
  const normal = row(false);
  const tab = row(true);
  const digits = (tabular) => h('div', { class: 'sample-display', style: `font-size:32px;font-variant-numeric:${tabular ? 'tabular-nums' : 'normal'}`, text: '1111111111 / 0000000000 / 8888888888' });
  el.append(h('h3', { text: 'Numerals' }), digits(false), digits(true));
  el.append(h('p', { class: 'note', text: `Digit width spread: proportional ${normal.spread.toFixed(2)}px, tabular-nums ${tab.spread.toFixed(2)}px. ${tab.spread < 0.5 ? 'tabular-nums works, digits do not jitter.' : 'Digits still vary: HUD numbers rely on min-width to avoid layout shift.'}` }));
}

/** 3. Enemies: three sizes animated live, plus a flat silhouette row. */
export function enemiesSection(el, isVisible) {
  const glow = createGlowCache();
  const scales = [0.75, 1, 1.5];
  const W = 760;
  const H = 150 * 3 + 130;
  const canvas = h('canvas', { width: W * 2, height: H * 2, style: `width:${W}px;height:${H}px`, 'aria-label': 'Enemy shapes at three sizes plus flat silhouettes' });
  el.append(canvas);
  const ctx = canvas.getContext('2d');
  const opts = { flash: 0, spawn: 1, glow: true };
  const draw = (now) => {
    requestAnimationFrame(draw);
    if (!isVisible()) return;
    const t = now / 1000;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = THEME.colors.bg0;
    ctx.fillRect(0, 0, W, H);
    ctx.font = `600 13px ${THEME.fonts.display}`;
    ctx.fillStyle = THEME.colors.muted;
    ctx.textAlign = 'center';
    scales.forEach((s, row) => {
      ENEMY_TYPES.forEach((type, i) => {
        const x = 80 + i * 150;
        const y = 60 + row * 150;
        opts.flash = 0;
        drawEnemyShape(ctx, glow, type, x, y, s, t * 0.4, t, opts);
        if (row === 0) ctx.fillText(ENEMY_LABEL[type], x, 20);
      });
      ctx.textAlign = 'left';
      ctx.fillText(`${s}x`, 4, 20 + row * 150 + 20);
      ctx.textAlign = 'center';
    });
    // silhouette-only row: one flat color, shapes must still read apart
    ENEMY_TYPES.forEach((type, i) => drawSilhouette(ctx, type, 80 + i * 150, 490, 1.2, 0, THEME.colors.text));
    ctx.fillText('silhouette only (one flat color)', W / 2, 545);
  };
  requestAnimationFrame(draw);
}

/** 4. Icons at three sizes. */
export function iconsSection(el) {
  const names = Object.keys(ICONS).filter((n) => n.startsWith('tower-') || n.startsWith('enemy-'));
  const grid = h('div', { class: 'g-icons' });
  for (const n of names) {
    grid.append(h('div', { class: 'g-icon' }, [
      h('div', { class: 'sizes', html: [20, 32, 48].map((s) => iconSvg(n, s)).join('') }),
      h('div', { class: 'meta mono', text: n }),
    ]));
  }
  el.append(grid, h('p', { class: 'note', text: 'Full tower art arrives in Phase 3.' }));
  el.append(h('h3', { text: 'UI icons' }), h('div', { class: 'g-row', html: Object.keys(ICONS).filter((n) => !n.includes('-')).map((n) => `<span title="${n}">${iconSvg(n, 24)}</span>`).join('') }));
}

/** 6. UI components. */
export function uiSection(el) {
  const variants = h('div', { class: 'g-row' });
  for (const [cls, label] of [['btn', 'Default'], ['btn btn--primary', 'Primary'], ['btn btn--ghost', 'Ghost'], ['btn btn--danger', 'Danger'], ['btn is-active', 'Active']]) {
    variants.append(h('button', { type: 'button', class: cls, text: label }));
  }
  variants.append(h('button', { type: 'button', class: 'btn', text: 'Disabled', disabled: true }));
  variants.append(h('button', { type: 'button', class: 'btn btn--icon', 'aria-label': 'Settings icon button', 'data-tooltip': 'Icon button', html: iconSvg('settings', 20) }));
  el.append(h('h3', { text: 'Buttons' }), variants, h('p', { class: 'note', text: 'Hover, press and Tab to see hover / active / focus-visible states.' }));

  const sw = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': 'true', 'aria-label': 'Sample switch' });
  sw.addEventListener('click', () => sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true')));
  el.append(h('h3', { text: 'Switch, slider, select' }), h('div', { class: 'g-row' }, [
    sw,
    h('input', { type: 'range', class: 'slider', min: '0', max: '1', step: '0.05', value: '0.5', 'aria-label': 'Sample slider' }),
    h('select', { class: 'select', 'aria-label': 'Sample select' }, ['Low', 'Medium', 'High'].map((t) => h('option', { text: t }))),
  ]));
  el.append(h('h3', { text: 'Panels' }), h('div', { class: 'g-row' }, [
    h('div', { class: 'panel', text: 'Standard panel' }), h('div', { class: 'panel panel--director', text: 'Director panel (violet)' }),
  ]));

  // HUD sample at 70% scale
  const hudWrap = h('div', { class: 'g-hud' });
  const hudInner = h('div', { class: 'g-hud-inner' });
  hudWrap.append(hudInner);
  el.append(h('h3', { text: 'HUD' }), hudWrap);
  const hud = createHud({ root: hudInner, handlers: { togglePause: () => {}, setSpeed: (n) => hud.setSpeed(n), openSettings: () => {} } });
  hud.set({ gold: 150, lives: 20, wave: 3, waveTotal: 30 });
  hud.setSpeed(1);
  const bump = h('div', { class: 'g-row' }, [
    h('button', { type: 'button', class: 'btn', text: '+50 gold', onclick: () => hud.set({ gold: (bump.gold = (bump.gold ?? 150) + 50) }) }),
    h('button', { type: 'button', class: 'btn btn--danger', text: 'Lose a life', onclick: () => hud.set({ lives: (bump.lives = (bump.lives ?? 20) - 1) }) }),
  ]);
  el.append(bump);

  // Tooltips, toasts, modal inside a positioned zone
  const zone = h('div', { class: 'g-zone' });
  el.append(h('h3', { text: 'Tooltips, toasts, settings modal' }), zone);
  createTooltip({ root: zone });
  const toaster = createToaster({ root: zone });
  const settingsStub = { get: () => 'high', set() {}, subscribe: () => () => {}, reset() {} };
  const panel = createSettingsPanel({ root: zone, settings: settingsStub, pause: { lock() {}, unlock() {} } });
  zone.append(h('div', { class: 'g-row' }, [
    h('button', { type: 'button', class: 'btn', text: 'Tooltip (hover)', 'data-tooltip-title': 'Lance', 'data-tooltip': 'Piercing shot that ignores armor. Strong vs Armored Grunt, weak vs Swarmling.' }),
    h('button', { type: 'button', class: 'btn', text: 'Toast', onclick: () => toaster.show('Wave 4 incoming: 12 enemies') }),
    h('button', { type: 'button', class: 'btn', text: 'Director toast', onclick: () => toaster.show('Director: Fast Runners leaked 40% — weight up', { kind: 'director' }) }),
    h('button', { type: 'button', class: 'btn btn--primary', text: 'Open settings modal', onclick: () => panel.open() }),
  ]));
}

/** 8. Colorblind simulation filters + pairwise enemy deltaE table. */
export function colorblindSection(el, content) {
  const kinds = ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];
  const svg = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(CVD_MATRICES).map(([k, m]) =>
    `<filter id="cvd-${k}" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${m.slice(0, 3).join(' ')} 0 0 ${m.slice(3, 6).join(' ')} 0 0 ${m.slice(6, 9).join(' ')} 0 0 0 0 0 1 0"/></filter>`).join('')}</defs></svg>`;
  el.insertAdjacentHTML('beforeend', svg);
  const radios = h('div', { class: 'g-row', role: 'radiogroup', 'aria-label': 'Colorblind simulation' });
  for (const k of kinds) {
    const input = h('input', { type: 'radio', name: 'cvd', value: k, id: `cvd-r-${k}` });
    if (k === 'none') input.checked = true;
    input.addEventListener('change', () => { content.style.filter = k === 'none' ? '' : `url(#cvd-${k})`; });
    radios.append(h('label', {}, [input, ` ${k}`]));
  }
  el.append(radios);

  const sets = [['enemies', ENEMY_TYPES.map((t) => [THEME.enemy[t], ENEMY_LABEL[t]])], ['towers', TOWER_ORDER.map((t) => [THEME.tower[t], t[0].toUpperCase() + t.slice(1)])]];
  const rows = sets.flatMap(([setName, items]) => ['none', ...kinds.slice(1)].map((k) => {
    const labels = items.map(([, name]) => name);
    const colors = items.map(([hex]) => (k === 'none' ? hex : simulateColorblind(hex, k)));
    let min = Infinity;
    let pair = '';
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const d = deltaE76(colors[i], colors[j]);
        if (d < min) { min = d; pair = `${labels[i]} / ${labels[j]}`; }
      }
    }
    return h('tr', {}, [h('td', { text: `${setName}: ${k}` }), h('td', { class: 'mono', text: min.toFixed(1) }), h('td', { text: pair }),
      h('td', { text: min < 10 ? 'Below 10: rely on silhouette' : 'ok' })]);
  }));
  el.append(h('table', { class: 'g-table' }, [
    h('thead', {}, [h('tr', {}, ['Simulation', 'Min pairwise ΔE76', 'Closest pair', 'Note'].map((t) => h('th', { text: t })))]),
    h('tbody', {}, rows),
  ]));
}
