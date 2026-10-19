// Pure: everything the end screen shows, derived from a finished game.
import { endScreenRows } from './format.js';
import { buildWaveStrip, endSubtitle } from './waveSummary.js';

/**
 * @param {object} game finished game (result, lives, totalWaves, waveLog, stats, waves.current)
 * @returns {{victory: boolean, title: string, subtitle: string, rows: {label: string, value: string}[], cells: object[], toughest: string, stripLabel: string}}
 */
export function buildEndModel(game) {
  const victory = game.result === 'won';
  const strip = buildWaveStrip(game.waveLog, game.totalWaves);
  const t = strip.toughest;
  const toughest = t
    ? `Toughest wave: ${t.wave}${t.name ? ` (${t.name})` : ''}, ${t.livesLost} ${t.livesLost === 1 ? 'life' : 'lives'} lost`
    : 'No lives lost';
  const reached = strip.cells.filter((c) => c.status !== 'unreached').length;
  return {
    victory,
    title: victory ? 'VICTORY' : 'DEFEAT',
    subtitle: endSubtitle(game.result, game),
    rows: endScreenRows(game),
    cells: strip.cells,
    toughest,
    stripLabel: `Lives lost per wave, ${reached} of ${game.totalWaves} waves reached. ${toughest}.`,
  };
}
