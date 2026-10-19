// Hand-built inline SVG icons: 24x24, stroke-based, currentColor only. Tower/enemy icons differ by silhouette, not color.

const ICONS = {
  gold: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
  lives: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  wave: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  step: '<path d="M6 5l9 7-9 7zM18 5v14"/>',
  speed1: '<path d="M8 6l6 6-6 6"/>',
  speed2: '<path d="M5 6l6 6-6 6M12 6l6 6-6 6"/>',
  speed3: '<path d="M3 6l5 6-5 6M10 6l5 6-5 6M17 6l5 6-5 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  quality: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
  shake: '<path d="M2 12l3-5 3 10 3-10 3 10 3-10 3 5"/>',
  motion: '<path d="M4 8h8M4 12h12M4 16h6M17 7l4 5-4 5"/>',
  'sound-on': '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  'sound-off': '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  director: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'tower-lance': '<path d="M8 21l-2-3 2-3h8l2 3-2 3z"/><path d="M12 8l2.2 5L12 17l-2.2-4z"/><path d="M10.5 2v8M13.5 2v8"/>',
  'tower-mortar': '<path d="M8 21l-3-3v-4l3-3h8l3 3v4l-3 3z"/><path d="M9 12V4.5h6V12"/><circle cx="12" cy="16" r="2"/>',
  'tower-frost': '<path d="M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
  'tower-poison': '<circle cx="12" cy="15" r="6.5"/><path d="M10 8.5V3h4v5.5"/><path d="M8 16h8"/>',
  'tower-sniper': '<circle cx="12" cy="16" r="5"/><path d="M12 11V1M12 22v-1M3 16h2M19 16h2M10 12h4"/>',
  'enemy-armored-grunt': '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><path d="M8 12h8"/>',
  'enemy-swarmling': '<path d="M12 8l4 8H8z"/>',
  'enemy-fast-runner': '<path d="M3 6l12 6-12 6 4-6z"/><path d="M18 9h3M18 15h3"/>',
  'enemy-regenerator': '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/>',
  'enemy-shielded-bruiser': '<path d="M9.5 6h5l3 3v6l-3 3h-5l-3-3V9z"/><circle cx="12" cy="12" r="10.5" stroke-dasharray="3 3"/>',
};

export { ICONS };

/**
 * Inline SVG markup for an icon (inherits color via currentColor).
 * @param {string} name - key of ICONS
 * @param {number} [size] - px
 * @returns {string}
 */
export function iconSvg(name, size = 20) {
  const body = ICONS[name];
  if (body === undefined) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** @param {string} enemyId camelCase enemy id @returns {string} icon name, e.g. armoredGrunt -> enemy-armored-grunt */
export const enemyIconName = (enemyId) => `enemy-${enemyId.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
