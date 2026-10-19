// Pure: the end-screen wave strip and texts, from game.waveLog.

const MIN_HEIGHT = 0.12; // any cell that lost lives or failed stays visible

/**
 * @param {{wave: number, name: string|null, complete: boolean, livesLost: number}[]} waveLog @param {number} totalWaves
 * @returns {{cells: {wave: number, name: string|null, status: 'clean'|'hurt'|'failed'|'unreached', livesLost: number, heightFraction: number}[],
 *   toughest: {wave: number, name: string|null, livesLost: number}|null, totalLivesLost: number}}
 */
export function buildWaveStrip(waveLog, totalWaves) {
  const maxLost = waveLog.reduce((m, e) => Math.max(m, e.livesLost), 0);
  let toughest = null;
  let totalLivesLost = 0;
  const cells = [];
  for (let wave = 1; wave <= totalWaves; wave++) {
    const e = waveLog.find((x) => x.wave === wave);
    if (!e) { cells.push({ wave, name: null, status: 'unreached', livesLost: 0, heightFraction: 0 }); continue; }
    const status = !e.complete ? 'failed' : e.livesLost > 0 ? 'hurt' : 'clean';
    let heightFraction = maxLost > 0 ? e.livesLost / maxLost : 0;
    if (e.livesLost > 0 || status === 'failed') heightFraction = Math.max(MIN_HEIGHT, heightFraction);
    cells.push({ wave, name: e.name, status, livesLost: e.livesLost, heightFraction });
    totalLivesLost += e.livesLost;
    if (e.livesLost > 0 && (!toughest || e.livesLost > toughest.livesLost)) toughest = { wave, name: e.name, livesLost: e.livesLost };
  }
  return { cells, toughest, totalLivesLost };
}

/** @param {'won'|'lost'} result @param {{totalWaves: number, lives: number, waves: {current: number}}} game @returns {string} */
export function endSubtitle(result, game) {
  return result === 'won'
    ? `All ${game.totalWaves} waves cleared with ${game.lives} ${game.lives === 1 ? 'life' : 'lives'} left`
    : `The core fell during wave ${game.waves.current}`;
}

/** @param {number} totalWaves @returns {string} */
export function lengthLabel(totalWaves) {
  if (totalWaves === 15) return 'Quick (15 waves)';
  if (totalWaves === 30) return 'Full (30 waves)';
  return `${totalWaves} waves`;
}
