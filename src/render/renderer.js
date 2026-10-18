// Renderer: owns the glow cache, particles, floating text, shake, tweens, motes and the cached static layer.
// Reads sim state only; never mutates it. Visual randomness comes from createRng(seed).fork('fx').
import { config } from '../data/config.js';
import { DEFAULT_MAP } from '../data/map.js';
import { THEME } from './theme.js';
import { createRng } from '../sim/rng.js';
import { createGlowCache } from './glow.js';
import { createParticleSystem, KIND } from './particles.js';
import { createFloatText } from './floatText.js';
import { createShake } from './shake.js';
import { createTweens } from './tween.js';
import { drawEnemies } from './enemyRenderer.js';
import { bindFxEvents } from './fxEvents.js';
import { drawTowers, drawTowerGhost } from './towerRenderer.js';
import { drawProjectiles } from './projectileRenderer.js';
import { createFxApi } from './fxApi.js';
import { createTowerView } from './towerView.js';
import { createGhostPool } from './ghosts.js';
import { createBeamPool, createDecalPool } from './effectPools.js';
import { drawPlacementOverlay, drawSelectionOverlay } from './overlays.js';
import {
  buildStaticLayer, shouldRebuild, drawPathFlow, drawSpawnPortal, drawBaseCore,
  createAmbientMotes, updateAmbientMotes, drawAmbientMotes,
} from './layers.js';

const { width, height, hudHeight } = config.view;
const FLASH_DECAY = 3; // intensity per second
const SCAN_SECONDS = 0.9;
const SCAN_SLICES = 10;
const CORE_PULSE_DECAY = 2.5; // per second

/**
 * @param {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, game: object, settings: object, quality: object, seed: number|string, buildState?: object}} o
 * @returns {object} renderer: resize, onQualityChange, draw, handleClick, fx, ready, stats
 */
