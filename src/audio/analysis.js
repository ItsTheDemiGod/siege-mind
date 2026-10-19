// Offline sample analysis (pure): the automated quality check of every catalogue sound (peak, loudness, clipping, DC offset, leading silence).

/** A sample quieter than this counts as silence at the start of a sound. */
export const SILENCE_LEVEL = 0.001;
export const DEFAULT_LIMITS = Object.freeze({ maxPeak: 0.95, minRms: 0.002, maxDc: 0.05, maxLeadingSilenceMs: 25 });

/** @param {ArrayLike<number>} samples @param {number} sampleRate @returns {{peak: number, rms: number, clippedSamples: number, dcOffset: number, leadingSilenceMs: number, durationMs: number}} */
export function analyzeSamples(samples, sampleRate) {
  const n = samples.length;
  let peak = 0; let sumSq = 0; let sum = 0; let clipped = 0; let first = -1;
  for (let i = 0; i < n; i++) {
    const x = samples[i];
    const a = x < 0 ? -x : x;
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    if (first < 0 && a > SILENCE_LEVEL) first = i;
    sumSq += x * x;
    sum += x;
  }
  return {
    peak, rms: n ? Math.sqrt(sumSq / n) : 0, clippedSamples: clipped, dcOffset: n ? sum / n : 0,
    leadingSilenceMs: (first < 0 ? n : first) / sampleRate * 1000, durationMs: n / sampleRate * 1000,
  };
}

/** @returns {{ok: boolean, problems: string[]}} */
export function soundVerdict(a, limits = DEFAULT_LIMITS) {
  const problems = [];
  if (a.peak > limits.maxPeak) problems.push('peak too high');
  if (a.rms < limits.minRms) problems.push('too quiet');
  if (Math.abs(a.dcOffset) > limits.maxDc) problems.push('DC offset');
  if (a.leadingSilenceMs > limits.maxLeadingSilenceMs) problems.push('leading silence');
  return { ok: problems.length === 0, problems };
}
