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
    mode: 'static',
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
    towerPanelRefreshSeconds: 0.25,
    waveControlWidth: 300,
    waveControlHeight: 64,
    waveControlBottomMargin: 16,
    endScreenWidth: 420,
    towerPanelWidth: 300,
    towerPanelHeight: 176,
    towerPanelMargin: 16,
    towerClearRadius: 26, // largest tower body radius: keeps the panel clear of the selected tower
  }),
  economy: Object.freeze({
    sellRefundFraction: 0.7,
    waveClearBonusBase: 13,
    waveClearBonusPerWave: 6,
    towerCostGrowth: 0.03, // price multiplier is 1 + towerCostGrowth * towersOwned
  }),
  towers: Object.freeze({
    maxLevel: 2,
    maxTowers: 60,
  }),
  waves: Object.freeze({
    intermissionSeconds: 12,
    autoStartNext: true,
    autoStartFirst: false,
    budgetScale: 1,
    budgetBase: 40,
    budgetLinear: 22,
    budgetQuad: 1.6,
    windowBaseSeconds: 12,
    windowPerWave: 0.8,
    windowMaxSeconds: 30,
    startStaggerSeconds: 0.8,
    minGapSeconds: Object.freeze({ armoredGrunt: 0.4, swarmling: 2.0, fastRunner: 1.0, regenerator: 0.8, shieldedBruiser: 1.0 }),
    budgetTolerancePct: 0.05,
    budgetToleranceMin: 12,
    hpCurve: 'polynomial', // 'exponential' (compounds hpGrowthPerWave per wave) or 'polynomial' (1 + hpLinear*d + hpQuad*d^2, d = wave - 1)
    hpGrowthPerWave: 0.07,
    hpLinear: 0.325,
    hpQuad: 0.02,
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
    decalCapacity: 12, // mortar scorch marks
    beamCapacity: 16, // sniper beams
    ghostCapacity: 24, // sell-dissolve ghosts
    statusTintAmount: 0.25, // body mixed this far toward the slow/poison color
    shellScaleGain: 0.35, // shell grows this much (fraction) at the apex of its visual arc
    shellShadowShrink: 0.5, // ground shadow shrinks this much (fraction) at the apex
  }),
  debug: Object.freeze({
    clickEffects: true,
    enabledByUrl: true, // documentation only: the switch is the ?debug=1 URL parameter
    autoSpawnEveryTicks: 0, // debug-only random spawner (off by default; ?debug=1&spawn=N turns it on); waves come from the wave runner
    tools: true,
    showHud: false, // the debug panel is hidden by default; the backquote key toggles it
  }),
});
