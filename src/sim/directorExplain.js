// Human-readable lines for a Director decision (pure). See docs/DIRECTOR.md.
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';

const MIN_VISIBLE_TILT = 0.1; // |tilt - 1| below this is not worth a line
const MAX_TYPE_LINES = 3;

const REASON_TEXT = Object.freeze({
  'static-early': (wave) => `Wave ${wave} is too early to adapt: the Director only starts adapting later, so this wave is the static script.`,
  'static-intro': (wave) => `Wave ${wave} introduces a new enemy type, so it is the static script.`,
  'static-fixed': (wave) => `Wave ${wave} is a fixed set piece, so it is the static script.`,
  'cold-start': () => 'No evidence yet: the Director has not seen enough to change anything, so this wave is the static script.',
  random: () => 'Random control: the tilts are random and ignore what the Director observed.',
});

/**
 * @param {{wave: number, reason: string, tilt: Record<string, number>, observed: Record<string, {units: number, leaked: number, reward: number, advantage: number}>}} decision
 * @param {Record<string, string>} [names] display names per enemy type @param {number|null} [average] wave-average reward of the observed wave
 * @returns {string[]}
 */
export function explainDecision(decision, names = Object.fromEntries(ENEMY_ORDER.map((t) => [t, ENEMIES[t].name])), average = null) {
  if (decision.reason !== 'adapted') return [REASON_TEXT[decision.reason](decision.wave)];
  const moved = ENEMY_ORDER
    .filter((t) => Math.abs(decision.tilt[t] - 1) >= MIN_VISIBLE_TILT)
    .sort((a, b) => Math.abs(decision.tilt[b] - 1) - Math.abs(decision.tilt[a] - 1))
    .slice(0, MAX_TYPE_LINES);
  if (moved.length === 0) return ['The Director adapted only slightly this wave: every tilt is within 0.1 of the static script.'];
  return moved.map((t) => {
    const o = decision.observed[t];
    const ratio = average !== null && average > 0 ? o.reward / average : 1 + o.advantage;
    return `${names[t]}: weight x${decision.tilt[t].toFixed(2)}, earned ${ratio.toFixed(1)}x the wave-average reward last wave (${o.leaked} of ${o.units} leaked)`;
  });
}
