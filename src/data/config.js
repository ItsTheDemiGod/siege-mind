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
    totalWaves: 30, // the Full game and the research setting
    allowedTotals: Object.freeze([15, 30]),
    quickTotal: 15,
    mode: 'static',
  }),
  director: Object.freeze({
    firstAdaptiveWave: 5, // waves before this stay static
    rewardExponent: 2, // reward = leakDamage * meanProgress^k / threatCost
    alpha: 0.5, // score = (1 - alpha) * score + alpha * advantage
    decay: 0.85, // scores of types that were not observed fade by this factor per wave
    minThreatShare: 0.05, // a type must have spent this share of the wave threat to be scored
    advClipHigh: 2, // advantage is clamped to [-1, advClipHigh]
    beta: 1, // tilt = 1 + beta * score
    tiltMax: 3, // tilt is clamped to [1 / tiltMax, tiltMax]
    absentFloorShare: 0.05, // base share of an unlocked type that the template leaves out
    historyLimit: 40, // observation entries kept in the director state
  }),
  // Phase 9A-2a research arms (initial values, not tuned). 'adaptive2' = Director v2: rewards are divided by a static baseline (src/data/directorBaseline.js)
  // and each type's advantage is shrunk by units / (units + shrinkK). Same keys as `director` where they mean the same thing.
  directorV2: Object.freeze({
    rewardExponent: 2, alpha: 0.5, decay: 0.85, minThreatShare: 0.05, advClipHigh: 2, beta: 1, tiltMax: 3, absentFloorShare: 0.05, historyLimit: 40,
    firstAdaptiveWave: 5,
    shrinkK: 4, // an advantage measured on `units` units counts units / (units + shrinkK)
    baselineWindow: 1, // waves on each side pooled into one baseline entry (used by npm run baseline)
    baselineFloorFraction: 0.1, // the baseline of a type/wave never falls below this fraction of the type's fallback baseline
  }),
  // 'counter' = informed counter arm: reads the tower loadout (a ceiling, not a fair competitor).
  counter: Object.freeze({
    firstAdaptiveWave: 5, gain: 1.5, tiltMax: 3, absentFloorShare: 0.05,
    levelWeight: 0.5, // a tower weighs 1 + levelWeight * level
  }),
  // 'prior' = fixed control arm: weights from the static baseline only (enemy durability), no learning, no reading of the defense.
  prior: Object.freeze({ firstAdaptiveWave: 5, beta: 1, tiltMax: 3, advClipHigh: 2, absentFloorShare: 0.05, baselineFloorFraction: 0.1 }),
  report: Object.freeze({
    directionRatio: 1.1, // a tilt at or above this (or at or below its inverse) shows a direction mark
    pushRatio: 1.15, // final tilt at or beyond this counts as "leaned on" / "backed off" in the report
    topDamageShare: 0.3, // a tower type with at least this share of the damage gets an insight
    maxInsights: 7, // rule 1 up to 2 lines, rule 2 up to 2, rules 3, 4 and 5 one each
    chartWidth: 680,
    chartHeight: 180,
    miniChartWidth: 272,
    miniChartHeight: 84,
  }),
  telemetry: Object.freeze({
    schemaVersion: 1,
    detail: 'full', // 'full' keeps one record per enemy; 'summary' keeps aggregates only
    allowedDetails: Object.freeze(['full', 'summary']),
    floatDigits: 6, // JSON
    csvFloatDigits: 4,
    maxEnemyRecords: 20000,
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
    bannerSeconds: 2.6,
    bannerFixedSeconds: 3.6,
    bannerFinalSeconds: 4.0,
    wavePreviewHeight: 44,
    wavePreviewWidth: 420,
    wavePreviewGap: 8,
    endScreenDelayLost: 1.6,
    endScreenDelayWon: 1.2,
    confirmWindowSeconds: 3,
    ringSize: 44,
    ringStroke: 4,
    menuWidth: 560,
    downloadButtonHeight: 32,
    waveControlWidth: 360,
    directorOverlayWidth: 300,
    directorOverlayMaxHeight: 420,
    directorOverlayMargin: 8,
    reportWidth: 760,
    reportMargin: 12,
    chartLineWidth: 2,
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
    coreSegments: 12,
    coreDamagedBelow: 0.67,
    coreCriticalBelow: 0.34,
    coreDestroySeconds: 1.8,
    coreVictorySeconds: 3.0,
    coreVictoryRingEverySeconds: 0.35,
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
