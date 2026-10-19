// The sound catalogue: every sound is a few oscillator / filtered-noise layers described as plain data (rendered by synth.js on any audio context).
// Layer: { kind: 'osc', wave, freq, freqEnd?, at, attack, decay, gain, vibrato?: { rate, depth } } or { kind: 'noise', filter: { type, freq, freqEnd?, q }, at, attack, decay, gain }.
// The per-sound `gain` scales all layers; layer gains times it stay below 0.9 so a single sound never clips.

const osc = (wave, freq, freqEnd, at, attack, decay, gain, vibrato) => Object.freeze({ kind: 'osc', wave, freq, ...(freqEnd ? { freqEnd } : {}), at, attack, decay, gain, ...(vibrato ? { vibrato: Object.freeze(vibrato) } : {}) });
const noise = (type, freq, freqEnd, q, at, attack, decay, gain) => Object.freeze({ kind: 'noise', filter: Object.freeze({ type, freq, ...(freqEnd ? { freqEnd } : {}), q }), at, attack, decay, gain });
const sound = (id, category, priority, minIntervalMs, maxVoices, gain, duration, layers) => [id, Object.freeze({ id, category, priority, minIntervalMs, maxVoices, gain, duration, layers: Object.freeze(layers) })];

export const SOUNDS = Object.freeze(Object.fromEntries([
  // ui and build
  sound('uiClick', 'ui', 1, 30, 2, 0.5, 0.06, [osc('triangle', 1400, 900, 0, 0.002, 0.05, 0.9)]),
  sound('towerSelect', 'ui', 1, 60, 2, 0.5, 0.1, [osc('sine', 660, 880, 0, 0.004, 0.08, 0.9)]),
  sound('uiDeny', 'ui', 2, 120, 1, 0.55, 0.22, [osc('square', 150, 0, 0, 0.005, 0.08, 0.7), osc('square', 120, 0, 0.1, 0.005, 0.1, 0.7)]),
  sound('pauseOn', 'ui', 2, 80, 1, 0.5, 0.18, [osc('sine', 520, 300, 0, 0.005, 0.16, 0.9)]),
  sound('pauseOff', 'ui', 2, 80, 1, 0.5, 0.18, [osc('sine', 300, 520, 0, 0.005, 0.16, 0.9)]),
  sound('speedChange', 'ui', 1, 60, 1, 0.45, 0.09, [osc('triangle', 800, 1000, 0, 0.003, 0.08, 0.9)]),
  sound('towerPlace', 'ui', 2, 60, 2, 0.6, 0.25, [osc('sine', 440, 0, 0, 0.004, 0.1, 0.8), osc('sine', 660, 0, 0.07, 0.004, 0.16, 0.8)]),
  sound('towerUpgrade', 'ui', 2, 80, 2, 0.55, 0.45, [osc('sine', 523, 0, 0, 0.004, 0.2, 0.6), osc('sine', 659, 0, 0.08, 0.004, 0.2, 0.6), osc('sine', 784, 0, 0.16, 0.004, 0.28, 0.6)]),
  sound('towerSell', 'ui', 2, 80, 2, 0.55, 0.3, [osc('sine', 880, 330, 0, 0.005, 0.2, 0.7), osc('sine', 1760, 0, 0.2, 0.002, 0.06, 0.4)]),
  // one fire sound per tower, different in timbre, pitch and length
  sound('fireLance', 'fire', 1, 40, 4, 0.5, 0.15, [osc('triangle', 1800, 500, 0, 0.002, 0.12, 0.8)]),
  sound('fireMortar', 'fire', 1, 90, 3, 0.8, 0.35, [osc('sine', 120, 50, 0, 0.004, 0.3, 1), noise('lowpass', 400, 0, 0.7, 0, 0.003, 0.12, 0.6)]),
  sound('fireFrost', 'fire', 1, 120, 3, 0.45, 0.45, [osc('sine', 1320, 0, 0, 0.01, 0.3, 0.6), osc('sine', 1760, 0, 0.09, 0.01, 0.3, 0.5)]),
  sound('firePoison', 'fire', 1, 70, 3, 0.5, 0.25, [osc('sine', 300, 520, 0, 0.01, 0.12, 0.7, { rate: 18, depth: 40 }), osc('sine', 360, 600, 0.1, 0.01, 0.12, 0.7, { rate: 18, depth: 40 })]),
  sound('fireSniper', 'fire', 2, 150, 2, 0.75, 0.22, [noise('highpass', 2500, 0, 0.7, 0, 0.001, 0.06, 0.9), osc('sine', 1400, 200, 0, 0.001, 0.18, 0.6)]),
  // impacts
  sound('impactShell', 'impact', 2, 60, 3, 0.8, 0.22, [noise('lowpass', 600, 200, 0.7, 0, 0.002, 0.2, 1), osc('sine', 90, 40, 0, 0.002, 0.2, 0.6)]),
  sound('impactCloud', 'impact', 1, 80, 2, 0.45, 0.18, [noise('bandpass', 900, 0, 1, 0, 0.01, 0.15, 0.9)]),
  sound('impactSpark', 'impact', 1, 40, 3, 0.3, 0.05, [osc('sine', 2200, 0, 0, 0.001, 0.03, 0.9)]),
  // enemies
  sound('enemySpawn', 'enemy', 1, 60, 3, 0.2, 0.08, [osc('sine', 500, 700, 0, 0.005, 0.06, 0.9)]),
  sound('killSmall', 'enemy', 1, 30, 4, 0.4, 0.09, [osc('sine', 900, 600, 0, 0.002, 0.07, 0.9)]),
  sound('killMedium', 'enemy', 1, 40, 4, 0.5, 0.15, [osc('sine', 600, 320, 0, 0.002, 0.12, 0.8), osc('triangle', 1200, 640, 0, 0.002, 0.06, 0.3)]),
  sound('killLarge', 'enemy', 2, 60, 3, 0.6, 0.25, [osc('sine', 360, 160, 0, 0.003, 0.2, 0.8), noise('lowpass', 800, 0, 0.7, 0, 0.003, 0.1, 0.5)]),
  sound('shieldedKill', 'enemy', 2, 60, 3, 0.65, 0.3, [osc('sine', 220, 90, 0, 0.003, 0.18, 0.8), noise('bandpass', 1800, 0, 1.2, 0.05, 0.003, 0.12, 0.6)]),
  // waves and game
  sound('waveStart', 'wave', 2, 0, 1, 0.4, 1, [osc('sawtooth', 196, 0, 0, 0.03, 0.5, 0.5), osc('sawtooth', 262, 0, 0.35, 0.03, 0.6, 0.5)]),
  sound('waveClear', 'wave', 2, 0, 1, 0.5, 0.8, [osc('triangle', 392, 0, 0, 0.01, 0.4, 0.6), osc('triangle', 494, 0, 0.12, 0.01, 0.4, 0.6), osc('triangle', 587, 0, 0.24, 0.01, 0.5, 0.6)]),
  sound('directorSweep', 'wave', 2, 0, 1, 0.5, 0.85, [noise('bandpass', 400, 3000, 4, 0, 0.3, 0.5, 0.8), osc('sine', 600, 1800, 0, 0.3, 0.5, 0.2)]),
  sound('leak', 'game', 3, 150, 2, 0.8, 0.5, [osc('sine', 110, 60, 0, 0.005, 0.3, 0.9), osc('sawtooth', 233, 0, 0, 0.01, 0.4, 0.25)]),
  sound('lifeLost', 'game', 3, 150, 2, 0.8, 0.7, [osc('sine', 80, 40, 0, 0.005, 0.5, 0.9), osc('sawtooth', 150, 0, 0, 0.01, 0.5, 0.2), osc('sawtooth', 158, 0, 0, 0.01, 0.5, 0.2), noise('lowpass', 300, 0, 0.7, 0, 0.005, 0.2, 0.4)]),
  sound('victory', 'game', 3, 0, 1, 0.6, 1.8, [osc('triangle', 523, 0, 0, 0.01, 0.4, 0.6), osc('triangle', 659, 0, 0.2, 0.01, 0.4, 0.6), osc('triangle', 784, 0, 0.4, 0.01, 0.5, 0.6), osc('triangle', 1047, 0, 0.65, 0.01, 1.1, 0.7)]),
  sound('defeat', 'game', 3, 0, 1, 0.6, 1.8, [osc('triangle', 440, 0, 0, 0.01, 0.45, 0.6), osc('triangle', 392, 0, 0.3, 0.01, 0.45, 0.6), osc('triangle', 349, 0, 0.6, 0.01, 0.5, 0.6), osc('triangle', 311, 0, 0.9, 0.01, 0.85, 0.7)]),
]));

/** Pitch multiplier of a kill sound by enemy type: larger enemies sound lower. */
export const KILL_PITCH = Object.freeze({ swarmling: 1.4, fastRunner: 1.2, regenerator: 1.1, armoredGrunt: 1, shieldedBruiser: 0.8 });
/** Fire sound by tower type. */
export const FIRE_SOUND = Object.freeze({ lance: 'fireLance', mortar: 'fireMortar', frost: 'fireFrost', poison: 'firePoison', sniper: 'fireSniper' });
/** Impact sound by impact kind (eventMap decides the kind). */
export const IMPACT_SOUND = Object.freeze({ shell: 'impactShell', cloud: 'impactCloud', spark: 'impactSpark' });
