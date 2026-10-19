// Bootstrap: wires sim + render + ui. No game logic here.
import { config } from './data/config.js';
import { createGame, startGame, stepGame } from './sim/game.js';
import { attachTelemetry } from './sim/telemetry.js';
import { runToJson, wavesCsv } from './sim/telemetryExport.js';
import { exportFilename, mimeFor } from './ui/exportName.js';
import { downloadText } from './ui/downloadRun.js';
import { EVENT_TYPES } from './sim/events.js';
import { enemiesRemaining, getWaveCountdownSeconds } from './sim/waveRunner.js';
import { priceMultiplier } from './ui/trayState.js';
import { createStepper } from './sim/stepper.js';
import { computeFit, applyFit } from './render/fit.js';
import { createRenderer } from './render/renderer.js';
import { createQualityController } from './render/quality.js';
import { createRateMeter, createFrameStats } from './render/perf.js';
import { bindKeys } from './ui/keys.js';
import { createSettings } from './ui/settings.js';
import { createHud } from './ui/hud.js';
import { createTooltip } from './ui/tooltip.js';
import { createToaster } from './ui/toast.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { createDebugPanel } from './ui/debugPanel.js';
import { createDebugTools } from './ui/debugTools.js';
import { createBuildState } from './ui/buildState.js';
import { createBuildController } from './ui/buildController.js';
import { createBuildTray } from './ui/buildTray.js';
import { createTowerPanel } from './ui/towerPanel.js';
import { applyStress } from './ui/stress.js';
import { createWaveControl } from './ui/waveControl.js';
import { createEndScreen } from './ui/endScreen.js';
import { hpMultiplierForWave } from './data/waves.js';
import { createPauseState } from './ui/pauseState.js';
import { resolveEscape } from './ui/escapeResolver.js';
import { shouldShowMenu, buildMenuUrl, parseModeParam } from './ui/menuState.js';
import { buildRestartUrl } from './ui/restart.js';
import { createMainMenu } from './ui/mainMenu.js';
import { createHowToPlay } from './ui/howToPlay.js';
import { createPauseMenu } from './ui/pauseMenu.js';
import { createWaveBanner } from './ui/waveBanner.js';
import { createWavePreview } from './ui/wavePreview.js';
import { describeBanner } from './ui/bannerState.js';
import { formatDirectorLine } from './ui/format.js';

const { width, height } = config.view;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiRoot = document.getElementById('ui-root');
const params = new URLSearchParams(location.search);

// ?seed= integer or string (default: random 32-bit). ?spawn=N placeholder auto-spawner interval in ticks (0 = off).
// ?debug=1 unlocks the debug keys, click tools and the test effect; ?gold=N (debug only) overrides the starting gold.
const seedParam = params.get('seed');
const seed = seedParam === null ? crypto.getRandomValues(new Uint32Array(1))[0]
  : /^\d+$/.test(seedParam) ? Number(seedParam) : seedParam;
const spawnParam = Number.parseInt(params.get('spawn') ?? '', 10);
const debug = params.get('debug') === '1';
const stress = debug && params.get('stress') === '1'; // ?debug=1&stress=1: 40 towers and a spawn every 3 ticks
const STRESS_SPAWN_TICKS = 3;
const STRESS_GOLD = 1e6;
const debugSpawnEveryTicks = debug && Number.isInteger(spawnParam) && spawnParam >= 0 ? spawnParam : stress ? STRESS_SPAWN_TICKS : undefined; // debug-only
const modeResult = parseModeParam(params.get('mode')); // static | adaptive | random (the random control is URL only)
const waveParam = Number.parseInt(params.get('wave') ?? '', 10); // debug only: start at wave N
const wavesParam = params.get('waves'); // 15 (Quick) or 30 (Full); anything else falls back to Full with a notice
const wavesValid = wavesParam === null || config.game.allowedTotals.includes(Number(wavesParam));
const totalWaves = wavesParam !== null && wavesValid ? Number(wavesParam) : config.game.totalWaves;
const startWave = debug && Number.isInteger(waveParam) && waveParam >= 1 && waveParam <= totalWaves ? waveParam : undefined;
const menuOpenAtBoot = shouldShowMenu(params);
const livesParam = Number.parseInt(params.get('startlives') ?? '', 10); // debug only
const startLives = debug && Number.isInteger(livesParam) && livesParam >= 1 ? livesParam : undefined;
const goldParam = Number.parseInt(params.get('gold') ?? '', 10);
const startGold = stress ? STRESS_GOLD : debug && Number.isInteger(goldParam) && goldParam >= 0 ? goldParam : undefined;

