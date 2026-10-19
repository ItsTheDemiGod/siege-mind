// Headless full-game playthrough with a bot. CLI: npm run playthrough -- --bot=balanced --seed=1
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { config } from '../src/data/config.js';
import { STATIC_THREAT, hpMultiplierForWave } from '../src/data/waves.js';
import { createGame, stepGame } from '../src/sim/game.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { getBot } from './bots.js';
import { attachTelemetry } from '../src/sim/telemetry.js';
import { validateRun } from '../src/sim/telemetrySchema.js';
import { runToJson, wavesCsv, waveTypesCsv, enemiesCsv, towersCsv } from '../src/sim/telemetryExport.js';

const ACT_EVERY_TICKS = 120; // while a wave is running

/**
 * Play one full static-mode game.
 * @param {{seed?: number, bot: {act: Function}, maxTicks?: number, totalWaves?: 15|30, gameOptions?: object, telemetry?: 'full'|'summary'|false, meta?: object}} o
 * @returns {{run?: object, result: 'won'|'lost'|'timeout', wave: number, lives: number, ticks: number, seconds: number, minutes: number, stats: object, perWave: object[]}}
 */
export function playGame({ seed = 1, bot, maxTicks = 600000, totalWaves = config.game.totalWaves, gameOptions = {}, telemetry = false, meta = {} }) {
  const game = createGame({ seed, debugSpawnEveryTicks: 0, totalWaves, ...gameOptions });
  const collector = telemetry ? attachTelemetry(game, { detail: telemetry, meta }) : null;
  const perWave = [];
  let waveStartTick = 0;
  game.events.on(EVENT_TYPES.WAVE_STARTED, (ev) => { waveStartTick = ev.tick; });
  game.events.on(EVENT_TYPES.WAVE_ENDED, (ev) => {
    perWave.push({
      wave: ev.wave, threat: STATIC_THREAT[ev.wave - 1], hpMult: hpMultiplierForWave(ev.wave), seconds: (ev.tick - waveStartTick) * config.sim.stepSeconds, kills: ev.kills, leaks: ev.leaks, livesLost: ev.livesLost,
      livesAfter: ev.lives, gold: game.gold, towers: game.towers.length,
    });
  });
  while (!game.over && game.tick < maxTicks) {
    const phase = game.waves.phase;
    if (phase === 'prep' || phase === 'intermission' || game.tick % ACT_EVERY_TICKS === 0) bot.act(game);
    stepGame(game);
  }
  return {
    ...(collector ? { run: collector.getRun() } : {}),
    result: game.over ? game.result : 'timeout', wave: game.waves.current, lives: game.lives, ticks: game.tick,
    seconds: game.tick * config.sim.stepSeconds, minutes: (game.tick * config.sim.stepSeconds) / 60, stats: { ...game.stats }, perWave,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name, def) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${def}`).split('=')[1];
  const botName = arg('bot', 'balanced');
  const seed = Number(arg('seed', 1));
  const waves = Number(arg('waves', config.game.totalWaves));
  const telemetry = arg('telemetry', '');
  if (telemetry && !config.telemetry.allowedDetails.includes(telemetry)) { console.error('--telemetry must be full or summary'); process.exit(2); }
  const outDir = arg('out', 'experiments/results');
  const t0 = performance.now();
  const r = playGame({ seed, totalWaves: waves, bot: getBot(botName), telemetry: telemetry || false, meta: { app: 'siege-mind-cli', bot: botName } });
  const ms = performance.now() - t0;
  console.log(`bot=${botName} seed=${seed} mode=static length=${waves === 15 ? 'Quick' : 'Full'} (${waves} waves)`);
  console.log('wave  threat  hpMult  seconds  kills  leaks  livesLost  livesAfter   gold  towers');
  for (const w of r.perWave) {
    console.log([w.wave, w.threat, w.hpMult.toFixed(2), w.seconds.toFixed(0), w.kills, w.leaks, w.livesLost, w.livesAfter, Math.round(w.gold), w.towers].map((v, i) => String(v).padStart([4, 7, 8, 9, 7, 7, 11, 11, 7, 8][i])).join(''));
  }
  console.log(`result=${r.result} wave=${r.wave} lives=${r.lives} game time=${r.minutes.toFixed(1)} min (${r.seconds.toFixed(0)}s) ticks=${r.ticks} (${(r.ticks / (ms / 1000)).toFixed(0)} steps/s, wall ${ms.toFixed(0)} ms)`);
  console.log(JSON.stringify(r.stats));
  if (r.run) process.exitCode = writeTelemetry(r.run, outDir, `${botName}_seed${seed}_static_w${waves}`.replace(/[^A-Za-z0-9._-]/g, '-'));
}

/** Write the JSON and CSV files of a run into dir and validate it. Returns the process exit code. */
function writeTelemetry(run, dir, base) {
  mkdirSync(dir, { recursive: true });
  const files = { '.json': runToJson(run), '.waves.csv': wavesCsv(run), '.wavetypes.csv': waveTypesCsv(run), '.towers.csv': towersCsv(run) };
  if (run.enemies) files['.enemies.csv'] = enemiesCsv(run);
  for (const [ext, text] of Object.entries(files)) {
    const path = resolve(dir, base + ext);
    writeFileSync(path, text);
    console.log(`wrote ${path} (${statSync(path).size} bytes)`);
  }
  const problems = validateRun(run);
  console.log(problems.length === 0 ? 'telemetry: valid' : `telemetry: INVALID${problems.map((p) => `
  ${p}`).join('')}`);
  return problems.length === 0 ? 0 : 1;
}
