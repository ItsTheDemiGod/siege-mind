// Single source of truth for colors, tokens, durations and fonts. src/ui/style.css mirrors cssVariables() (enforced by tests).
import { config } from '../data/config.js';

export const THEME = Object.freeze({
  colors: Object.freeze({
    bg0: '#070b14',
    bg1: '#0d1424',
    panel: '#111a2e',
    gridLine: '#17233f',
    text: '#e8f0ff',
    muted: '#7f90b0',
    primary: '#35e0ff',
    secondary: '#5b8cff',
    tertiary: '#7af0d0',
    whiteHot: '#e6fbff',
    director: '#a56bff',
    danger: '#ff4d5e', // leak / damage red, distinct from enemy coral by hue and use
  }),
  enemy: Object.freeze({
    armoredGrunt: '#ff8a3d',
    swarmling: '#ff3d8b',
    fastRunner: '#ffd84d',
    regenerator: '#a6ff4d',
    shieldedBruiser: '#ff5252',
    shieldRing: '#ffe9e9',
  }),
  // Towers use only the Defense family; silhouette separates them.
  tower: Object.freeze({
    lance: '#35e0ff',
    mortar: '#5b8cff',
    frost: '#e6fbff',
    poison: '#7af0d0',
    sniper: '#35e0ff',
  }),
  tokens: Object.freeze({
    radiusSm: 4,
    radiusMd: 8,
    radiusLg: 14,
    space: Object.freeze([4, 8, 12, 16, 24, 32]),
    borderWidth: 1,
    glowBorderAlpha: 0.35,
  }),
  durations: Object.freeze({ fast: config.ui.durFast, normal: config.ui.durNormal, slow: config.ui.durSlow }),
  fonts: Object.freeze({
    display: '"Rajdhani", "Segoe UI", system-ui, sans-serif',
    body: '"Inter", "Segoe UI", system-ui, sans-serif',
    mono: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
  }),
});

/** @param {string} s camelCase @returns {string} kebab-case */
const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/**
 * Every theme value as CSS custom properties (name -> string value).
 * @returns {Record<string, string>}
 */
export function cssVariables() {
  const v = {};
  const c = THEME.colors;
  for (const k of ['bg0', 'bg1', 'panel', 'gridLine', 'text', 'muted', 'whiteHot', 'director', 'danger']) v[`--${kebab(k)}`] = c[k];
  for (const k of ['primary', 'secondary', 'tertiary']) v[`--defense-${k}`] = c[k];
  for (const [k, val] of Object.entries(THEME.enemy)) v[`--${k === 'shieldRing' ? '' : 'enemy-'}${kebab(k)}`] = val;
  for (const [k, val] of Object.entries(THEME.tower)) v[`--tower-${k}`] = val;
  const t = THEME.tokens;
  v['--radius-sm'] = `${t.radiusSm}px`;
  v['--radius-md'] = `${t.radiusMd}px`;
  v['--radius-lg'] = `${t.radiusLg}px`;
  t.space.forEach((s, i) => { v[`--space-${i + 1}`] = `${s}px`; });
  v['--border-width'] = `${t.borderWidth}px`;
  v['--glow-border-alpha'] = String(t.glowBorderAlpha);
  for (const [k, s] of Object.entries(THEME.durations)) v[`--dur-${k}`] = `${Math.round(s * 1000)}ms`;
  for (const [k, f] of Object.entries(THEME.fonts)) v[`--font-${k}`] = f;
  return v;
}
