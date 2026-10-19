// Pure helpers for the main menu: seed input parsing and the URLs that start or leave a game.

const MAX_SEED = 4294967295;
const MAX_TEXT_SEED = 24;
const RESET_PARAMS = ['play', 'debug', 'stress', 'wave', 'gold', 'spawn', 'startlives'];

/**
 * @param {string} text what the player typed
 * @returns {{ok: boolean, seed?: number|string, reason?: 'empty'|'too_large'|'bad_chars'|'too_long'}}
 */
export function parseSeedInput(text) {
  const t = String(text ?? '').trim();
  if (t === '') return { ok: false, reason: 'empty' };
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return n <= MAX_SEED ? { ok: true, seed: n } : { ok: false, reason: 'too_large' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return { ok: false, reason: 'bad_chars' };
  if (t.length > MAX_TEXT_SEED) return { ok: false, reason: 'too_long' };
  return { ok: true, seed: t };
}

const VALID_MODES = ['static', 'adaptive', 'random', 'adaptive2', 'counter']; // random, adaptive2 and counter are URL only

/**
 * @param {string|null|undefined} text the ?mode= value
 * @returns {{ok: boolean, mode: 'static'|'adaptive'|'random'|'adaptive2'|'counter'}} absent or empty is Static; an unknown value falls back to Static with ok false
 */
export function parseModeParam(text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (t === '') return { ok: true, mode: 'static' };
  return VALID_MODES.includes(t) ? { ok: true, mode: t } : { ok: false, mode: 'static' };
}

/** @param {URLSearchParams} params @returns {boolean} the menu shows unless the URL says play or debug */
export function shouldShowMenu(params) {
  return !(params.has('play') || params.has('debug'));
}

/** URL that starts a game: sets seed, mode, waves and play=1, keeping every other parameter and the hash. */
export function buildPlayUrl(href, { seed, mode, waves }) {
  const url = new URL(href);
  url.searchParams.set('seed', String(seed));
  url.searchParams.set('mode', String(mode));
  url.searchParams.set('waves', String(waves));
  url.searchParams.set('play', '1');
  return url.toString();
}

/** URL that returns to the menu: drops play and the debug parameters, keeps seed, mode, waves and the hash. */
export function buildMenuUrl(href) {
  const url = new URL(href);
  for (const k of RESET_PARAMS) url.searchParams.delete(k);
  return url.toString();
}