let storage = null;
try { storage = window.localStorage; } catch { /* blocked storage: settings stay in memory */ }
const settings = createSettings({ storage, prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
const applyReduced = () => document.documentElement.classList.toggle('reduced-motion', settings.get('reducedMotion'));
applyReduced();

const game = createGame({ seed, mode: modeResult.mode, totalWaves, debugSpawnEveryTicks, startGold, startLives, startWave });
const telemetry = attachTelemetry(game, { meta: { app: 'siege-mind' } }); // observation only; before startGame so no event is missed
startGame(game);
const stressTowers = stress ? applyStress(game) : 0;
const stepper = createStepper();
const quality = createQualityController({ tier: settings.get('quality'), auto: settings.get('autoQuality') });
const buildState = createBuildState();
const renderer = createRenderer({ canvas, ctx, game, settings, quality, seed, buildState });

const state = { speed: 1, steps: 0 };
const pause = createPauseState();
const tickMeter = createRateMeter();
const frameStats = createFrameStats();
const toaster = createToaster({ root: uiRoot });
createTooltip({ root: uiRoot });
const debugPanel = createDebugPanel({ root: uiRoot, visible: config.debug.showHud });
const debugTools = debug && config.debug.tools ? createDebugTools({ game, fx: renderer.fx, toaster }) : null;
const reducedMotion = () => settings.get('reducedMotion');
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const EXPORTERS = { json: (run) => runToJson(run, { pretty: true }), 'waves-csv': wavesCsv };
let exportErrorLogged = false;
/** Download the current run as 'json' or 'waves-csv'. Only called from button handlers. */
const exportRun = (kind) => {
  try {
    const run = telemetry.getRun();
    downloadText(exportFilename(run, kind), EXPORTERS[kind](run), mimeFor(kind));
  } catch (e) {
    if (!exportErrorLogged) { exportErrorLogged = true; console.error('run export failed', e); }
    toaster.show('Could not export run data');
  }
};

let menu = null; let howTo = null; let pauseMenu = null; let endScreen = null; // assigned below; only read from event handlers
const panel = createSettingsPanel({ root: uiRoot, settings, pause });
const anyDialog = () => Boolean(menu.isOpen || howTo.isOpen || pauseMenu.isOpen || panel.isOpen || endScreen.isOpen);
const hud = createHud({
  root: uiRoot,
  handlers: { togglePause: () => { if (!anyDialog()) pause.toggleUser(); }, setSpeed: (n) => { state.speed = n; hud.setSpeed(n); }, openSettings: () => panel.open() },
});
hud.set({ gold: game.gold, lives: game.lives, wave: game.waves.current, waveTotal: game.totalWaves });
hud.setSpeed(state.speed);
game.events.on(EVENT_TYPES.GOLD_CHANGED, (ev) => hud.set({ gold: ev.gold }));
game.events.on(EVENT_TYPES.LIVES_CHANGED, (ev) => hud.set({ lives: ev.lives }));
game.events.on(EVENT_TYPES.WAVE_STARTED, (ev) => hud.set({ wave: ev.wave, waveTotal: ev.total }));
if (!modeResult.ok) toaster.show(`Unknown mode "${params.get('mode')}", using Static`);
if (!wavesValid) toaster.show('Unknown game length, using the full 30 waves');

const banner = createWaveBanner({ root: uiRoot, reducedMotion });
game.events.on(EVENT_TYPES.WAVE_STARTED, (ev) => banner.show(describeBanner(ev, game.totalWaves)));
game.events.on(EVENT_TYPES.GAME_OVER, () => banner.hide());
endScreen = createEndScreen({ root: uiRoot, game, newSeed: randomSeed, reducedMotion, onDownloadJson: () => exportRun('json'), onDownloadWaves: () => exportRun('waves-csv') });
const waveControl = createWaveControl({ root: uiRoot, game, toaster, reducedMotion });
createWavePreview({ root: uiRoot, game, controlRect: waveControl.rect });
howTo = createHowToPlay({ root: uiRoot, pause });
pauseMenu = createPauseMenu({
  root: uiRoot, pause, openSettings: () => panel.open(), openHowTo: () => howTo.open(), onDownload: () => exportRun('json'),
  onRestart: () => window.location.assign(buildRestartUrl(window.location.href, { seed: game.seed })),
  onQuit: () => window.location.assign(buildMenuUrl(window.location.href)),
});
menu = createMainMenu({ root: uiRoot, pause, params, randomSeed, openHowTo: () => howTo.open(), openSettings: () => panel.open() });
if (menuOpenAtBoot) menu.open();

const blocked = () => anyDialog() || game.over; // build and wave hotkeys are off while a dialog is open or the game ended
const build = createBuildController({ game, canvas, renderer, buildState, toaster, debugTools, isModalOpen: blocked });
createBuildTray({ bar: hud.bar, game, buildState, toaster });
createTowerPanel({ root: uiRoot, game, buildState, actions: build.actions });

function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, quality.params.maxDpr, config.view.maxDpr);
  const f = computeFit(window.innerWidth, window.innerHeight, width, height, dpr, config.view.maxDpr, config.view.maxBackingPixels);
  applyFit(canvas, ctx, f, width, height);
  renderer.resize(f);
  fitInfo.dpr = f.dpr;
  fitInfo.w = f.backingWidth;
  fitInfo.h = f.backingHeight;
}
const fitInfo = { dpr: 1, w: 0, h: 0 };
fit();
window.addEventListener('resize', fit);