export function createRenderer({ canvas, ctx, game, settings, quality, seed, buildState = null }) {
  const rng = createRng(seed).fork('fx');
  const glow = createGlowCache();
  const particles = createParticleSystem({ capacity: config.quality.high.particleCap, rng });
  const floatText = createFloatText({ capacity: config.quality.high.floatTextCap });
  const shake = createShake({ rng });
  const tweens = createTweens(32);
  const { map } = game;
  const colorIds = {
    primary: particles.registerColor(THEME.colors.primary),
    white: particles.registerColor(THEME.colors.whiteHot),
    director: particles.registerColor(THEME.colors.director),
    danger: particles.registerColor(THEME.colors.danger),
  };

  const scratch = { x: 0, y: 0, angle: 0 };
  const spawnPos = map.path.positionAt(0, { x: 0, y: 0, angle: 0 });
  const corePos = map.path.positionAt(map.path.totalLength, { x: 0, y: 0, angle: 0 });
  const info = { tick: 0, alpha: 0, stepSeconds: config.sim.stepSeconds, params: null, reducedMotion: false }; // reused every frame
  const overlay = { flashColor: THEME.colors.danger, flashAlpha: 0, scan: -1, corePulse: 0 }; // tweened/decayed values

  let motes = createAmbientMotes(0, rng, map.width, map.height);
  let staticLayer = null;
  let builtKey = null;
  let wantedKey = '';
  let lastBuildMs = 0;
  let fit = { backingWidth: width, backingHeight: height, dpr: 1 };

  const params = () => quality.params;

  const applySettings = () => {
    const reduced = settings.get('reducedMotion');
    shake.setEnabled(settings.get('screenShake') && !reduced);
    particles.setDensity(settings.get('particleDensity'));
    motes = createAmbientMotes(reduced ? 0 : params().ambientMotes, rng, map.width, map.height);
  };

  const applyQuality = () => {
    const p = params();
    particles.setLimit(p.particleCap);
    floatText.setCap(p.floatTextCap);
    floatText.setOutline(p.name !== 'low');
    wantedKey = `${fit.backingWidth}x${fit.backingHeight}@${fit.dpr}|${p.name}`;
    applySettings();
  };
  applyQuality();
  settings.subscribe(applySettings);

  const view = createTowerView();
  const ghosts = createGhostPool();
  const beams = createBeamPool();
  const decals = createDecalPool();
  let clock = 0;
  const flags = { glow: true, reducedMotion: false }; // reused every frame
  const fx = createFxApi({ particles, floatText, shake, rng, colorIds, overlay, tweens, beams, decals, ghosts, view, corePos, clock: () => clock });

  // 'document' is fine here: the renderer is browser-only (src/render is not sim).
  const ready = Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);

  const unbindFx = bindFxEvents({ game, fx, settings, quality, theme: THEME });
  const stats = { particles: 0, particleLimit: 0, glowSprites: 0, ghosts: 0, beams: 0, decals: 0 };

  return {
    ready,
    fx,
    stats,
    /** @param {{backingWidth: number, backingHeight: number, dpr: number}} f */
    resize(f) {
      fit = f;
      applyQuality();
    },
    onQualityChange: applyQuality,
    /** Stop listening to sim events. */
    dispose() { unbindFx(); },
    /** Pointer event -> world (map) coordinates; written into `out`. */
    clientToWorld(event, out) {
      const rect = canvas.getBoundingClientRect();
      out.x = ((event.clientX - rect.left) / rect.width) * width;
      out.y = ((event.clientY - rect.top) / rect.height) * height - hudHeight;
      return out;
    },
    /** Convert client coordinates to map-space; null outside the map. */
    handleClick(clientX, clientY) {
      if (!config.debug.clickEffects) return false;
      const r = canvas.getBoundingClientRect();
      const x = ((clientX - r.left) / r.width) * width;
      const y = ((clientY - r.top) / r.height) * height - hudHeight;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
      fx.ring(x, y, { size1: 56 });
      fx.burst(x, y, { count: 14 });
      fx.floatText('+25', x, y - 8, { color: THEME.colors.tertiary });
      shake.add(0.25);
      return true;
    },
    /**
     * @param {object} gameState sim state (read only)
     * @param {number} alpha interpolation factor
     * @param {number} dt real frame seconds (0 while paused freezes fx)
     * @param {number} time animation clock in seconds (frozen by the caller while paused)
     * @param {boolean} [paused]
     */
    draw(gameState, alpha, dt, time, paused = false) {
      const step = paused ? 0 : dt;
      const p = params();
      const reduced = settings.get('reducedMotion');
      const g = p.glow ? glow : null;

      // fx updates
      particles.update(step);
      floatText.update(step);
      shake.update(step);
      tweens.update(step);
      ghosts.update(step);
      beams.update(step);
      decals.update(step);
      clock = time;
      flags.glow = p.glow;
      flags.reducedMotion = reduced;
      if (!reduced) updateAmbientMotes(motes, step);
      if (overlay.flashAlpha > 0) overlay.flashAlpha = Math.max(0, overlay.flashAlpha - FLASH_DECAY * step);
      if (overlay.corePulse > 0) overlay.corePulse = Math.max(0, overlay.corePulse - CORE_PULSE_DECAY * step);

      // 1. static layer (rebuilt at most every 150 ms; otherwise the previous canvas is scaled)
      const now = performance.now();
      if (shouldRebuild(builtKey, wantedKey, lastBuildMs, now)) {
        staticLayer = buildStaticLayer({
          map, hudHeight, width, height, backingWidth: fit.backingWidth, backingHeight: fit.backingHeight,
          waypoints: DEFAULT_MAP.waypoints,
        });
        builtKey = wantedKey;
        lastBuildMs = now;
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(staticLayer, 0, 0, width, height);

      // 2-4. world layers (map space, offset below the HUD, plus shake)
      ctx.save();
      ctx.translate(shake.offsetX, hudHeight + shake.offsetY);
      drawPathFlow(ctx, g, map, time, p, reduced, scratch);
      drawAmbientMotes(ctx, motes);
      drawSpawnPortal(ctx, g, spawnPos.x, spawnPos.y, time);
      drawBaseCore(ctx, g, corePos.x, corePos.y, time, overlay.corePulse);
      decals.draw(ctx, THEME.tower.mortar);
      drawTowers(ctx, g, gameState, time, step, alpha, view, flags, buildState && buildState.state.mode === 'selected' ? buildState.state.towerId : null);
      for (let i = 0; i < ghosts.slots.length; i++) if (ghosts.slots[i].active) drawTowerGhost(ctx, g, ghosts.slots[i], time, flags);

      // 3. entities
      info.tick = gameState.tick;
      info.alpha = alpha;
      info.params = p;
      info.reducedMotion = reduced;
      drawEnemies(ctx, g, gameState, alpha, time, info, scratch);
      drawProjectiles(ctx, g, gameState, alpha, step, time, fx);
      beams.draw(ctx, THEME.tower.sniper);

      // 4-5. effects and floating text
      particles.draw(ctx, g);
      floatText.draw(ctx);
      if (buildState) {
        drawSelectionOverlay(ctx, gameState, buildState);
        drawPlacementOverlay(ctx, g, gameState, buildState, time, flags);
      }
      ctx.restore();

      // 6. overlays
      if (overlay.flashAlpha > 0) {
        ctx.globalAlpha = overlay.flashAlpha * 0.4;
        ctx.fillStyle = overlay.flashColor;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
      }
      if (overlay.scan >= 0 && overlay.scan < 1) {
        const cx = overlay.scan * (width + 240) - 120;
        ctx.fillStyle = THEME.colors.director;
        for (let s = 0; s < SCAN_SLICES; s++) {
          ctx.globalAlpha = 0.5 * (1 - s / SCAN_SLICES) * (1 - overlay.scan * 0.4);
          ctx.fillRect(cx - s * 12, 0, 12, hudHeight);
        }
        ctx.globalAlpha = 1;
      }
      stats.particles = particles.count;
      stats.particleLimit = particles.limit;
      stats.glowSprites = glow.size;
      stats.ghosts = ghosts.count;
      stats.beams = beams.count;
      stats.decals = decals.count;
    },
  };
}

export { KIND };
