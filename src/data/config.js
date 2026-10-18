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
  }),
  debug: Object.freeze({
    walkerSpawnEveryTicks: 60,
    walkerBaseSpeed: 96, // world units per second
    walkerSpeedJitter: 0.2,
    showHud: true,
  }),
});