quality.onChange((tier, reason) => {
  settings.set('quality', tier);
  fit();
  if (reason === 'auto') toaster.show(`Quality lowered to ${tier[0].toUpperCase()}${tier.slice(1)} (low FPS)`);
});
settings.subscribe((key, value) => {
  if (key === 'quality') quality.setTier(value);
  else if (key === 'autoQuality') quality.setAuto(value);
  else if (key === 'reducedMotion') applyReduced();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause.setUser(true); last = null; } // never auto-resume
});

const extraKeys = { ...build.extraKeys, Enter: () => { if (!blocked()) waveControl.start(); } };
if (debugTools) for (const [k, fn] of Object.entries(debugTools.extraKeys)) extraKeys[k] = (e) => { if (!anyDialog()) fn(e); };
bindKeys({
  togglePause: () => { if (!anyDialog()) pause.toggleUser(); },
  setSpeed: (n) => { if (!anyDialog()) { state.speed = n; hud.setSpeed(n); } },
  singleStep: () => { if (pause.user && !anyDialog() && !game.over) stepper.requestSingleStep(); },
  toggleHud: () => debugPanel.toggle(),
}, extraKeys);

// The one Escape handler: the pure resolver picks exactly one action. Dialogs that handle Escape themselves call preventDefault first.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const action = resolveEscape({
    menuOpen: menu.isOpen, howToOpen: howTo.isOpen, pauseMenuOpen: pauseMenu.isOpen, endScreenOpen: endScreen.isOpen, settingsOpen: panel.isOpen,
    buildMode: buildState.state.mode, gameOver: game.over,
  });
  if (action === 'none') return;
  e.preventDefault();
  if (action === 'close-howto') howTo.close();
  else if (action === 'close-pause-menu') pauseMenu.close();
  else if (action === 'hide-end-screen') endScreen.hide();
  else if (action === 'cancel-placing') buildState.cancel();
  else if (action === 'clear-selection') buildState.clearSelection();
  else if (action === 'open-pause-menu') pauseMenu.open();
});

