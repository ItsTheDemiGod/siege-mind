// Pure view models for the wave banner and the incoming-wave preview.
import { config } from '../data/config.js';
import { compositionItems } from './compositionItems.js';

const hpLine = (hpMult) => `Enemy HP ×${hpMult.toFixed(1)}`;

/**
 * @param {{wave: number, name: string|null, fixed: boolean, composition: Record<string, number>, hpMult: number}} started WAVE_STARTED payload
 * @param {number} totalWaves
 * @returns {{kicker: string, title: string, fixed: boolean, final: boolean, items: object[], hpLine: string, seconds: number}}
 */
export function describeBanner(started, totalWaves) {
  const final = started.wave === totalWaves;
  const kicker = final ? 'FINAL WAVE' : started.fixed ? `SET PIECE · WAVE ${started.wave} / ${totalWaves}` : `WAVE ${started.wave} / ${totalWaves}`;
  const seconds = final ? config.ui.bannerFinalSeconds : started.fixed ? config.ui.bannerFixedSeconds : config.ui.bannerSeconds;
  return {
    kicker, title: started.name ?? `Wave ${started.wave}`, fixed: started.fixed, final,
    items: compositionItems(started.composition), hpLine: hpLine(started.hpMult), seconds,
  };
}

/**
 * @param {{wave: number, name: string|null, fixed: boolean, isFinal: boolean, hpMult: number, items: {type: string, units: number}[]}|null} preview getWavePreview result
 * @param {number} totalWaves
 * @returns {{title: string, final: boolean, fixed: boolean, items: object[], hpLine: string}|null}
 */
export function describePreview(preview, totalWaves) {
  if (!preview) return null;
  const units = Object.fromEntries(preview.items.map((i) => [i.type, i.units]));
  return {
    title: preview.name ? `Wave ${preview.wave} · ${preview.name}` : `Wave ${preview.wave}`,
    final: preview.wave === totalWaves,
    fixed: preview.fixed,
    items: compositionItems(units),
    hpLine: hpLine(preview.hpMult),
  };
}
