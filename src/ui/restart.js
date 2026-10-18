// Pure: the URL to reload for a retry or a new seed (every other parameter is preserved).

/**
 * @param {string} href current page URL @param {{seed: number|string}} o
 * @returns {string}
 */
export function buildRestartUrl(href, { seed }) {
  const url = new URL(href);
  url.searchParams.set('seed', String(seed)); // replaces in place when present, appends otherwise
  return url.toString();
}