let last = null;
let animTime = 0;
let wasPaused = false;
let panelClock = 0;

function frame(now) {
  const dt = last === null ? 0 : Math.min((now - last) / 1000, config.sim.maxFrameSeconds);
  last = now;
  if (dt > 0) frameStats.push(dt * 1000);

  const paused = pause.paused();
  if (paused !== wasPaused) { // do not judge or average the paused time
    if (!paused) { tickMeter.reset(); quality.reset(); }
    hud.setPaused(paused);
    wasPaused = paused;
  }
  state.steps = stepper.advance(dt, state.speed, paused);
  for (let i = 0; i < state.steps; i++) stepGame(game);
  if (!paused) {
    quality.update(dt);
    tickMeter.tick(now / 1000, state.steps); // every frame, so gaps decay the rate
  }
  // The scene keeps animating behind the menu and after the game ends; any other pause freezes it.
  const drawPaused = paused && !game.over && !menu.isOpen;
  if (!drawPaused) animTime += dt;

  renderer.draw(game, game.over ? 0 : stepper.alpha, dt, animTime, drawPaused); // alpha 0 once the game ended so nothing flickers

  panelClock += dt;
  if (panelClock >= 0.25) { // text is rebuilt 4x per second, not per frame
    panelClock = 0;
    const tps = paused ? 0 : tickMeter.rate;
    const s = renderer.stats;
    const tc = telemetry.counts();
    debugPanel.update(
      `FPS ${frameStats.fps.toFixed(0)}  frame avg ${frameStats.avgMs.toFixed(1)} / p95 ${frameStats.p95Ms.toFixed(1)} / max ${frameStats.maxMs.toFixed(1)} ms\n`
      + `ticks/s ${tps.toFixed(0)}  sim speed ${(tps * config.sim.stepSeconds).toFixed(2)}x  tick ${game.tick}  time ${game.time.toFixed(1)}s\n`
      + `speed x${state.speed}  paused ${paused}  quality ${quality.tier}  particles ${s.particles}/${s.particleLimit}\n`
      + `backing ${fitInfo.w}x${fitInfo.h}  DPR ${fitInfo.dpr.toFixed(2)}  seed ${game.seed}  debug ${debug}\n`
      + `gold ${game.gold}  towers ${game.towers.length}  projectiles ${game.projectiles.length}  selected ${buildState.state.towerId ?? '-'}${stress ? `  stress mode: towers ${stressTowers}` : ''}\n`
      + `fx: particles ${s.particles}  ghosts ${s.ghosts}  beams ${s.beams}  decals ${s.decals}\n`
      + `telemetry: enemies ${tc.enemyRecords} (dropped ${tc.enemyRecordsDropped}) waves ${tc.waveRecords} towers ${tc.towerRecords} active ${tc.active} ignored ${tc.ignoredEvents}\n`
      + `${formatDirectorLine(game)}\n`
      + `mode ${game.mode}  phase ${game.waves.phase}  wave ${game.waves.current}/${game.totalWaves}  lives ${game.lives}  countdown ${getWaveCountdownSeconds(game).toFixed(1)}s  remaining ${enemiesRemaining(game)}\n`
      + `enemy HP x${hpMultiplierForWave(game.waves.current).toFixed(2)} (next x${hpMultiplierForWave(game.waves.nextWave).toFixed(2)})  tower price x${priceMultiplier(game).toFixed(2)}\n`
      + `enemies alive ${game.enemies.length}  spawned ${game.nextEnemyId - 1}  queued ${game.spawnQueue.length}  tool ${debugTools ? debugTools.toolLabel : 'off'}`);
  }
  requestAnimationFrame(frame);
}

renderer.ready.then(() => requestAnimationFrame(frame));
console.log(`Siege Mind boot OK (seed ${seed})`);
