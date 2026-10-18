// Tunable numbers: simulation, world, view, debug (economy and Director values arrive in later phases).
export const config = Object.freeze({
  sim: Object.freeze({
    stepSeconds: 1 / 60,
    speeds: Object.freeze([1, 2, 3]),
    maxFrameSeconds: 0.25,
    maxStepsPerFrame: 12,
  }),
  world: Object.freeze({
    tileSize: 64,
    cols: 20,
    rows: 10,
  }),
  view: Object.freeze({
    width: 1280,
    height: 720,
    hudHeight: 80,
    maxDpr: 2,
    maxBackingPixels: 3686400, // 2560x1440
  }),
  game: Object.freeze({
    startGold: 150,
    startLives: 20,
    totalWaves: 30,
  }),
  quality: Object.freeze({
    low: Object.freeze({ name: 'low', particleCap: 300, floatTextCap: 16, ambientMotes: 0, maxDpr: 1, pathPulseSpacing: 192, glow: false }),
    medium: Object.freeze({ name: 'medium', particleCap: 800, floatTextCap: 32, ambientMotes: 24, maxDpr: 1.5, pathPulseSpacing: 128, glow: true }),
    high: Object.freeze({ name: 'high', particleCap: 2000, floatTextCap: 64, ambientMotes: 64, maxDpr: 2, pathPulseSpacing: 96, glow: true }),
  }),
  autoDowngrade: Object.freeze({
    thresholdFps: 45,
    sustainSeconds: 3,
    cooldownSeconds: 10,
    ignoreFrameSeconds: 0.25,
  }),
  ui: Object.freeze({
    durFast: 0.12,
    durNormal: 0.18,
    durSlow: 0.25,
    tooltipDelay: 0.25,
  }),
  combat: Object.freeze({
    minArmorDamageFraction: 0.2,
    killEpsilon: 1e-6,
    dotEventTicks: 15,
    maxEnemies: 600,
  }),
  statuses: Object.freeze({
    slowMinFactor: 0.2,
    poisonMaxStacks: 5,
  }),
  path: Object.freeze({
    cornerBlendUnits: 40,
  }),
  enemies: Object.freeze({
    laneMax: 10, // lane range = laneMax - radius * 0.3
  }),
  fx: Object.freeze({
    spawnScaleSeconds: 0.25,
    hitFlashSeconds: 0.08,
    spawnRingSeconds: 0.35,
    killBurstBase: 6,
    killBurstPerRadius: 0.8,
    damageNumberMinInterval: 0.15,
  }),
  debug: Object.freeze({
    clickEffects: true,
    autoSpawnEveryTicks: 90, // TEMPORARY (Phase 2): placeholder spawner, 0 = off; replaced by the wave runner in Phase 4
    tools: true,
    showHud: true,
  }),
});
