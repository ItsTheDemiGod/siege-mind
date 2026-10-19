// Pure: download file names and MIME types for run data.

const EXTENSIONS = Object.freeze({
  json: '.json', 'waves-csv': '.waves.csv', 'wavetypes-csv': '.wavetypes.csv', 'towers-csv': '.towers.csv', 'enemies-csv': '.enemies.csv',
});

/** @param {string} kind 'json' | 'waves-csv' | 'wavetypes-csv' | 'towers-csv' | 'enemies-csv' @returns {string} */
export function mimeFor(kind) {
  if (!(kind in EXTENSIONS)) throw new RangeError(`unknown export kind: ${String(kind)}`);
  return kind === 'json' ? 'application/json' : 'text/csv';
}

const safe = (text) => Array.from(String(text), (c) => (/[A-Za-z0-9._-]/.test(c) ? c : '-')).join('');

/**
 * @param {{meta: {seed: *, mode: string, totalWaves: number}, result: {result: string|null, wave: number}}} run
 * @param {string} kind see mimeFor
 * @returns {string} e.g. siege-mind_seed-1_static_quick_won-w15.json or siege-mind_seed-9_static_full_inprogress-w9.waves.csv
 */
export function exportFilename(run, kind) {
  const ext = EXTENSIONS[kind];
  if (ext === undefined) throw new RangeError(`unknown export kind: ${String(kind)}`);
  const { seed, mode, totalWaves } = run.meta;
  const length = totalWaves === 15 ? 'quick' : totalWaves === 30 ? 'full' : `w${totalWaves}`;
  const status = run.result.result ?? 'inprogress';
  return `siege-mind_seed-${safe(seed)}_${safe(mode)}_${length}_${status}-w${run.result.wave}${ext}`;
}
