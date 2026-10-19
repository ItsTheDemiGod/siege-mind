// Constants of the procedural audio. They live here (not in src/data) because the study freezes src/data.

export const audioConfig = Object.freeze({
  defaults: Object.freeze({ muted: false, masterVolume: 0.6, sfxVolume: 0.8 }),
  taperExponent: 2, // documented: gain = volume * volume (plain multiplication, no pow)
  maxVoices: 24,
  masterGain: 0.9,
  compressor: Object.freeze({ threshold: -18, knee: 12, ratio: 4, attack: 0.003, release: 0.2 }),
  rampSeconds: 0.03,
  jitterFraction: 0.03,
  unlockEvents: Object.freeze(['pointerdown', 'keydown', 'touchstart']),
  minGapMsByCategory: Object.freeze({ ui: 40, fire: 35, impact: 45, enemy: 30, wave: 0, game: 0 }),
});
