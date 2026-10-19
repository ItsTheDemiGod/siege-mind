
# SIEGE MIND — Project Brain (CLAUDE.md)

> Read this ENTIRE file at the start of every session before touching any code.
> This file is the single source of truth for the project. Keep it updated (see Section 11).

---

## 1. Project Summary

**Siege Mind** (working title) is a browser-based tower defense game with a twist: the enemy side is controlled by an **adaptive Director AI**.

- **Static Mode** — waves follow a fixed, pre-authored script. This is the control group.
- **Adaptive Mode** — after every wave, the Director measures which enemy types performed well against the player's current tower loadout and re-weights the next wave toward them. Total wave difficulty (threat budget) is identical to Static Mode, so only the *composition* changes, never the raw difficulty.
- **Explainability overlay** — a live panel shows each enemy type's effectiveness score and spawn weight, so anyone watching can see *why* the Director changed the wave.
- **Experiment harness** — a headless, seeded simulator runs bot players against both modes many times and produces reproducible results for the class report.

Context: game development class project (solo). Goal is a polished, fully playable game AND a clear technical story (adaptive difficulty / player modeling / explainable game AI).

## 2. Success Criteria (project is "done" when all are true)

1. Fully playable from main menu to win/lose screen, no crashes, 60 FPS on a normal laptop.
2. 5 tower types, 5 enemy types, 30 waves, with the counter relationships in Section 6 clearly felt in play.
3. Mode toggle: Static vs Adaptive, selectable from the menu.
4. Adaptive Director measurably changes wave composition in response to player loadout (visible in the overlay).
5. Headless experiment harness produces results (CSV/JSON + charts) comparing Static vs Adaptive across multiple bot strategies and 30+ seeds each.
6. Deployed to a public URL (GitHub Pages or Vercel) with a README, demo script, and report material.
7. Visual consistency: every entity, effect, and UI element follows the Visual Design Bible (Section 6B); no placeholder shapes remain after Phase 1B.
8. Performance: stable 60 FPS with 150+ enemies and 40+ towers on a mid-range laptop at default quality; a Low quality mode exists for weak machines.
9. Engineering quality: tests pass in CI on every push, headless experiments are reproducible from a seed, and the README includes GIFs and an architecture diagram.

## 3. Tech Stack and Hard Constraints

- **Language:** vanilla JavaScript, ES modules. No TypeScript, no framework, no bundler.
- **Rendering:** HTML5 Canvas 2D.
- **Charts:** hand-built SVG (no chart library); Chart.js is not used.
- **Node.js 22+** is for dev tooling only: local server, tests (`node --test`), headless simulation.
- **Runtime dependencies allowed:** none. Ask the user before adding anything.
- **Target:** latest desktop Chrome/Edge. Logical canvas 1280x720, scaled to fit the window.
- **Assets:** All visuals are procedural (canvas, SVG, CSS) per Section 6B. Placeholder shapes are allowed only through Phase 1A. Optional CC0 assets (e.g. Kenney.nl) or fonts only with the user's approval. Never use copyrighted assets.

## 4. Architecture Rules (non-negotiable; log any change in Section 13)

1. **Sim/render separation.** Everything in `src/sim/` is pure game logic with ZERO references to `window`, `document`, `canvas`, or any DOM API. It must run unchanged in Node. `src/render/` and `src/ui/` read sim state and never mutate it.
2. **Fixed timestep.** The sim advances in fixed steps of 1/60 s. Game speed (x1/x2/x3) = more sim steps per rendered frame, never a larger step.
3. **Seeded randomness.** All sim randomness goes through `src/sim/rng.js` (seeded PRNG such as mulberry32). `Math.random()` is forbidden inside `src/sim/`.
4. **Data-driven design.** All tower, enemy, wave, and economy numbers live in `src/data/`. No magic numbers in logic files.
5. **Event bus.** The sim emits events (`wave_started`, `enemy_spawned`, `enemy_killed`, `enemy_leaked`, `tower_fired`, `tower_placed`, `wave_ended`, `game_over`). Telemetry, audio, particles, and UI subscribe to events instead of being called directly from sim code.
6. **Serializable state.** Game state is plain objects/arrays (no class instances holding DOM or closures) so runs can be logged and replayed.
7. **Small modules.** One responsibility per file, aim for under ~300 lines, ES module imports/exports only, no globals.
8. **Render performance rules.** No per-frame object allocation in hot paths (pool particles and projectiles), no per-frame shadowBlur (use cached glow sprites), static background cached to an offscreen canvas, canvas is devicePixelRatio-aware (clamp DPR at 2), and rendering interpolates between fixed sim steps so motion is smooth at any refresh rate.

## 5. Folder Structure (target)

```
siege-mind/
  CLAUDE.md                  <- this file
  .gitattributes             <- forces LF line endings
  README.md
  package.json               <- scripts: start, test, sim
  index.html
  gallery.html               <- style gallery page (visual QA)
  vendor/                    <- chart.umd.js (vendored)
  assets/
    favicon.svg
    fonts/                   <- vendored woff2 (Rajdhani 500/600/700, Inter 400/500/600), OFL licenses, README.md
  src/
    main.js                  <- bootstraps game, wires sim + render + ui
    gallery.js               <- style gallery wiring (live stages, effects lab, quality)
    galleryStatic.js         <- gallery sections: palette, type, enemies, icons, UI kit, colorblind
    galleryEnemies.js        <- gallery: enemy states grid + sim-event effect buttons
    galleryTowers.js         <- gallery: 15 live towers, silhouettes, effect buttons
    galleryScreens.js        <- gallery 4b: core states, wave banner, end screens (real modules, fake data)
    galleryDirector.js       <- gallery 7: overlay, charts, report from docs/fixtures/demo-adaptive-w15.json
    sim/                     <- PURE logic, runs in Node
      rng.js
      game.js                <- top-level game state + step()
      map.js                 <- grid, path, buildable cells
      enemies.js
      towers.js
      projectiles.js
      waves.js               <- wave planning (static mode; Adaptive arrives in Phase 6)
      waveRunner.js          <- phases, intermissions, clear bonus, game end
      lives.js               <- lives and defeat
      stats.js               <- run statistics from events
      economy.js
      events.js              <- tiny event bus
      stepper.js             <- fixed-timestep accumulator (pure math)
      damage.js              <- armor/shield/DoT damage model + events
      statuses.js            <- slow, poison, regen suppression
      towers.js              <- placement, upgrades, targeting, firing (no rng)
      projectiles.js         <- homing bolts, ballistic shells, impacts
      economy.js             <- gold: earn/spend/events
      director.js            <- Director state, event wiring, planFor (pure) -> plan + decision record
      directorMath.js        <- pure Director math (reward, advantage, scores, tilt, shares); no pow/exp/log
      directorExplain.js     <- pure human-readable lines for a decision
      directorMathV2.js      <- pure Director v2 math: baselineValue, shrinkFactor, computeObservationV2, config validators for v2 and the counter arm
      directorV2.js          <- Director v2 ('adaptive2') state, event wiring, planForV2, DECISION_KEYS_V2
      directorPrior.js       <- prior control ('prior'): fixed weights from the static baseline only; priorTilt, planForPrior, DECISION_KEYS_PRIOR, validatePriorConfig
      directorCounter.js     <- informed counter arm ('counter'): loadoutPressure, planForCounter, DECISION_KEYS_COUNTER
      telemetry.js           <- observation-only collector: attachTelemetry(game) -> getRun()
      telemetrySchema.js     <- ids, factories, roundTo, derived stats, CSV column lists
      telemetryRecords.js    <- record builders and plain-data helpers for the collector
      telemetryValidate.js   <- validateRun: consistency checks on a run
      telemetryExport.js     <- pure JSON and CSV export of a run
    data/
      towers.js
      enemies.js
      waves.js               <- static script + threat-budget curve, INTRO_WAVES, isAdaptiveEligible
      waveCompose.js         <- shared composer: shares -> groups (static builder and Director), deterministic fit step
      config.js              <- economy, lives, director hyperparameters
      map.js                 <- default map grid + waypoints
      enemies.js
      towers.js              <- 5 towers, upgrades, target modes
      towerVisuals.js        <- per-tower animation/trail/impact parameters
      debugTools.js          <- debug tool/key table (Phase 2)
      menuText.js            <- main menu and how-to-play text (frozen, length-tested); RESEARCH_ARMS labels
      directorBaseline.js    <- GENERATED by npm run baseline: static reward per enemy type and wave (train seeds), fallback, meta
    render/                  <- canvas drawing only
      theme.js               <- palette, tokens, durations, fonts, cssVariables()
      color.js               <- hex/mix/contrast/deltaE, colorblind simulation (Machado 2009)
      tween.js               <- easing + pooled tween manager
      glow.js                <- glow sprite cache, additive helpers
      particles.js           <- pooled SoA particle system
      floatText.js           <- pooled floating texts
      shake.js               <- screen shake (fx rng)
      quality.js             <- Low/Medium/High controller, auto-downgrade only
      perf.js                <- rate meter + frame stats (pure)
      shapes.js              <- procedural enemy shapes + silhouettes
      layers.js              <- cached static layer, path flow, portal, core, motes
      renderer.js            <- owns fx systems, draw order, fx API
      enemyRenderer.js       <- draws enemies: shape, flash, statuses, health bars
      fxEvents.js            <- sim events -> particles, numbers, shake, flash
      towerRenderer.js       <- final tower art: recoil, flash, charge, build-in, tier mark, sell ghost
      towerShapes.js         <- pure tower shape data per type and level
      towerPaths.js          <- Path2D cache built once from the shape data
      towerAnim.js           <- pure recoil/flash/charge/build values, smoothAngle, spinAngle
      towerView.js           <- render-side Maps: smoothed angles, upgrade flash times
      towerFx.js             <- tower/projectile event feedback
      projectileRenderer.js  <- bolts with comet tails, poison blobs, arcing shells
      fxApi.js               <- the fx API used by event handlers
      effectPools.js         <- sniper beam and scorch decal pools
      ghosts.js              <- sell-dissolve ghost pool
      shellArc.js            <- visual ballistic arc math
      tint.js                <- precomputed status tint table
      hash.js                <- pure integer hash for deterministic visuals
      overlays.js            <- placement ghost and selection overlays
      fit.js                 <- canvas fit to window, DPR + backing-pixel budget
      coreRenderer.js        <- base core in four states (shape-based), destroyed and victory animation
    ui/                      <- HUD, menus, overlays, analytics panel
      style.css              <- CSS variables mirroring theme.js (parity tested)
      dom.js                 <- tiny element helper
      hud.js                 <- top HUD bar
      icons.js               <- inline SVG icon set
      tooltip.js             <- shared tooltip
      toast.js               <- aria-live toasts
      settings.js            <- persisted settings (injectable storage)
      settingsPanel.js       <- settings modal
      debugPanel.js          <- DOM debug readout
      debugTools.js          <- debug spawn keys and click tools (commands only)
      buildState.js          <- pure placement/selection state machine
      waveControl.js         <- wave control (Start Wave button, countdown)
      waveControlState.js    <- pure wave control text/state
      trayState.js           <- pure tower price/affordability for the tray
      endScreen.js           <- functional victory/defeat card
      format.js              <- pure end-screen formatting
      restart.js             <- pure restart URL builder
      panelPlacement.js      <- pure tower-panel placement
      stress.js              <- ?debug=1&stress=1 tower crowd
      buildController.js     <- pointer + hotkeys -> sim commands
      buildTray.js           <- HUD tower buttons
      towerPanel.js          <- selected-tower panel
      towerInfo.js           <- tooltip/panel text helpers (pure)
      keys.js                <- dev keyboard controls
      exportName.js          <- pure download file names and MIME types
      downloadRun.js         <- Blob download helper (button handlers only)
      pauseState.js          <- pure pause model: user flag + named locks
      escapeResolver.js      <- pure: what Esc does, by priority (single Esc handler in main.js)
      confirmClick.js        <- pure two-click confirmation (Restart, Quit)
      menuState.js           <- pure: seed parsing, shouldShowMenu, play/menu URLs, parseModeParam (also adaptive2 and counter, URL only)
      previewRefresh.js      <- pure: preview de-duplication key and the tower events that refresh it in counter mode
      bannerState.js         <- pure view models for the wave banner and preview
      compositionItems.js    <- pure ordered composition list; compositionChips.js builds the DOM chips
      coreIntegrity.js       <- pure: lives -> ring segments and core state
      waveSummary.js         <- pure: end-screen wave strip and texts; endModel.js builds the whole end model
      focusTrap.js           <- Tab trap shared by every dialog; radioGroup.js accessible radio buttons
      mainMenu.js            <- main menu dialog (mode, length, seed, start)
      howToPlay.js           <- how-to-play dialog
      pauseMenu.js           <- pause menu (Esc)
      waveBanner.js          <- wave start banner (live region)
      wavePreview.js         <- incoming-wave preview above the wave control
      endScreenView.js       <- end-screen DOM from a plain model (also used by the gallery)
      endCardLayout.js       <- pure: where the end card and the report sit (clear of the HUD strip)
      decisionLog.js         <- pure: log of the Director decision records of started waves
      directorView.js        <- pure: overlay view model, tilt bar fraction, directions, held weights
      directorChart.js       <- pure: tilt chart geometry, markers, dashes, fill patterns
      directorReport.js      <- pure: Director report model and insight rules from a telemetry run
      directorOverlay.js     <- Director overlay panel (key I, HUD button)
      directorChartView.js   <- SVG tilt chart, composition strip, pattern legend
      directorReportView.js  <- the Director report modal (and its sections, reused by the gallery)
      reportController.js    <- opens and closes the report from the end card
      directionMark.js       <- up/down triangle marks on composition chips
      svg.js                 <- createElementNS helper
    audio/
      synth.js               <- WebAudio procedural SFX
  tests/                     <- node:test unit tests (golden/ holds the frozen Phase 5 static waves; sim, enemies, damage, statuses, towers, targeting, combat, economy, matchups R1-R7, buildState, trayState, waves-data, lives, stats, waveRunner, balance, waveControlState, format, restart, panelPlacement, z-index tokens, towerAnim/towerShapes/towerVisuals, ghosts, shellArc, tint, effectPools, stress, perf, color, theme parity, tween, particles, quality, settings, icons, render rules)
  tools/
    browser-check/           <- dev only: headless Chrome over CDP (args, chrome, cdp, page, check, smoke); not part of npm test
  experiments/
    bots.js                  <- bot players (none, balanced); Phase 8 extends
    tiles.js                 <- shared tile ranking
    playthrough.js           <- headless full-game playthrough (npm run playthrough; --telemetry=full|summary writes JSON/CSV)
    summarize.js             <- plain-text tables from a run JSON (npm run summarize)
    makeFixture.js           <- writes docs/fixtures/demo-adaptive-w15.json (npm run fixture:demo)
    protocol.js              <- the frozen pre-registered experiment protocol, seed sets, style weights, protocolHash
    styleBots.js             <- five style bots with their own seeded random stream
    metrics.js               <- per-game metrics from a telemetry run (METRIC_COLUMNS)
    runExperiment.js         <- batch runner, result files, identityOf (code hash, git commit)
    runExperimentCli.js      <- npm run experiment (the held-out set goes through the lock first)
    lock.js                  <- pure lock decision for the held-out set and the validation seeds (kind); the CLI writes experiments/heldout.lock.json or validation.lock.json
    splits.js                <- TRAIN_SEEDS (1001-1020), VALIDATION_SEEDS (1021-1030), splitSeeds
    modes.js                 <- PROTOCOL_MODES, EXTRA_MODES (adaptive2, counter), ALL_MODES, modesAllowedFor
    makeBaseline.js          <- pure buildBaseline + CLI npm run baseline (writes src/data/directorBaseline.js from static train-seed games)
    confirmatory.js          <- pure confirmatory analysis of amendment A3 (K1-K3 with Holm, estimands, contrasts, coverage, sensitivity); confirmatoryStats.js building blocks, confirmatoryFormat.js text/markdown
    confirmCli.js            <- npm run confirm: held-out rows (set, version, hash, lock runIndex checked) or --dry-run on training data (output name must contain dryrun)
    heldoutPlan.js           <- pure heldoutPlan + npm run plan-heldout (counts, exact commands, rough runtime from training games)
    fixedWave.js             <- pure fixed-wave rule: coverageTable, chooseFixedWave (counts only), candidates 9..15 eligible
    firstLookChain.js        <- attribution chain, tilt agreement, mean tilts (pure); firstLookContrast.js is the fixed-wave style contrast
    firstLook.js             <- pure first look at all modes on the population (firstLookFormat.js text/markdown, firstLookCli.js is npm run first-look)
    stats.js                 <- mean/sd/quantile, sign-flip test, cluster bootstrap, Holm, Wilson, required n
    analyze.js               <- the pre-registered analysis (analyzeFormat.js renders text and markdown)
    analyzeCli.js            <- npm run analyze
    calibrate.js             <- bot calibration: 9-combination grid, chooseKnobs, chooseWithDrop, selectKnobs (3 stages, static mode only); calibrateCli.js is npm run calibrate
    contrast.js              <- pure style-contrast statistic (contrastPerSeed, contrastSummary, pairedContrastDifference) + CLI npm run contrast
    earlyLosses.js           <- pure early-ends check (units that ended before wave 5, same in every mode) + CLI npm run early-losses
    legacyPredictions.js     <- frozen tilt predictions and style names of protocol versions 1-2 (focus styles)
    analyzeExtras.js         <- analysis parts added by amendment A2: contrast hypotheses T2/T0, contrast block, early-ends block, reached-wave-5 sensitivity
    compareRows.js           <- diffColumns: unit-by-unit comparison of two row sets (proves what an amendment changed)
    amendmentReport.js       <- amendment A1 report (legacy versus A1 final tilt); npm run amendment-report
    diagnose.js              <- static-mode diagnostics of the reward signal incl. rewardContrast (diagnoseFormat.js, diagnoseCli.js; npm run diagnose)
    figures/                 <- hand-written SVG toolkit (palette, svg, draw) and the six figure builders (figuresA.js, figuresB.js)
    figuresCli.js            <- npm run figures: writes docs/results/figures
    directorCompare.js       <- Static vs Adaptive vs Random over bots and seeds, report-only hypotheses (npm run compare)
    run.js                   <- headless batch runner (Phase 8)
    matchups.js              <- tower-vs-enemy matchup harness (npm run matchups)
    results/                 <- generated CSV/JSON (gitignored if large)
    analysis/                <- charts / stats for the report
  docs/
    TELEMETRY.md             <- telemetry schema, attribution rules, CSV tables
    DIRECTOR.md              <- the Director algorithm, config keys, decision record, controls, overlay and report
    EXPERIMENT.md            <- the pre-registered experiment protocol
    results/                 <- committed experiment outputs; README.md explains every file (calibration, tuning, amendment-A1, diagnostics, figures/, archive/)
    fixtures/                <- demo-adaptive-w15.json: a recorded adaptive run for the gallery and tests
    DEMO_SCRIPT.md
    REPORT_NOTES.md
    screens/                 <- screenshots and GIFs for README/report
  .github/
    workflows/
      test.yml               <- CI (Phase 10, or earlier once a GitHub remote exists)
```

## 6. Game Design Spec

**Map:** one fixed winding path on a tile grid. Logical canvas 1280x720; a HUD strip is reserved at the top (80 px); the map grid is 20 columns x 10 rows of 64 px tiles = 1280x640, drawn below the HUD strip. The sim's world coordinates have their origin at the top-left corner of the MAP (not the canvas); only the renderer adds the 80 px HUD offset. Spawn tile (0,1), exit tile (19,7), path waypoints (in tile coordinates) (0,1) -> (17,1) -> (17,4) -> (2,4) -> (2,7) -> (19,7), an S-shaped path with two hairpin turns (total length 3520 world units). Blocked (non-buildable decor) tiles: (8,2) (9,2) (10,5) (11,5) (5,9) (6,9). Everything else is buildable. Towers are placed only on buildable tiles. Single entry, single base.

**Economy and lives (initial values, tunable in `config.js`):** start gold 150, lives 20, kill reward per enemy type (in data), 2 upgrade levels per tower, sell refund 70% of everything paid. Tower prices grow with the number owned: `price = round(base * (1 + towerCostGrowth * towersOwned))` with towerCostGrowth 0.03 (upgrades are not scaled); the cap is 60 towers. Clear bonus per wave 13 + 6w gold. Gold, prices, upgrades and selling are Phase 3A; lives, waves and win/lose are Phase 4A.

**Game length (Phase 4B):** the menu offers Quick (15 waves, about 19 game minutes for the balanced bot, the default) and Full (30 waves, about 43 minutes, the research setting). Both use the same 30-wave script, HP curve and economy: Quick simply ends after wave 15 (`game.totalWaves`, allowed values in `config.game.allowedTotals`). The 30-wave results are unchanged. Wave 10 is the only set piece inside a Quick game; it has no special finale.

**Menu and URL flow (Phase 4B):** the menu shows unless the URL has `play` or `debug`. Start navigates to `?seed=..&mode=static&waves=15|30&play=1` (a clean boot); Restart and "Retry same seed" reload with the same seed; "New seed" picks a random one; "Quit to menu" and "Main menu" drop `play` and the debug parameters. `?waves=` other than 15 or 30 falls back to 30 with a toast. Adaptive is shown but locked until Phase 6.

**Towers** (initial values from src/data/towers.js; upgrade multipliers are absolute per level; Phase 9 retunes everything)

| Tower | Cost | Role and stats (level 0) | Strong vs | Weak vs |
|---|---|---|---|---|
| Lance (bolt) | 60 | Homing piercing bolt, damage 24 (ignores armor), range 150, one shot per 54 ticks (0.9 s). Upgrades 45 / 80 gold | Armored Grunt | Swarmling |
| Mortar (shell) | 100 | Ballistic shell (speed 240, no lead prediction), damage 36, splash radius 60 falling off to 50%, range 170, 90 ticks. Upgrades 75 / 130 | Swarmling | Fast Runner (shells miss), tanky singles |
| Frost (pulse) | 70 | Pulse every 60 ticks to everything within range 110: slow to 50% for 1.6 s, damage 4. Upgrades 50 / 90 (slow 0.42 / 0.33) | Fast Runner (supports every tower) | Low standalone damage |
| Poison (bolt) | 80 | Bolt that poisons the target and enemies within a 28 radius cloud: 8 dps per stack for 4 s, stacks to 5, stops regeneration, range 140, 75 ticks. Upgrades 60 / 100 | Regenerator | Fast Runner, Shielded Bruiser (shield blocks DoT) |
| Sniper (hitscan) | 120 | Instant armor-piercing shot, damage 90 (x3 vs shields), range 320, 210 ticks (3.5 s), default target Strongest. Upgrades 90 / 150 | Shielded Bruiser | Swarmling, Fast Runner |

**Enemies**

| Enemy | Traits | Threat cost (per unit) |
|---|---|---|
| Armored Grunt | hp 120, speed 55, flat armor 6 (non-piercing damage), reward 10 | 10 |
| Swarmling | hp 28, speed 70, packs of 8 spaced 16 ticks, reward 2 | 3 (pick cost 24 per pack) |
| Fast Runner | hp 45, speed 130 (~2x), reward 6 | 8 |
| Regenerator | hp 260, speed 45, armor 1, regenerates 2% maxHp/s unless poisoned, reward 16, leaks for 2 lives | 16 |
| Shielded Bruiser | hp 220, speed 38, armor 3, shield 160 that must break first and blocks DoT, reward 24, leaks for 3 lives | 24 |

These are initial values (src/data/enemies.js), retuned in Phase 9.

Exact numeric stats are decided in Phases 2 and 3, stored in `src/data/`, and recorded in Section 13.

**Waves:** 30 waves (src/data/waves.js). The target threat budget of wave w is `round(budgetScale * (40 + 22(w-1) + 1.6(w-1)^2))` with budgetScale 1. Static Mode builds each wave from a hand-authored template of threat shares with a pure builder (largest-remainder rounding, pick cost = threatCost x packSize), so the REALIZED threat STATIC_THREAT[w] stays within max(5%, 12) of the target; all threat accounting is in BASE threat units. **Enemy HP and shield scale with the wave** by `hpMultiplierForWave(w)` (polynomial curve `1 + 0.325 d + 0.02 d^2`, d = w - 1, so x1.0 at wave 1, x5.5 at wave 10, x14.4 at wave 20, x27.3 at wave 30; the exponential curve remains selectable via config.waves.hpCurve); armor, speed, rewards, leak damage and threat costs stay flat. **Regeneration heals 2% of the enemy type's BASE HP per second**, not of the scaled max HP. Opening: waves 1-2 grunts only; swarmlings from wave 3, runners from 4, regenerators from 6, bruisers from 8. Waves 11-19 and 21-29 rotate themes (grunt-, swarm-, runner-, regenerator-, shield-heavy, then four mixed waves each led by a different type). Fixed waves in both modes: 10 'The Vanguard' (grunt 0.50, bruiser 0.35, regenerator 0.15), 20 'Tide of Swarm' (swarm 0.55, runner 0.30, grunt 0.15), 30 'The Siege' (0.25/0.20/0.15/0.20/0.20). Spawns are spread over a window of min(30, 12 + 0.8w) s per group but never faster than the per-type minimum gap (the window stretches instead). Pacing: wave 1 waits for the player (Enter); later waves auto-start after a 12 s intermission, starting early is allowed with no bonus; clearing wave 30 wins; losing all 20 lives loses. Adaptive Mode (Phase 6) spends the SAME budget but chooses composition via the Director.

## 6B. Visual Design Bible

**Concept:** "Holographic war room." The battlefield is a dark holographic tactical table. The player (Defense) is cool cyan/blue light. Enemies and the Director are contrasting hot colors. Mood: sleek, tense, readable. All visuals are procedural (canvas, SVG, CSS) with no raster art required. Optional CC0 assets (e.g. Kenney) only for icons/audio, only with the user's approval.

**Starting palette** (final values live in src/render/theme.js and are tuned in the style gallery for contrast and colorblind safety):
- Backgrounds: bg0 #070b14, bg1 #0d1424, panel #111a2e, gridLine #17233f
- Text: #e8f0ff, muted #7f90b0
- Defense (cool): primary #35e0ff, secondary #5b8cff, tertiary #7af0d0, white-hot #e6fbff
- Director accent: violet #a56bff
- Enemies: Armored Grunt orange #ff8a3d (hexagon), Swarmling magenta #ff3d8b (small triangles), Fast Runner yellow #ffd84d (elongated chevron), Regenerator lime #a6ff4d (circle with pulsing ring), Shielded Bruiser coral #ff5252 (large octagon with a pale rotating shield ring #ffe9e9)
- Rule: every enemy and tower is identifiable by silhouette AND color; never color alone.

**Typography:** Rajdhani (headings and HUD numbers, tabular numerals) and Inter (body), both OFL-licensed, vendored as woff2 in assets/fonts/ with a system-font fallback. If a download is needed, ask the user for approval first.

**Rendering:**
- Layers: (1) cached static background (grid, vignette, path base), (2) animated path flow and ambient effects, (3) entities, (4) additive-blend effects, (5) overlays (range rings, placement ghost). HUD and menus are DOM/CSS over the canvas for crisp text.
- Glow via pre-rendered glow sprites drawn with globalCompositeOperation 'lighter'.
- Particles: pooled, hard caps per quality tier (Low 300 / Medium 800 / High 2000), zero allocation in the frame loop.
- Quality tiers Low/Medium/High; auto-downgrade if FPS stays under 45 for 3 seconds (user can override).
- Easing and tween helpers; UI transitions 120-250 ms.
- Settings: screen-shake toggle, reduced-motion toggle, particle density.

**Juice standard** (every gameplay event gets visible feedback in the same frame):
- Enemy spawn: scale-in plus brief ring. Hit: ~60 ms white flash plus sparks. Death: burst proportional to enemy size, small shockwave, floating "+gold" text. Leak: base core pulse, brief red vignette flash, subtle shake.
- Tower place: build-in animation plus ring. Sell: dissolve. Fire: muzzle flash, recoil kick, projectile trails, a distinct impact effect per tower type (Mortar shockwave ring, Frost ice shards and aura, Poison cloud, Sniper laser line, Lance piercing streak).
- Wave start: banner slide-in with wave number and composition icons. Wave end: summary toast.
- Director event (Adaptive Mode): when composition shifts, a violet "scan" sweep across the HUD and the changed enemy types highlighted.

**UI:** DOM/CSS overlay HUD driven by CSS variables mirroring theme.js; semi-transparent dark panels with 1px glow borders; consistent hand-built inline SVG icons; tooltips with stats and counter info; keyboard shortcuts shown; responsive to window size.

**Audio** (implemented in Phase 9 via event-bus subscribers): WebAudio procedural synth for SFX (no asset dependency); optional CC0 ambient loop chosen by the user; master/SFX/music volume; audio starts only after the first user gesture.

**Style gallery:** gallery.html renders palette swatches, every enemy and tower at multiple sizes, particle effect demos, and UI components, as a permanent visual QA page and a source of screenshots for the report.

## 7. Director AI Spec (Phase 6, implemented)

Modes: 'static' (hand-authored waves, the control), 'adaptive' (the Director) and 'random' (a second control: random tilts of the same range with no learning). All three spend the SAME threat per wave (STATIC_THREAT[wave], in base threat units) and apply the SAME HP multiplier (hpMultiplierForWave(wave)); the Director changes composition only.

Eligible waves: not a fixed set piece (10, 20, 30), not an introduction wave (3, 4, 6, 8) and wave >= config.director.firstAdaptiveWave (5); every other wave uses the static plan. The Director observes and learns from EVERY finished wave.

Observation (sim events only, independent of telemetry), per enemy type that spawned: units, leaked, meanProgress (a leak counts as 1), threatSpent = units * threatCost. reward = leakDamage * meanProgress^k / threatCost (k = rewardExponent). average = threat-weighted mean reward over the types that spent at least minThreatShare of the wave's threat. advantage = clamp((reward - average) / average, -1, +advClipHigh). score = (1 - alpha) * score + alpha * advantage for those types; every other type: score = decay * score. tilt = clamp(1 + beta * score, 1 / tiltMax, tiltMax).

Composition of an eligible wave: base share = the static template share (absentFloorShare when the type is unlocked but absent from the template, 0 while locked); share = base * tilt / sum(base * tilt); the shared composer turns shares into picks with the same largest-remainder rules, timing windows and minimum gaps as the static builder and a deterministic fit step brings realized threat within the data tolerance of STATIC_THREAT.

Cold start: with all scores 0 the plan equals the static plan exactly.

Why progress and not leak rate alone: in the balanced-bot data only 5 leaks happened in 15 waves (all Regenerators and Bruisers), so progress is the continuous signal; the exponent rewards near-leaks.

Known bias: tanky types score higher against most defenses, which is why the random control exists.

Random control: tilt = 1 / tiltMax + (tiltMax - 1 / tiltMax) * u with u from createRng(seed).fork('director-wave-' + wave); it records observations but ignores them.

Explainability: every wave has a decision record (reason, tilts, shares, picks, threat target and realized, what it was based on, human-readable lines) in the WAVE_STARTED payload and in telemetry waves[n].director (see docs/DIRECTOR.md).

Research arms (Phase 9A-2a, URL only, not in the menu, not part of PROTOCOL): 'adaptive2' (Director v2) keeps v1's mechanism but divides each type's reward by a static baseline for its type and wave (src/data/directorBaseline.js, measured in static train-seed games, so it cannot be circular), computes the advantage against the threat-weighted mean of those normalized rewards and shrinks it by units / (units + shrinkK); 'counter' reads the tower loadout (pressure = weight of towers weak against a type minus weight of towers strong against it, over the total weight; tilt = clamp(1 + gain * pressure)) and is an achievable ceiling, not a fair competitor. Both use the same eligibility, threat target and HP rules as v1, and v1, static and random are bit-for-bit unchanged (tests/golden-modes.test.js). See docs/DIRECTOR.md.

Prior control (Phase 9A-2b-1, URL only, `mode=prior`): a fixed, non-learning arm whose weights come only from the static baseline table and the template shares (tilt = clamp(1 + beta * clamp((b - avg) / avg, -1, advClipHigh)), avg = template-share-weighted mean of the baseline rewards); it reproduces the enemy-durability bias of the learning Directors without learning and without reading the defense, so its fixed-wave style contrast is exactly 0. See docs/DIRECTOR.md.

Explainability (Phase 7): the overlay (key I, HUD button, Adaptive and Random modes) shows the decision for the upcoming wave while the game is in prep or intermission (read-only, from the pure planner planWaveWithDecision) and the latest logged decision (a decision log filled from WAVE_STARTED) while a wave runs or after the game. Rows show the applied tilt; the tilt chart plots the HELD weights (tiltFromScores of the scores) because non-eligible waves report an applied tilt of 1. The Director's Report (end card, adaptive and random runs) is built from the telemetry run: insight 1 leaned-on types, 2 backed-off types, 3 top damage tower with a weakness note, 4 toughest wave, 5 mean share shift; capped at config.report.maxInsights. Details and exact templates in docs/DIRECTOR.md.

Numeric rules: only + - * / comparisons and Math.min/max/floor/round/abs (no Math.pow, Math.exp, Math.log) so every JavaScript engine gives the same numbers.

## 8. Telemetry Spec (Phase 5, implemented)

Full reference: docs/TELEMETRY.md. Observation only: `attachTelemetry(game, { detail, meta })` (src/sim/telemetry.js) subscribes to the event bus, copies primitives out of payloads and never writes game state, uses an rng or a clock, or emits events. `getRun()` returns a fresh plain JSON object:

- **run:** `schemaVersion`, `meta` (detail, seed, mode, totalWaves, startLives, startGold, stepSeconds, attachedAtTick, ignoredEvents, enemyRecordsDropped, extras), `config` and `definitions` (exact copies), `result`, `totals`, `offWave`, `waves`, `towers`, `enemies` (full detail only).
- **per wave:** composition, hpMult, budget, threat, loadout snapshot, gold buckets (prep / during), per enemy type spawned / killed / leaked / leakRate / meanProgress / meanTimeAlive / damage and kills by source (lance, mortar, frost, poison, sniper, debug, other), tower activity (shots, impacts), director (null until Phase 6).
- **per tower:** build wave and phase, upgrades, sold data, damage dealt, kills, shots, damage and kills by enemy type. **Per enemy:** spawn, outcome, progress, damage by source, killer.
- Exports: JSON and four CSV tables (waves, wavetypes, enemies, towers) from src/sim/telemetryExport.js; `validateRun` checks consistency; `npm run summarize` prints tables.

## 9. Experiment Harness Spec (Phase 8A, amended in 8B and 9A-1, implemented)

Full protocol: docs/EXPERIMENT.md (pre-registration); machine-readable: experiments/protocol.js (hash recorded in every result file and in the held-out lock).

- **Games:** Quick (15 waves), five ablation style bots since amendment A2 (balancedR, noLance, noMortar, noPoison, noSniper; noFrost was dropped by calibration stage 3; own seeded random stream, knobs tilePool 6, focusWeight 0.3, upgradeAfter 4 calibrated in static mode only; the old focus styles stay in the code for archived data), three modes (static, adaptive, random), seed sets calibration 1001-1010, tuning 1001-1030, held-out 2001-2060.
- **Pipeline:** `npm run calibrate` -> `npm run experiment -- --set=tuning` (rows + CSV in docs/results) -> `npm run analyze` (paired seed-level differences, cluster bootstrap CI, sign-flip permutation p, Holm per family, effect sizes, power, tilt alignment). Every unit is validated; an incomplete data set is reported, never silently analyzed.
- **Held-out lock:** `npm run experiment -- --set=heldout --final --yes` writes experiments/heldout.lock.json before playing; a second run needs --new-lock and leaves an audit trail. The held-out set is not run before Phase 8B.
- **Amendment A1 (protocol version 2):** the final tilt is measured at the last ELIGIBLE wave for adaptive and random alike (`tiltObserved` flag); made after the tuning results were seen and before any held-out run; the v1 outputs are archived and `npm run amendment-report` compares the definitions. **Diagnostics** (`npm run diagnose`, static mode, tuning seeds) and **figures** (`npm run figures`, hand-written SVG) are described in docs/EXPERIMENT.md.
- **Phase 9A-2a tooling:** modes static, adaptive, random plus the research arms adaptive2 and counter (allowed for the tuning set only; the held-out run stays PROTOCOL.modes until amendment A3); the tuning seeds are split into TRAIN 1001-1020 and VALIDATION 1021-1030 (`--split=train|validation|all`; the validation split goes through its own lock experiments/validation.lock.json and has not been run); `npm run baseline` writes the Director v2 baseline table; result rows carry the JSON-only `tiltByWave`; `npm run first-look` compares all modes on the population of units whose static game reached wave 5, with a fixed-wave style contrast and coverage.
- **Phase 9A-2b-2 (amendment A3, protocol version 4):** PROTOCOL.confirmatory fixes, before the held-out run, the six confirmatory modes, the primary population (static game reached wave 5), the fixed waves (primary 9, secondary 5; the coverage rule was NOT met on training data, 70% at wave 9), the confirmatory family K1 (random > static in lives lost), K2 and K3 (fixed-wave style contrast of adaptive and adaptive2 at wave 9) with Holm, estimands with CIs only, sensitivity analyses and a held-out size of 150 seeds (2001-2150, 4500 games). `npm run plan-heldout` prints the plan; `npm run confirm` evaluates held-out rows only if set, protocol version, protocol hash and the lock runIndex match and never computes on incomplete data; a dry run on training data needs --dry-run and a 'dryrun' output name. The v3 exploratory hypotheses are unchanged (golden); PROTOCOL_PREVIOUS_HASHES lets the analysis CLI accept version 3 rows with a note. The full pre-registration is docs/EXPERIMENT.md 'Amendment A3'.
- **Phase 9A-2b-1 tooling:** six modes (the prior control joins; allowed for the tuning set only); goldens for every arm (static/adaptive/random, adaptive2/counter, prior); the CLI lock gate is exported as main(argv, deps) and covered by tests/cli-lock.test.js with stubs; `npm run first-look` adds the difficulty-attribution chain (random-static + prior-random + adaptive-prior = adaptive-static, checked per seed), the fixed-wave style contrast for adaptive, adaptive2, counter, prior and random with a matched-set sensitivity, the pre-registered fixed-wave rule (coverage counts only; written to <out>.fixedwave.json), tilt agreement and mean tilts.
- **Amendment A2 (protocol version 3, Phase 9A-1):** ablation styles replace the focus styles (each omits one tower; the prediction is the strongVs type of the missing tower); T1 (fixed-threshold tilt alignment, biased toward the random control) is retired and replaced by the style-contrast hypotheses T2 (adaptive minus random, secondary family) and T0 (random against 0, descriptive null check); the analysis adds an early-ends invariant check (the same units end before wave 5 in every mode), a reached-wave-5 sensitivity analysis of P1, P2 and C1, and the diagnostics add the reward contrast (does the reward itself separate defenses in the predicted direction, static mode). Made after seeing the tuning results of versions 1 and 2 and the Phase 8B diagnostics, before any held-out run. Calibration: 9 combinations in static mode, selection in up to three stages on the same results.
- Runs export through `attachTelemetry` ('summary' detail) and the CSV tables; experiments/directorCompare.js (`npm run compare`) remains as a small preview.

## 10. Coding Conventions

- `camelCase` for variables/functions, `PascalCase` only for factory-style constructors if used, `UPPER_SNAKE` for constants.
- `const` by default; no `var`.
- JSDoc on every exported function (params, return, one-line purpose).
- Comments explain *why*, not *what*.
- Unit tests (`node --test`) for every `src/sim/` module with logic worth testing (path following, damage/armor math, economy, wave budget, director update, rng determinism).
- Determinism test: same seed + same bot => identical results, always.
- No console spam in committed code; use a `debug` flag in `config.js`.

## 11. Working Protocol for Claude Code (EVERY session)

1. Read this whole file. Identify the current phase from Section 12.
2. Work ONLY on the current phase. Do not start the next one.
3. Before coding, give a short plan; if anything is genuinely ambiguous, ask the user before building.
4. Implement in small steps. Run the game/tests as you go (`npm start`, `npm test`).
5. Respect Section 4 rules. If a rule must change, stop, tell the user why, and log it in Section 13.
6. Do not add dependencies without asking.
7. VISUAL BAR: from Phase 2 onward a feature is not done until it follows Section 6B and has its juice effects. No placeholder rectangles after Phase 1B. At phase end, list 2-3 moments the user should screenshot or record into docs/screens/.
8. At the end of the phase:
   - Run all tests; fix failures.
   - Update the Phase Tracker (Section 12): tick completed items, set status.
   - Add entries to Decisions Log (13), Known Issues (14), Session Log (15).
   - `git add -A` and commit with message `phase-N: <short summary>`, then tag `phase-N-complete`.
   - Give the user a summary: what was built, how to run it, exactly what to check manually, known issues.
9. STOP and wait. Do not begin the next phase until the user says so.

## 12. Phase Tracker

Status key: [ ] not started, [~] in progress, [x] done

### [x] Phase 0 — Environment, repo, and project skeleton
- [x] Verify Node 22+, Git; init repo, `.gitignore`, `package.json` (scripts: start, test, sim)
- [x] Create folder structure from Section 5 (empty placeholder files where needed)
- [x] `index.html` + `main.js` that draws a blank canvas and logs "Siege Mind boot OK"
- [x] `npm start` serves the game locally; `npm test` runs a trivial passing test
- [x] Initial commit
**Done when:** `npm start` opens a blank canvas page with no console errors and `npm test` passes.

### [x] Phase 1A — Core engine (no art yet)
- [x] Fixed-timestep loop with x1/x2/x3 speed and pause, render interpolation alpha
- [x] Seeded RNG (rng.js) plus determinism test
- [x] Event bus
- [x] Tile map, path definition, buildable cells (data only, plain rendering is fine)
- [x] DPR-aware canvas scaling to window, debug HUD (FPS, tick count)
**Done when:** loop, pause, speed, and RNG determinism tests pass and a plain map renders at 60 FPS. Tag: phase-1a-complete.
Debug scene and walkers are temporary; replaced in Phase 1B (visuals) and Phase 2 (real enemies).

### [~] Phase 1B — Visual foundation and UI kit
- [x] src/render/theme.js (palette, tokens, easing), fonts vendored (or fallback), src/ui/style.css with matching CSS variables
- [x] Layered renderer with cached static background (grid, vignette), glowing path with animated flow, subtle ambient animation
- [x] Glow sprite cache and additive-blend helpers
- [x] Pooled particle system with quality tiers and caps; tween/easing utilities; floating text
- [x] UI kit: HUD top bar skeleton (gold, lives, wave), panels, buttons, tooltips, inline SVG icon set
- [x] Quality settings (Low/Med/High, auto-downgrade), reduced-motion and screen-shake toggles
- [x] gallery.html style gallery page
**Done when:** the map looks on-style at 60 FPS, the gallery page shows every component, and the user approves the look. Tag: phase-1b-complete.
Implemented; awaiting user visual approval, then tag phase-1b-complete. (Not verified in a real browser by Claude: the Chrome extension was not connected.)

### [~] Phase 2 — Enemy system
- [x] Path-following movement with `pathProgress` tracking
- [x] 5 enemy types from `data/enemies.js` (HP, speed, armor, regen, shield, pack spawn)
- [x] Damage model (armor, shield, DoT immunity rules), death and leak events
- [x] Health bars/placeholder visuals; debug spawner (keys to spawn each type)
- [x] Enemies drawn procedurally per Section 6B (distinct silhouette and color per type), spawn-in, hit flash, death burst, leak effect, floating damage/gold numbers (toggle)
**Done when:** all 5 enemy types walk the path, behave per spec, and leak/die with correct events; unit tests for damage math.
Implemented; awaiting user visual check, then tag phase-2-complete. (Not run in a real browser by Claude: the Chrome extension was not connected.)

### [~] Phase 3A — Tower logic, economy core, placement UI (temporary tower glyphs)
- [x] Gold economy core (earn/spend/events), tower costs, 2 upgrade levels, 70% sell refund
- [x] Pure tower logic: placement rules, targeting (first, strongest, closest), firing, upgrades, selling
- [x] 5 towers with bolts, shells, pulses, hitscan and poison (pierce, splash, slow, stacking poison + regen stop, sniper shield bonus), deterministic (no rng)
- [x] Projectiles (homing bolts, ballistic shells) and impact events; kill/damage attribution to towers
- [x] Headless matchup harness (experiments/matchups.js) and counter-relationship tests R1-R7
- [x] Placement and selection UI: build tray, hotkeys, placement ghost, range rings, tower panel (targeting, upgrade, sell), tooltips
- [x] Debug features gated behind ?debug=1
**Done when:** each tower type counters/loses to the enemies in Section 6 (tested by the matchup harness) and a human can build, upgrade and sell towers.
Implemented; awaiting user visual/gameplay check, then tag phase-3a-complete. (Not run in a real browser by Claude: the Chrome extension was not connected.)

### [~] Phase 3B — Tower art, projectiles and juice
- [x] Final procedural tower art with a distinct silhouette per tower (not just color), visible upgrade levels (shape additions plus a tier mark), rotation with recoil, muzzle flash, sniper charge
- [x] Projectile trails per type (lance comet tail, poison blob and drips, mortar arcing shell with shadow and smoke) and a distinct impact effect per tower (Mortar shockwave + scorch decal, Frost ice shards and pulse rings, Poison cloud, Sniper laser beam, Lance piercing streak)
- [x] Build-in animation and sell dissolve, upgrade flash, bolder slow-ring and poison-dot status overlays (tinted body, haze, bubbles, status icons)
- [x] Gallery section showing every tower at all three levels (live, with real fx) plus the colorblind check (enemy and tower accent tables)
- [x] UI overlap fix, z-index tokens, debug panel hidden by default
- [x] Stress mode (?debug=1&stress=1: 40 towers, spawn every 3 ticks)
- [ ] Performance check with 40 towers in a real browser (stress mode is ready; not measured because no browser was available)
**Done when:** each tower is recognizable by silhouette alone, every shot has feedback, and 40 towers plus 150 enemies hold 60 FPS.
Implemented; awaiting user visual check, then tag phase-3b-complete. (Not run in a real browser by Claude: the Chrome extension was not connected.)

### [x] Phase 4A — Rules and wave system (functional UI)
- [x] Auto-spawner is debug-only (?debug=1&spawn=N)
- [x] Lives, leaks costing lives, defeat; clearing wave 30 wins; game freeze on game over
- [x] 30-wave static script with a threat-budget curve and a pure builder (STATIC_THREAT for the future Director)
- [x] Wave runner: manual first wave, auto intermissions, early start, clear bonus, WAVE_STARTED/WAVE_ENDED/GAME_OVER
- [x] Run statistics from events
- [x] Functional wave control (Start Wave / Enter), HUD lives and wave, functional end screen with retry and new seed
- [x] Bots (none, balanced), headless playthrough, difficulty calibration with tests T1/T2
**Done when:** a human can play wave 1 to 30 in Static Mode start to finish with a real win/lose.
Done (tagged phase-4a-complete). (Not run in a real browser by Claude: the Chrome extension was not connected.)

### [x] Phase 4A.2 — Difficulty rework
- [x] Enemy HP and shield scale with the wave (exponential or polynomial curve, plain-arithmetic table); armor, rewards, threat costs stay flat
- [x] Regeneration heals a fraction of BASE HP (approved reversal of the scaled-HP rule)
- [x] Tower prices grow with towers owned; cap 60; getTowerCost used by placement, bots and the tray
- [x] Bot ladder: none, weak, balanced; playthrough with hpMult and seconds per wave
- [x] Calibration against the ladder (tests/balance.test.js T1-T4, T5', T6, T7')
- [x] UI: price in the tray (pure trayState), HP multiplier in the wave control and debug panel
**Done when:** the ladder test passes and the opening/mid game is playable.
Done (covered by the phase-4a-complete tag).

### [~] Phase 4B — Presentation
- [x] Part 0: test tightening (original T7 and T5 with 3 loss waves restored; passes at the current config)
- [x] Quick game option (15 waves, game.totalWaves / maxLives / waveLog, getWavePreview), 30-wave results unchanged
- [x] Styled main menu: mode select (Adaptive shown locked until Phase 6), game length, seed entry, how to play
- [x] Pause menu (Esc) with two-click Restart and Quit; single Escape resolver; pause locks
- [x] Animated wave banner with composition icons; countdown ring; incoming-wave preview
- [x] Base core with four damage states, destroyed and victory animations
- [x] Animated victory and defeat screens with a wave-by-wave strip
- [x] Gallery section 4b (core states, banner, end screens)
**Done when:** the game feels finished from first screen to last.
Implemented; awaiting user playtest, then tag phase-4b-complete. Checked in headless Chrome (screenshots and scripted interaction), not by a human.

### [~] Phase 5 — Telemetry layer
- [x] Event-bus collector for per-enemy, per-tower, per-wave data (Section 8), observation only, deterministic
- [x] Schema module, validateRun, JSON and four CSV tables, docs/TELEMETRY.md (docs test checks every column)
- [x] Headless tooling: playthrough --telemetry / --out, npm run summarize
- [x] UI: download buttons on the end screen and pause menu, debug panel counters
- [x] Browser-check dev tool (tools/browser-check: check, smoke) outside npm test
**Done when:** after any run, a complete telemetry object exists and exports cleanly.
Implemented; awaiting user check, then tag phase-5-complete.

### [~] Phase 6 — Adaptive Director AI
- [x] Shared wave composer with a deterministic fit step; golden test proves the static waves are unchanged
- [x] `director.js` and `directorMath.js` implementing Section 7 with hyperparameters in `config.director`
- [x] Fixed special waves, intro waves and early waves stay static; fairness invariants tested (same threat within tolerance, same HP multiplier)
- [x] Random control mode sharing the machinery; Director unit and integration tests (math, observation, cold start, determinism, purity)
- [x] Decision records in WAVE_STARTED and telemetry; docs/DIRECTOR.md
- [x] Modes in the menu and URL, Director line in the banner and preview, debug line, end screen mode row
- [x] Bots monoMortar and monoSniper, playthrough --mode, compare tool with report-only hypotheses
**Done when:** in Adaptive Mode, waves visibly shift toward whatever the loadout handles worst, with equal total threat to Static.
Implemented; awaiting user check, then tag phase-6-complete.

### [~] Phase 7 — Explainability overlay and mode UI
- [x] Live overlay: weight bars, template to final shares, last-wave evidence, plain-language lines, mini tilt chart (hand-built SVG, no Chart.js)
- [x] Menu toggle Static/Adaptive (Phase 6); overlay hotkey I and a HUD button
- [x] Wave preview bar (Phase 4B) with direction marks; banner direction marks
- [x] Reads the decision records (WAVE_STARTED.director, decision log, telemetry waves[n].director); end card and report positioned below the HUD strip
- [x] Director identity in violet: overlay, scan sweep on adapted waves (one short fade in reduced motion), direction triangles
- [x] The Director's Report (insights, tilt chart, composition strip, per-type table) from the end card
- [x] Gallery section 7 Director with a recorded fixture; window.__siege debug handle (debug only); browser-check smoke extended
**Done when:** a viewer can watch the overlay and understand why each wave changed.
Implemented; awaiting user check, then tag phase-7-complete.

### [x] Phase 8A — Experiment harness
- [x] Pre-registered protocol (docs/EXPERIMENT.md, experiments/protocol.js with a hash)
- [x] Five style bots with their own seeded random stream; calibration in static mode only (chosen knobs recorded)
- [x] Metrics, batch runner with result files and identity (code hash, git commit), deterministic output
- [x] Statistics and analysis (sign-flip test, cluster bootstrap, Holm, Wilson, power) with text and markdown reports
- [x] Held-out lock (pure decision logic plus CLI); the held-out set has NOT been run
- [x] One exploratory run on the tuning set, results committed under docs/results
- [x] Director's report footnote and insight cap fixes
**Done when:** one command reproduces the tuning comparison and the analysis is deterministic.
Done (tagged phase-8a-complete).

### [x] Phase 8B — Amendment, diagnostics and figures
- [x] Amendment A1: final tilt at the last eligible wave (tiltObserved), protocol version 2; v1 outputs archived; the tuning set re-run (every non-tilt column identical)
- [x] Amendment report (legacy versus A1) and diagnostics of the reward signal in static games
- [x] Six report-ready figures as hand-written SVG with an index page
- [ ] The held-out run through the lock (npm run experiment -- --set=heldout --final --yes), moved to Phase 9B
- [ ] A Full-length (30-wave) confirmatory run on the first 20 held-out seeds, moved to Phase 9B
- [ ] The final results write-up, moved to Phase 9B
Done (tagged phase-8b-complete).

### [x] Phase 9A-1 — Experiment redesign
- [x] Early-loss check (earlyLosses.js) and style-contrast statistic (contrast.js) tried on the archived focus-style data (exploratory, post-hoc)
- [x] Amendment A2 (protocol version 3): ablation styles, T1 retired, T2 and T0 added, sensitivity analysis and early-ends check in the analysis
- [x] Static-mode recalibration of the ablation styles (stage 3: noFrost dropped; tilePool 6, upgradeAfter 4)
- [x] Focus-style outputs archived; tuning set re-run with Director v1 as the "before"
- [x] Diagnostics refreshed incl. the reward contrast
Done (tagged phase-9a1-complete); nothing under src/ changed.

### [x] Phase 9A-2a — New arms and first look
- [x] Golden pin of static, adaptive and random (tests/golden-modes.test.js) and a train/validation split with a validation lock (not run)
- [x] Static baseline table from train-seed games (npm run baseline -> src/data/directorBaseline.js)
- [x] Director v2 ('adaptive2': baseline-normalized rewards, shrinkage) and the informed counter arm ('counter'), initial parameter values, nothing tuned
- [x] Runner, metrics (tiltByWave), minimal UI for the arms (URL only) and the first-look tool
- [x] First look on the TRAIN seeds (500 games, exploratory)
Done (tagged phase-9a2a-complete).

### [x] Phase 9A-2b-1 — Prior control and six-mode first look
- [x] Goldens for adaptive2/counter and the prior, CLI lock gate tests with stubs, incident record
- [x] Prior control arm ('prior': fixed weights from the static baseline, no learning, no defense)
- [x] First-look attribution chain with an exact identity, fixed-wave rule (counts only), tilt agreement, matched-set sensitivity
- [x] Six-mode first look on the TRAIN seeds (600 games, exploratory, nothing tuned)
Done (tagged phase-9a2b1-complete).

### [~] Phase 9A-2b-2 — Amendment A3 (protocol v4) and confirmatory analysis code
- [x] Amendment A3 in experiments/protocol.js (version 4, held-out 150 seeds, six confirmatory modes, PROTOCOL.confirmatory, PROTOCOL_PREVIOUS_HASHES), v3 hypotheses pinned by a golden
- [x] Confirmatory analysis code (K1-K3 with Holm, estimands, contrasts, coverage, sensitivity, post hoc power), confirm CLI, plan-heldout tool, checkProtocolHash, requiredN at the Holm level
- [x] Dry run on the TRAIN rows (exploratory; did not change the plan)
- [x] Pre-registration document: docs/EXPERIMENT.md 'Amendment A3'
Implemented; awaiting user check, then tag phase-9a2b2-complete (this is the freeze of the confirmatory plan).

### [ ] Phase 9B — Held-out evaluation and final figures
- [ ] Check the freeze: tag phase-9a2b2-complete exists, `git status` clean, experiments/heldout.lock.json absent
- [ ] `npm run plan-heldout`
- [ ] `npm run experiment -- --set=heldout --final --yes` (150 seeds x 5 styles x 6 modes, once, through the lock)
- [ ] `npm run confirm -- --in=docs/results/heldout.rows.json --out=docs/results/heldout-confirmatory`
- [ ] Regenerate the figures for the new modes and styles (the figure builders still target protocol version 2 and must be updated)
- [ ] The write-up

### [ ] Phase 9C — Polish, audio and balance
- [ ] Balance pass using harness data
- [ ] Procedural WebAudio SFX plus optional music
- [ ] Performance profiling against Section 2 criterion 8
- [ ] Accessibility pass (colorblind check, reduced motion)
- [ ] Final visual tuning in the gallery
- [ ] Tutorial/tooltips
- [ ] Settings screen
- [ ] Late-game gold sink (for example a third upgrade tier): the balanced bot ends 30-wave games with thousands of unspent gold
- [ ] Separate early and late HP-curve slopes (lives are only lost in waves 2-10 today)
- [ ] Quick-mode finale wave (wave 15 is an ordinary wave in a Quick game)
- [ ] Re-check the 60% worst-wave-share clause of T5 that Phase 4A.2 dropped
- [ ] Wave control and end-card polish if the user finds issues
- [ ] Rebalance after Phase 8 data: the Mortar deals about a third of all damage; recalibrate the static guard (npm run calibrate) after any balance change
**Done when:** the game feels good to play for 15+ minutes and balance data supports it.

### [ ] Phase 10 — Docs, deployment, and demo
- [ ] README (what, why, how to run, architecture diagram, screenshots/GIFs)
- [ ] `docs/DEMO_SCRIPT.md` (side-by-side Static vs Adaptive demo)
- [ ] `docs/REPORT_NOTES.md` (method, DDA background, results, limitations, future work)
- [ ] Deploy (GitHub Pages or Vercel), final regression test, tag `v1.0`
- [ ] .github/workflows/test.yml running npm test on push, README GIFs and screenshots in docs/screens/, architecture diagram, report figures from Phase 8
**Done when:** public URL works and all Section 2 success criteria are met.

## 13. Decisions Log
<!-- Format: YYYY-MM-DD | Phase | Decision | Reason -->
- Project start | Stack fixed to vanilla JS + Canvas + Chart.js; sim/render separation, fixed timestep, and seeded RNG chosen so headless experiments (Phase 8) reuse the real game code.
- 2026-10-16 | 0 | Dev server is zero-dependency `scripts/serve.js` (node: built-ins only) on port 8137; 403 on path traversal, 404 on missing files | Keeps "no runtime deps" rule; simple and portable
- 2026-10-16 | 0 | `npm test` script is `node --test "tests/**/*.test.js"` instead of `node --test tests/` | Node 24 treats a bare directory arg as a module and fails; quoted glob works on Node 22+ and Windows
- 2026-10-16 | 0 | Placeholder modules under src/sim, src/data, experiments/bots.js contain only a comment + `export {};` | Valid ES modules until their phase
- 2026-10-18 | 0 | Dev server default port 8137, override with PORT env var (integer 0-65535) | Vite default 5173 collides with other local projects
- 2026-10-18 | 0 | Dev server binds both 127.0.0.1 and ::1 (never 0.0.0.0); ::1 failure with EADDRNOTAVAIL/EAFNOSUPPORT is ignored | On Windows localhost may resolve to IPv6 first and hit a different server
- 2026-10-18 | 0 | Node 22+ required (package.json engines) | Glob patterns in node --test need it
- 2026-10-18 | 0 | serve.js exports createStaticServer(rootDir) and only listens when run directly; covered by tests/serve.test.js (traversal cases) | Testable without opening a fixed port
- 2026-10-18 | 1A | Stepper: pure accumulator (no clocks), frame time clamped to 0.25 s, max 12 steps/frame (excess backlog discarded), speed multiplies accumulated time so the step stays 1/60 s | Prevents the spiral of death and keeps the sim deterministic at x1/x2/x3
- 2026-10-18 | 1A | RNG: mulberry32 with string seeds, getState/setState and fork(label) independent streams derived only from seed+label | The future Director's randomness will not shift when combat code consumes more numbers
- 2026-10-18 | 1A | Event bus is strict by default (unknown types throw); listener lists are copy-on-write; a throwing handler never stops others | Catches typos early; emit never allocates and unsubscribing mid-emit is safe
- 2026-10-18 | 1A | Map is 20x10 with an 80 px HUD strip (changed from 20x11); sim origin is the map's top-left, only the renderer adds the HUD offset | The HUD is a DOM overlay that would cover the top row of an 11-row map
- 2026-10-18 | 1A | Sim purity enforced by tests/sim-purity.test.js (no DOM, clocks, localStorage or Math.random in src/sim) | Makes Architecture Rules 1 and 3 permanent
- 2026-10-18 | 1A | .gitattributes forces LF (`* text=auto eol=lf`) | Stops Windows CRLF churn in diffs
- 2026-10-18 | 1A | Dev controls: Space pause, 1/2/3 speed, N single-step while paused, backquote toggles debug HUD; tab hidden auto-pauses without auto-resume | Needed to inspect the loop before real UI exists
- 2026-10-18 | 1A | validateMap checks grid size against config.world (cols x rows) rather than only internal consistency; createMap/validateMap take only the map def | Keeps map data and config from silently disagreeing
- 2026-10-18 | 1A | Default seed when no ?seed= is a random 32-bit value from crypto.getRandomValues (render layer only; sim never calls Math.random) | Each page load differs; seeds can be replayed via the URL
- 2026-10-18 | 1B | Fonts vendored from @fontsource/rajdhani 5.3.0 and @fontsource/inter 5.3.0 (npm pack in a temp dir, latin woff2, SIL OFL 1.1), 119 KB total | Offline demos, no CDN; no package.json dependency added
- 2026-10-18 | 1B | DOM UI is authored in 1280x720 logical px inside #ui-root and scaled with the stage (transform scale = fit.cssScale, not fit.scale, which includes DPR) | Canvas and DOM share one coordinate system
- 2026-10-18 | 1B | Static layer cached at backing resolution, rebuilt on size/dpr/tier/map change at most every 150 ms (shouldRebuild); old canvas is scaled in between | Resize stays cheap, no per-frame background cost
- 2026-10-18 | 1B | Spawn portal is drawn in Director violet | The Director sends the waves
- 2026-10-18 | 1B | Quality tiers Low/Medium/High; auto-downgrade only (one tier after FPS < 45 for 3 s, 10 s cooldown), never upgrades; first sample after start/reset seeds the FPS average | Avoids oscillation; fast reaction on a bad start
- 2026-10-18 | 1B | Backing-pixel budget 3686400 (2560x1440): dpr reduced, never below 1 | Bounds fill cost on large/hi-dpi displays
- 2026-10-18 | 1B | Settings persisted in localStorage under siegeMind.settings.v1 through an injectable storage (only settings.js and one try/catch line in main.js touch it) | Testable, safe when storage is blocked
- 2026-10-18 | 1B | CSS/theme parity enforced by tests/theme.test.js (style.css :root must equal cssVariables()); :root was generated from theme.js once | theme.js and CSS cannot drift
- 2026-10-18 | 1B | ticks/s reading of 34 at x1: measurement artifact. The Phase 1A meter divided a count over a fixed 1 s window that also contained paused/hidden time. Replaced by render/perf.js (bucketed rate meter reset on resume, ticks only counted while running) plus a "sim speed" readout (ticks/s x step) that should read 1.00 / 2.00 / 3.00 | Stepper tests already prove 60/120/180 steps per simulated second
- 2026-10-18 | 1B | createGame accepts debugSpawnEveryTicks (default config.debug.walkerSpawnEveryTicks) for ?spawn=N stress tests; sim stays pure | Only sim change in 1B
- 2026-10-18 | 1B | Tower accent colors: lance primary, mortar secondary, frost whiteHot, poison tertiary, sniper primary; danger red #ff4d5e (6.07:1 on bg0); palette passed all contrast and deltaE>=25 tests unchanged | Section 6B starting palette held up
- 2026-10-18 | 1B | Font URLs in style.css are relative (../../assets/fonts/) instead of absolute /assets/fonts/ | Keeps working under a GitHub Pages sub-path
- 2026-10-18 | 1B | renderer.draw(game, alpha, dt, time, paused): extra paused flag freezes fx; renderer.handleClick does the dev click effect; waypoints for the static layer come from DEFAULT_MAP | Keeps main.js wiring-only; sim map object stays unchanged
- 2026-10-18 | 1B | Gallery splits into src/gallery.js and src/galleryStatic.js; effects lab and map preview each run a full renderer on a shared quality controller | Module size limit; same code path as the game
- 2026-10-18 | 2 | Damage model: armor is flat with a 20% floor (effective = max(dmg - armor, 0.2 * dmg)); shield absorbs first, shieldMult converts shield damage (shieldDamage = min(shield, dmg * mult), overflow = dmg - shieldDamage / mult) and armor applies only to the overflow; DoT ignores armor and is fully blocked while a shield with shieldBlocksDot is up | Gives each tower a clear counter relationship (Section 6)
- 2026-10-18 | 2 | Statuses (slow, stacking poison, regeneration suppression) implemented now; Phase 3 towers only call applyStatus / applyDamage | Towers stay thin
- 2026-10-18 | 2 | DoT damage events are aggregated: damage accrues in enemy.dotAcc and one ENEMY_DAMAGED (kind dot) is emitted every 15 ticks, flushed immediately before a kill or leak | Keeps the event stream and floating numbers sane (4 per second per poisoned enemy, not 60)
- 2026-10-18 | 2 | Enemy list uses stable write-index compaction instead of swap-remove | Draw order must not flicker when enemies die
- 2026-10-18 | 2 | Lanes come from a forked rng stream (rngs.lane), offset = rand(-1,1) * (laneMax 10 - radius * 0.3) | Enemies spread across the path width without disturbing other streams
- 2026-10-18 | 2 | path.sampleAt blends heading and lateral normal across each corner (smoothstep over +/-40 units, shortest arc); positionAt unchanged | Lane-offset enemies move continuously around hairpins
- 2026-10-18 | 2 | Hit flash derives from lastHitTick and spawn scale from spawnTick; no render-side per-enemy state | Renderer stays stateless and deterministic
- 2026-10-18 | 2 | HUD gold and lives intentionally not wired to kills/leaks until Phase 4 | Economy does not exist yet
- 2026-10-18 | 2 | Initial enemy stats (hp/speed/armor/regen/shield/pack/threat/reward/leak): grunt 120/55/6/-/-/1/10/10/1, swarmling 28/70/0/-/-/8 every 12 ticks/3/2/1, fast runner 45/130/0/-/-/1/8/6/1, regenerator 260/45/1/2% per s/-/1/16/16/2, bruiser 220/38/3/-/160 (blocks DoT)/1/24/24/3 | Starting point, retuned in Phase 9 from harness data
- 2026-10-18 | 2 | Debug tools: spawn keys Q W E R T (Y one of each, K nuke), tool keys Z direct40, X pierce40, C sniper60, V poison, B frost, M splash25; click applies the selected tool through applyDamage/applyStatus; ?spawn=N sets the placeholder auto-spawner interval in ticks (0 = off, default 90) | Lets Phase 3 counters be verified by hand
- 2026-10-18 | 2 | maxEnemies cap 600; spawnEnemyNow returns null at the cap | Bounds sim and render cost (Section 2 criterion 8 asks for 150+)
- 2026-10-18 | 2 | queueEnemy delayTicks counts from the NEXT step (atTick = tick + 1 + delay + i * interval) instead of tick + delay | With tick + delay a pack queued between steps spawned its first unit one tick late, giving uneven spacing (11 vs 12 ticks)
- 2026-10-18 | 2 | Added theme color gold #ffc94a (HUD gold chip and floating +reward, contrast >= 3 on bg0) mirrored in style.css | No gold token existed
- 2026-10-18 | 2 | enemy.type is already the shapes.js type id, so enemyRenderer needs no mapping table; renderer.draw/handleClick keep Phase 1B signatures; fxEvents handlers use a 256-slot Float32Array for damage-number rate limiting | Fewer moving parts
- 2026-10-18 | 3A | Phase 3 split into 3A (logic, economy core, placement UI with temporary glyphs) and 3B (art and juice) | Logic and balance can be verified headlessly first; art follows once the rules are stable
- 2026-10-18 | 3A | Gold economy moved into 3A (earn on kill, spend on build/upgrade, refund on sell, GOLD_CHANGED event) | Towers cannot be built without it; lives/waves/win-lose stay in Phase 4
- 2026-10-18 | 3A | Upgrade multipliers are absolute per level (not compounding); frost slowFactor is an absolute override; poison scales dps with dpsMult | Easy to read and to tune in data
- 2026-10-18 | 3A | Sell refunds floor(0.7 * total invested including upgrades) | Section 6 spec
- 2026-10-18 | 3A | Shells fly to where the target WAS at fire time (no lead prediction) | This is what makes fast enemies a counter to the mortar
- 2026-10-18 | 3A | Frost is a pulse tower: it hits everything in range, slow first then damage, and only fires when something is in range | No targeting mode; supports all other towers
- 2026-10-18 | 3A | Poison is a homing bolt that poisons the target plus enemies inside a cloud radius at the impact point | Cheap area flavor without a persistent cloud entity
- 2026-10-18 | 3A | Tower logic is fully deterministic: no rng at all (ties go to the lowest enemy id) | Keeps replays and the harness exact
- 2026-10-18 | 3A | Enemies cache their world x/y every step; derived id index (game.enemyIndex Map, not serialized) rebuilt only when something dies or leaks | Targeting and queries avoid path sampling
- 2026-10-18 | 3A | Attribution: damage packets carry towerId; ENEMY_DAMAGED/KILLED payloads carry towerId and source (tower type); enemy.poisonTowerId credits DoT damage and DoT kills to the latest poisoner | Per-tower damage and kill counters, later telemetry
- 2026-10-18 | 3A | Step order is enemies, projectiles, towers: a projectile fired this tick starts moving next tick | Deterministic and easy to reason about
- 2026-10-18 | 3A | Debug spawn/nuke/tool keys, click test effect and ?gold are gated behind ?debug=1; the random auto-spawner stays on by default until Phase 4 waves (?spawn=0 turns it off) | Normal play shows only player features
- 2026-10-18 | 3A | Swarmling packIntervalTicks 12 -> 16 (bodies visible); tests already read the value from data | Visual readability
- 2026-10-18 | 3A | Data changes to satisfy matchup relations R1-R7 (initial towers.js values were not satisfiable): Lance damage 28 -> 24 and interval 30 -> 54 (R2: at 28 dmg / 30 ticks the lance one-shots every swarmling in its long exposure window and kills all 8; R4 also needed frost to matter); Mortar projectileSpeed 260 -> 240 and splashRadius 70 -> 60 (R3: runners must out-run the shell); Sniper intervalTicks 150 -> 210 (R7: with 150 it still killed 8 of 8 swarmlings thanks to its 320 range). Lance role text no longer says "fast". Other values unchanged | The assertions were not changed; only data
- 2026-10-18 | 3A | R3 is asserted on spaced streams (spacingTicks 120) not the default 20: in a dense stream a shell aimed at the leader always catches a follower inside the splash, so any dense stream has ~100% "hit" rate no matter how fast the enemies are. The assertion itself (runner hit rate < half the grunt hit rate) is unchanged | The relation is under-specified about spacing; flagged to the user
- 2026-10-18 | 3A | Harness primary tile is (15,2): the buildable tile with the most path inside Lance range, computed once; helpers go on the nearest buildable tiles | Same position for every pass
- 2026-10-18 | 3A | New LINE particle kind (a static additive segment) draws the sniper tracer instead of many streak particles | One particle per beam
- 2026-10-18 | 3A | Tooltip body rendered with textContent and white-space: pre-line (multi-line, no innerHTML) | Safe multi-line tower info
- 2026-10-18 | 3B | UI overlap fix: the debug panel is hidden by default (config.debug.showHud false), centred at the bottom, pointer-events none; z-index tokens --z-canvas..--z-modal live in theme.js tokens and the style.css :root (parity-tested) and a test rejects raw z-index numbers; user-select none on the stage; the tower panel size/margin come from config.ui and its position from the pure placeTowerPanel (bottom-left, bottom-right, top-left, top-right, opposite side first) | The panel's Upgrade/Sell were hidden under the debug text; double click selected text
- 2026-10-18 | 3B | Animations derive from sim state wherever possible: build-in from builtTick, recoil/flash from the cooldown, charge from cooldown + targetId (all in the pure towerAnim); only two render-side Maps remain (smoothed aim angle, last upgrade time), created lazily, deleted on TOWER_SOLD | Turret turn rate and upgrade flash are not sim facts; everything else replays identically from a snapshot
- 2026-10-18 | 3B | The mortar shell arc is visual only (shellArc uses ox/oy/flightDistance); the sim still moves shells in a straight line | Keeps hit detection exact and simple
- 2026-10-18 | 3B | Lance comet tails are stateless (drawn from the velocity direction each frame) | No per-projectile render state
- 2026-10-18 | 3B | Status tints come from a table precomputed at load (tint.js); no color mixing at draw time. Slow tints toward the Defense blue (secondary) rather than the near-white frost accent | A near-white tint on a dark body is barely visible
- 2026-10-18 | 3B | Stress mode (?debug=1&stress=1): 40 towers via applyStress (round-robin types, even tile spacing, every 4th upgraded to level 2), startGold 1e6, spawn every 3 ticks unless ?spawn= | Repeatable performance scenario
- 2026-10-18 | 3B | Sim addition: projectiles carry ox, oy and flightDistance (also in snapshots); PROJECTILE_IMPACT carries angle (travel direction); TOWER_SOLD carries level (so the sell ghost can draw the right shape) | Needed by the visuals; no behaviour change, determinism tests unchanged
- 2026-10-18 | 3B | TOWER_VISUALS keys are generic per tower (trailLength, shellArcHeight, dripEverySeconds, streakLength, ringSeconds, scorchSeconds, cloudSeconds, shardCount, beamSeconds) with 0 for unused; config.fx gained decalCapacity 12, beamCapacity 16, ghostCapacity 24, statusTintAmount 0.25, shellScaleGain, shellShadowShrink | Every key exists for every tower
- 2026-10-18 | 3B | Envelope rule in tests: barrelLength is measured from the tower centre, so the envelope is max(bodyRadius, barrelLength) (+4 slack for plates/rings/flasks), not their sum; with the specified values the sniper (20 + 36) could not satisfy a sum limit of 48 | Resolved an inconsistency in the spec
- 2026-10-18 | 3B | The sniper beam is drawn from a fixed pool (beams.js style core + wide line); the LINE particle from 3A remains for other uses; frost shards are STREAK particles with a per-tick budget (4/10/20 by tier) | Pulse hitting 20 enemies stays within the particle caps
- 2026-10-18 | 3B | Shape distinctness is tested with a silhouette descriptor (aspect, 8-sector radial profile, barrel length, mean radius, part count); the closest pair of different towers at any level is poison/sniper at 0.148 and the threshold is 0.08 | Guarantees no two towers can look alike
- 2026-10-18 | 4A | Phase 4 split into 4A (rules, waves, functional UI, calibration) and 4B (menus, banner, preview, core damage states, animated end screens) | Rules and difficulty can be verified headlessly first
- 2026-10-18 | 4A | The random auto-spawner is debug-only (config.debug.autoSpawnEveryTicks 0; ?debug=1&spawn=N) | Enemies now come from waves
- 2026-10-18 | 4A | Static waves are generated from hand-authored templates of threat shares by a pure builder (floors, one pick per present type when affordable, then largest remainder while it moves the total closer to the budget); STATIC_THREAT is the realized threat and is the budget the Adaptive Director must spend | Equal-threat fairness invariant holds exactly against what Static actually sends
- 2026-10-18 | 4A | Intro schedule: grunts 1, swarmlings 3, runners 4, regenerators 6, bruisers 8; fixed waves 10 'The Vanguard', 20 'Tide of Swarm', 30 'The Siege' | Section 6 spec
- 2026-10-18 | 4A | Pacing: wave 1 waits for the player; later waves auto-start after 20 s; early start allowed, no early-call bonus; clear bonus 20 + 4w | Player controls the first wave, then the flow keeps moving
- 2026-10-18 | 4A | Lives, stats and waves are wired in the order economy, stats, waves, lives so the final leak is counted before lives can end the game; after GAME_OVER stepGame is a no-op, interpolation is frozen (also at the end of the ending step) and the UI passes alpha 0 | Nothing keeps sliding after the end
- 2026-10-18 | 4A | Restart is a page reload with the seed in the URL (Retry same seed / New seed); every other URL parameter is preserved | No in-place reset code to keep in sync
- 2026-10-18 | 4A | CALIBRATION: only config.waves.budgetScale was changed (spec rule). Runs with seed 1 (balanced bot; lives left): 1.0 -> 20, 1.5 -> 20, 2.0 -> 19, 2.52 -> 16, 3.0 -> 15, 3.2 -> 13, 3.4 -> 12, 3.6 -> 12, 3.8 -> 10, 4.0 -> 10, 4.5 -> 3, 5.0 -> 3, 5.04 -> 3, 5.5 -> lost at wave 2, 6 -> lost at wave 2, 8 -> lost at wave 1. The valid window for T2 (1-14 lives) is about 3.2-5.0; chose 3.6 (12 lives). The 'none' bot loses at wave 2 at every scale tried from 1.0 (T1 holds). Final budgetScale 3.6, bonus constants unchanged (20 + 4w) | See Known Issues for what this calibration does NOT achieve
- 2026-10-18 | 4A | The brief's "every wave spawns within 60 s" cannot hold at the calibrated scale: with the minimum gaps (runner 1 s, swarm 2 s) the big runner/swarm-heavy waves need up to ~340 s. The test asserts the rule that is actually true: each group's gap is max(window / picks, minimum gap) and a wave only spans more than 60 s when a minimum gap forces the stretch | Flagged to the user; the waves still spawn every enemy, just over a longer time
- 2026-10-18 | 4A | Bots: 'none' and 'balanced' (deterministic, act only through sim commands, rank tiles with experiments/tiles.js shared with the matchup harness); Phase 8 extends experiments/bots.js | Calibration and later experiments use the same commands as a player
- 2026-10-18 | 4A | Wave control sits bottom centre (config.ui), the debug panel moved to the top centre below the HUD, z-overlay token 55 added for the end screen | Overlap-free layout verified by test
- 2026-10-18 | 4A | createGame accepts wavesConfig (overrides config.waves for one game, used by tests) and startWave/startLives (debug URL only); mode validated: 'adaptive' throws, unknown values throw RangeError | Testability and the Phase 6 hook
- 2026-10-19 | 4A.2 | Why the first 4A calibration was wrong: scaling only the threat budget made wave 1 a cliff (the balanced bot lost every life it lost in wave 1) and left waves 2-30 trivial (zero leaks, 60,000 unspent gold). It is replaced by a LADDER of three bots (none, weak, balanced) whose targets T1-T7 check the shape of the difficulty, not just win/lose | A single win/lose number cannot show a flat curve
- 2026-10-19 | 4A.2 | Enemy HP and shield scale with the wave while armor, speed, rewards, leak damage and threat costs stay flat. Threat accounting stays in base units and the multiplier is the same function in Static and Adaptive mode, so the equal-threat fairness invariant is untouched | Difficulty grows without changing economy or the Director's budget
- 2026-10-19 | 4A.2 | Regeneration heals 2% of BASE HP per second (reverses the first 4A.2 rule that healed a percentage of scaled max HP): with scaled max HP, healing grew together with the multiplier and a regenerator-heavy wave 24 ended every run in one wave | Removes the wall; the HP curve alone sets the difficulty
- 2026-10-19 | 4A.2 | Tower price growth 3% per tower owned and a cap of 60 (was 80): late game gold is no longer unlimited | Gold has to matter after wave 15
- 2026-10-19 | 4A.2 | The 'weak' bot (Lance only, at most 12 towers, never upgrades, same rhythm as balanced) anchors the lower rung of the ladder; Phase 8 extends the ladder with the planned strategy bots | A level-appropriate loss target
- 2026-10-19 | 4A.2 | CALIBRATION RESULT: STAGE C (LAST RESORT) WAS USED (Phase 4B later tightened the ladder again: original T7 and T5 with 3 loss waves are asserted; only the 60% share clause stays dropped and is printed). Stage A (exponential curve, base-HP regen, ~35 runs): lives are 20 until hpGrowth 0.151 (+43 min), then one wave kills the bot (0.152 wins with 2L only through a single wave-30 loss; >= 0.153 loses at wave 24-30; 0.175 loses at 24, 0.2 at 15, 0.25 at 9). Stage A2 (towerCostGrowth 0.02/0.04/0.05, ~27 runs): same cliff, wall at wave 24-25. Stage B (polynomial curve, ~100 runs): the bot is strongest late, so lives are lost only in waves 2-10; hpLinear 0.3 already loses a life in wave 2 (breaks T4) and 0.35+ loses by wave 6-10. Stage B2 (windows 12/0.8/30, clear bonus 12-16 base and 4-7 per wave, ~90 ladders): no configuration passed ALL of T1-T7 (the closest were one target short each, e.g. T3 or T4 or T5 or T7). With the approved relaxed T5' (losses in at least 2 waves) and T7' (at least 3 of seeds 2-5 win with 1-14 lives, a loser must lose at wave >= 20) three configurations pass; chosen: hpCurve polynomial, hpLinear 0.325, hpQuad 0.02, towerCostGrowth 0.03, budgetScale 1, windows 12 / 0.8 / 30, intermission 12, clear bonus 13 + 6w. Ladder: none loses at wave 3, weak at wave 10, balanced seed 1 wins with 8 lives in 43.4 min, seeds 2-5 win with 2, 11, 5, 4 lives | The three passing configurations all have the same worst-wave share (0.67: wave 10 'The Vanguard' takes 8 of the 12 lives); the final one has the smallest clear-bonus base
- 2026-10-19 | 4A.2 | Duration knobs: windows 12 / 0.8 / 30 (long, spread spawns) were needed so that wave 2 does not leak; a full balanced game still takes 43 minutes (aim was 18-26; the asserted limit is 10-45) because waves are long and enemy HP is high | Reported, not hidden
- 2026-10-19 | 4A.2 | Existing tests were updated only by deriving expected values from config and the API (budget spot-checks, gold ledgers with price growth, intermission length, subtitle format); no assertion was weakened except T5/T7 under Stage C | See balance.test.js header
- 2026-10-19 | 1A/1B | Art direction: holographic war room, fully procedural visuals | Claude Code cannot author raster art and this style needs no assets
- 2026-10-18 | 1A/1B | Phase 1 split into 1A engine and 1B visual foundation | Visual quality is built in from the start, not bolted on in Phase 9
- 2026-10-18 | 1B | Visual bar: no placeholder visuals after Phase 1B | Keeps every later phase on-style

- 2026-10-19 | 4B | (a) Quick game = 15 waves of the same script (config.game.quickTotal), default in the menu; Full 30 stays the research setting | A 43-minute first game is too long for a class demo; the sim, curve and economy are untouched
- 2026-10-19 | 4B | (b) The only sim changes: createGame option totalWaves, game.maxLives, game.waveLog, getWavePreview | The UI needs them; 30-wave playthroughs are identical to 4A.2 (balanced seed 1 wins with 8 lives in 43.4 min; none loses at wave 3, weak at wave 10)
- 2026-10-19 | 4B | (c) Pause is a pure model: a user flag plus named locks (menu, howto, pause-menu, settings); the renderer is told "paused" only for the user pause and locks, never after game over or behind the menu | Menus freeze the sim without freezing the end-of-game and menu-backdrop animation
- 2026-10-19 | 4B | (d) One Escape handler in main.js driven by the pure resolveEscape priority table; dialogs that handle Escape themselves call preventDefault | No dialog can steal or double-handle Esc
- 2026-10-19 | 4B | (e) Start, Restart, New seed and Quit are page navigations through pure URL builders | A clean boot is the simplest correct reset; the whole URL is the game's setup
- 2026-10-19 | 4B | (f) The core's state is shape-based (missing ring segments, cracks, shards), thresholds and durations in config.fx | Readable without color; tunable without code changes
- 2026-10-19 | 4B | (g) End screen split into endModel.js (pure), endScreenView.js (DOM from a model) and endScreen.js (adapter with delays) | The gallery renders the real screen from fake data
- 2026-10-19 | 4B | (h) The wave preview and countdown ring refresh on short timers (4 Hz and 10 Hz, about 3 Hz under reduced motion) with key de-duplication | The wave phase flips after WAVE_ENDED is emitted, so events alone would show stale state
- 2026-10-19 | 4B | (i) z tokens added: banner 12, menu 58 (theme.js and style.css, parity tested); settings modal (60) stays above the menu | The banner sits above the HUD but below dialogs
- 2026-10-19 | 4B | (j) Part 0 restored the original T7 and T5 (3 loss waves) in tests/balance.test.js; they pass at the current config with no config change; only the 60% share clause stays dropped (printed) | Phase 4A.2's relaxed targets were not needed
- 2026-10-19 | 4B | (k) Verification used a real headless Chrome driven over the DevTools protocol (Node built-ins only; scripts kept out of the repo): menu, pause menu, how-to, banner, defeat screen and gallery rendered and read; interaction (Esc layering, two-click confirm, seed error, end-screen focus) scripted | Earlier phases only had stub-canvas checks

- 2026-10-19 | 5 | (a) Telemetry is observation only and attached with attachTelemetry(game); it is not stored in snapshots and the full-game test proves snapshotGame is identical with and without it | The sim and every balance result stay exactly as in Phase 4B
- 2026-10-19 | 5 | (b) Attribution: an enemy belongs to the wave that was OPEN when it spawned (outside a wave: offWave), damage and kills go by the source tower type (lance..sniper, debug, other) and by towerId | The brief said ENEMY_SPAWNED.wave; the sim reports the last finished wave for spawns during an intermission, which would corrupt a closed wave, so the open wave decides
- 2026-10-19 | 5 | (c) The collector keeps its own tower counters (damage, kills, shots) | The sim removes a sold tower before the sold event fires
- 2026-10-19 | 5 | (d) Ordering trap: GAME_OVER is emitted from inside ENEMY_LEAKED before the collector sees the leak, so GAME_OVER only notes the result; the partial wave is built on demand in getRun() | The final leak must still be counted
- 2026-10-19 | 5 | (e) offWave aggregate (JSON only) for debug spawns, shots and impacts outside a wave and lives lost outside a wave | Totals reconcile exactly: totals = sum over waves + offWave
- 2026-10-19 | 5 | (f) Gold buckets: prep (no wave open, until the next wave starts) and during (wave open); run totals always accumulate every gold event | Shows what the player did between waves versus in combat
- 2026-10-19 | 5 | (g) 'full' detail keeps one record per enemy (cap 20000, overflow counted in meta.enemyRecordsDropped); 'summary' keeps aggregates only and is the batch default | Bounded memory and file size (a 30-wave full run is 1.3 MB JSON)
- 2026-10-19 | 5 | (h) Floats are rounded to 6 digits in JSON and 4 in CSV with a table of powers of ten (-0 becomes 0); meta, config and definitions are exact copies | Rounding stepSeconds (1/60) would skew every derived time; the brief's "every float" was narrowed for this reason
- 2026-10-19 | 5 | (i) Every run embeds config and definitions | Files are self-describing; a result can be reproduced and understood without the repo state
- 2026-10-19 | 5 | (j) attachDirector(wave, record) stores a validated deep copy in waves[n].director | The Phase 6 hook
- 2026-10-19 | 5 | (k) tools/browser-check is a dev tool (Node built-ins, real Chrome over CDP) and lives outside npm test | Needs a local browser; smoke:browser verifies the menu, game, gallery and 40-tower stress mode
- 2026-10-19 | 5 | (l) Other: validateRun also checks tower finalLevel against the upgrade list and ignores the free-form director and killer fields in the numeric check; the pause menu download button sits before Restart; the Download buttons are shown only when both callbacks are given (the gallery demos stay without them); impacts of shells still flying after a wave ended count in offWave | Small gaps the brief left open

- 2026-10-19 | 6 | (a) The Director tilts the static template shares; with all scores 0 the plan is the static plan itself (cold start equals static, tested against the golden file) | Adaptive can only differ from static where it has evidence; fairness stays easy to audit
- 2026-10-19 | 6 | (b) reward = leakDamage * meanProgress^k / threatCost (k 2) | Leaks are sparse (5 in a 15-wave balanced game), progress is the continuous signal, the threat cost makes cheap and expensive types comparable
- 2026-10-19 | 6 | (c) No pow, exp or log anywhere in src/sim and src/data (integer powers by repeated multiplication), enforced by a grep in the verify step | Cross-engine determinism of recorded runs
- 2026-10-19 | 6 | (d) Eligibility: not fixed (10, 20, 30), not an intro wave (3, 4, 6, 8), wave >= 5; the Director still learns from every wave | New enemy types are introduced as authored; set pieces stay recognizable
- 2026-10-19 | 6 | (e) Fairness: the target is STATIC_THREAT[wave], a deterministic fit step keeps the realized threat within max(5%, 12) (measured max 0.17 of the tolerance in the 15-wave test run, 0.83 over 4200 random share vectors), hpMult and wave count are untouched | The only thing that differs from Static is composition
- 2026-10-19 | 6 | (f) The Director is independent of telemetry (it uses sim events only) and attributes enemies to the wave they spawned in, counting only spawns while a wave runs | Works with telemetry detached; debug spawns between waves carry a stale wave number and are ignored
- 2026-10-19 | 6 | (g) planFor is pure and returns the decision record with the plan; the preview calls the same function | The preview always equals what will spawn
- 2026-10-19 | 6 | (h) A 'random' control mode (URL only, not in the menu) uses the same machinery, records observations, ignores them and draws tilts from createRng(seed).fork('director-wave-' + wave) | Lets Phase 8 separate "responds to the defense" from "just different"
- 2026-10-19 | 6 | (i) The compare tool's hypotheses H1-H6 are reported, never asserted and never used to tune parameters; H6 is N/A unless all four bots ran | Keeps the evaluation honest
- 2026-10-19 | 6 | (j) The weak bot is now createMonoBot('weak', 'lance') with identical behavior (tests/balance.test.js unchanged and passing); monoMortar and monoSniper added | Bot variety for the Director comparison
- 2026-10-19 | 6 | (k) tests/golden/static-waves.json and static-threat.json were generated from the Phase 5 code before the composer refactor and are never regenerated | Proof that the refactor left Static bit-for-bit unchanged
- 2026-10-19 | 6 | (l) Approved reversals: the tests that asserted adaptive throws (waveRunner, quick-game) and that Adaptive is unavailable in MODES were replaced by tests of the new behavior | The behavior changed on purpose
- 2026-10-19 | 6 | (m) Other: the decision record also carries the explanatory lines; the compare tool measures lives lost as startLives - lives left (so the lost final wave counts); validateRun checks director records per run mode; the debug panel's Director line uses short enemy names so it fits; menu preselects Adaptive from ?mode=adaptive and keeps ?mode=random until a radio is chosen | Small gaps the brief left open

- 2026-10-19 | 7 | (a) Charts are hand-built SVG (createElementNS, patterns, markers) instead of Chart.js; Section 3 updated, nothing vendored or downloaded | No dependency, offline, full control over shape/pattern encodings for accessibility
- 2026-10-19 | 7 | (b) The report reads the telemetry run (self-describing: names and tower weaknesses come from run.definitions) while the overlay reads decisions (planWaveWithDecision for the upcoming wave, a decision log for past waves) | The report survives being loaded from a file; the overlay needs no telemetry
- 2026-10-19 | 7 | (c) The tilt chart plots held weights (tiltFromScores of the scores) because non-eligible waves report an applied tilt of 1 | A chart of applied tilts would drop to x1.00 on every set piece and hide what the Director believes
- 2026-10-19 | 7 | (d) shift = half the L1 distance between final and template shares, i.e. the fraction of a wave's threat that moved to other types | Easy to read as a percentage
- 2026-10-19 | 7 | (e) Insight templates are descriptive, not causal ("earned the most threat-adjusted progress", "your towers stopped them early") | The data shows correlation with the player's defense, not why
- 2026-10-19 | 7 | (f) Direction marks are an additive pass over the existing chips and only for adapted waves (random and static show none) | describeBanner and describePreview and their tests are unchanged; the random control stays hidden
- 2026-10-19 | 7 | (g) The ' · Enemy HP ×N.N' suffix was removed from the wave control text because the preview chips already show it (approved test reversal in waveControlState.test.js) | Fits the 360 px control on one line
- 2026-10-19 | 7 | (h) The end card and the report are placed with the pure endCardLayout (top = HUD height + margin, max height inside the stage) and scroll inside | They never overlap the HUD strip
- 2026-10-19 | 7 | (i) window.__siege (game, telemetry, step, startWave) exists only with ?debug=1; the smoke tool asserts it is absent otherwise | Lets tools/browser-check drive a real game without leaking a global into normal play
- 2026-10-19 | 7 | (j) docs/fixtures/demo-adaptive-w15.json is a committed snapshot of an adaptive run for the gallery and tests; its test checks validity and report building but deliberately does not compare it with a fresh run | The fixture must not break every time the sim changes; regenerate with npm run fixture:demo
- 2026-10-19 | 7 | (k) Other: the report model also carries totalWaves; the reduced-motion scan is a new renderer.fx.directorFade (0.12 s fade of the HUD strip) instead of directorScan; the overlay returns its element so the gallery can inline it; the overlay is also created in static mode and only shows a toast; sr-only data tables are wrapped in a div because tables ignore overflow clipping | Gaps the brief left open

- 2026-10-19 | 8A | (a) The old bots (none, weak, mono*, balanced) are deterministic: one layout per game, so seeds add nothing and cannot support an experiment. The style bots draw their tower type, tile and tie-breaks from their own stream createRng(seed).fork('bot-' + style) (the sim's streams are untouched, tested by replaying the commands by hand), build a pending type once per build, and use only sim commands | A distribution of games per style and mode instead of one game
- 2026-10-19 | 8A | (b) Calibration rule: static mode only, on the calibration seeds; mean win rate in [0.5, 0.9], every style >= 0.2, closest to 0.7; stage 1 grid of 9 knob sets sufficed. Chosen: tilePool 1, focusWeight 0.3, upgradeAfter 6 (mean 0.64; styles 0.50, 0.70, 0.70, 0.90, 0.40). tests/calibrationGuard.test.js re-checks it | Bot strength is fixed without looking at the Director
- 2026-10-19 | 8A | (c) Primary metric: lives lost, a loss counting as 20; leaked threat is normalized by spawned threat (leakFraction) because adaptive changes the composition and raw leak counts are not comparable across compositions | Avoids rewarding the Director for sending more cheap units
- 2026-10-19 | 8A | (d) Seeds are the clusters: every comparison is a paired seed-level difference averaged over the styles, with a cluster bootstrap interval and a sign-flip permutation test; Holm within the primary and secondary families separately | Games of one seed share their random choices
- 2026-10-19 | 8A | (e) The held-out lock (pure decision function plus CLI) refuses without --final --yes, with a dirty tree or unknown commit, and on a repeat; it is written before any game is played and keeps previous locks | An auditable single confirmatory run
- 2026-10-19 | 8A | (f) The tuning set (seeds 1001-1030) is exploratory: its results may inform Director tuning in Phase 9 and may not be reported as confirmatory
- 2026-10-19 | 8A | (g) Report insight cap raised to 7 (nothing is cut) and an adaptive-only footnote about tankiness added (approved reversal of the earlier cap-of-5 test)
- 2026-10-19 | 8A | (h) Experiment outputs are committed under docs/results (calibration.*, tuning.csv, tuning.rows.json, tuning-summary.*); experiments/results stays git-ignored for scratch output
- 2026-10-19 | 8A | (i) Other: the style bots' calibration range gives balancedR a fixed 0.2 weight per tower (it ignores focusWeight); T1 skips styles without a prediction; supportsDirection is only the sign of the mean difference (read it together with the CI); the analysis returns an incomplete-data report instead of statistics when units are missing or duplicated; the tuning rows file records the git commit and the dirty flag (it was produced before the calibrated knobs were committed)

- 2026-10-19 | 8B | (a) Amendment A1: the final tilt is the applied tilt of the last ELIGIBLE wave record for adaptive and random alike, plus a tiltObserved flag (protocol version 2, A1 recorded in PROTOCOL.amendments). Why: in Phase 8A random mode could report a tilt of exactly 1 whenever its last record was a non-eligible wave (42 of 150 random rows) while adaptive used held weights, so the two modes were measured differently. Chronology: noticed AFTER the tuning results had been seen, made before any held-out run; no hypothesis, no P1-P2/S1-S8/C1 metric and no seed set changed
- 2026-10-19 | 8B | (b) The Phase 8A tuning outputs were archived with git mv (docs/results/archive/tuning-v1.*) in their own commit (the move had to wait for a file lock held by a spreadsheet program; the first commit of the phase was made without it and the archive follows in a separate commit, history not rewritten); the re-run under A1 is identical in every column except the tilt columns (checked for all 450 units)
- 2026-10-19 | 8B | (c) Diagnostics are static-mode only and tuning-seed only, and are used by no code; they test the hypothesis that the reward favors tanky enemy types regardless of the player's defense
- 2026-10-19 | 8B | (d) Figures are written by hand as SVG strings in JS (no libraries), white background, Okabe-Ito colors, and every series also differs by marker shape or fill pattern; the heatmap repeats direction with a triangle glyph
- 2026-10-19 | 8B | (e) Nothing under src/ and nothing in the Director changed; the held-out set was not run and experiments/heldout.lock.json does not exist
- 2026-10-19 | 8B | (f) Other: analyze reports how many rows each tilt statistic used and excluded; T1 uses rows with tiltObserved 1 only; the figure builders import the marker and pattern tables from src/ui/directorChart.js read-only; supportsDirection remains only the sign of the mean difference

- 2026-10-19 | 9A-1 | (a) The focus styles were replaced by ablation styles (each bot omits one tower; weight 0, the other four 0.25) | A focus style's weakness was a guess; the missing tower's own strongVs entry gives a prediction read from the data. The focus bots stay in the code (KNOWN_STYLES in protocol.js) so archived results remain reproducible
- 2026-10-19 | 9A-1 | (b) The style contrast (final weight of a style on its predicted type minus the mean of the other predicted-style games of the same seed, per seed) replaces the fixed-threshold alignment; the random control is the empirical null because its tilts do not depend on the defense | Detects whether the weights follow the defense without a threshold the random control wins by construction
- 2026-10-19 | 9A-1 | (c) T1 retired and replaced by T2 (adaptive minus random, secondary family) and T0 (random against 0, descriptive, two-sided); tiltAligned stays as a descriptive table with a note | T1 was reversed on the tuning data by construction (random tilts spread from 1/3 to 3); the reversal stays in docs/results/archive as the reason
- 2026-10-19 | 9A-1 | (d) A reached-wave-5 sensitivity analysis (P1, P2, C1 on units whose STATIC game reached wave 5; pre-treatment because waves 1-4 are identical in every mode) and an early-ends invariant check (the same units end early in every mode; a violation prints a prominent warning) | Games lost before the Director's first eligible wave dilute every mode difference; on the tuning rows 37 of 150 units per mode ended before wave 5 and the invariant holds
- 2026-10-19 | 9A-1 | (e) Calibration (static, 540 games): no combination qualified in stage 1 (every style >= 0.2) or stage 2 (>= 0.1); stage 3 qualified exactly one: tilePool 6, upgradeAfter 4 (focusWeight 0.3 ignored). noFrost wins 0 of 10 static games and was DROPPED from PROTOCOL.styles and tiltPredictions; the mean over the five kept styles is 0.520, balancedR 0.70, noLance 0.20, noMortar 0.80, noPoison 0.50, noSniper 0.40 | The rule was fixed before the run; the consequence is a weaker bot population (mean just above the 0.5 bound)
- 2026-10-19 | 9A-1 | (f) The focus-style outputs (tuning rows and summary, amendment A1 report, diagnostics, figures) were moved with git mv to docs/results/archive (tuning-a1-focus.*, diagnostics-focus.*, figures-focus); the figures are not regenerated until Phase 9B | Keeps the before/after record; the default paths of npm run figures no longer exist
- 2026-10-19 | 9A-1 | (g) Chronology of A2: made after seeing the tuning results of protocol versions 1 and 2 and the Phase 8B diagnostics, before any held-out run; the contrast statistic and the early-loss check (Part 1) were designed after seeing the focus-style data and are labelled exploratory/post-hoc. Nothing under src/ and nothing in the Director changed; experiments/heldout.lock.json does not exist
- 2026-10-19 | 9A-1 | (h) Other: (1) the commit-1 files had been deleted from the working tree of the interrupted earlier session and were restored from HEAD (the resume rule: commit 1 already existed); (2) KNOWN_STYLES keeps the old style names valid for styleWeights and createStyleBot while PROTOCOL.styles lists only the current ones; (3) chooseKnobs ties no longer look at focusWeight (it is fixed); (4) the figure tests use an explicit legacy protocol (focus styles, a T1 hypothesis) because the figure builders still target version 2 (approved reversal, rule iii); (5) diagnose(obs, opts) defaults to the protocol styles and predictions; the reward contrast skips (seed, style, wave) groups with R = 0 and needs the reference style to have a cell of the same type; (6) the determinism check ran seeds 1001-1002 through unitsFor/runExperiment/writeResults (the CLI has no seed-subset flag) twice and the CSV and rows were identical byte for byte; (7) the early-loss and contrast commands in docs/results/README.md read the archived rows

- 2026-10-19 | 9A-2a | (a) Director v2 and the counter arm: v1's weights followed tankiness (Phase 8B/9A-1 diagnostics), so v2 divides rewards by a static baseline per type and wave (an expected reward, not an absolute one) and shrinks advantages of types with few units; the counter arm reads the loadout and shows what a Director with that knowledge could reach. They are new modes next to v1, which is unchanged
- 2026-10-19 | 9A-2a | (b) The baseline is built from STATIC games on the TRAIN seeds only (no Director code involved), so v2's normalization cannot encode v2's own behavior (no circularity); it is generated data (src/data/directorBaseline.js) that must be regenerated with npm run baseline whenever the sim balance changes
- 2026-10-19 | 9A-2a | (c) Shrinkage is units / (units + shrinkK) with shrinkK 4 (not tuned); the baseline has 15 waves, so waves above 15 in a Full game use the wave-15 entry (a documented limitation: the baseline was measured in Quick games)
- 2026-10-19 | 9A-2a | (d) The counter arm is stateless and reads only game.towers and the declared strongVs/weakVs data, weighting a tower by 1 + 0.5 * level; it is a ceiling, not a fair competitor, and its state is kept in the director shape (zero scores, empty history) so snapshots, playGame and telemetry keep working
- 2026-10-19 | 9A-2a | (e) The tuning seeds are split into TRAIN 1001-1020 and VALIDATION 1021-1030; the validation split goes through a lock of its own (experiments/validation.lock.json, kind recorded, same rules as the held-out lock). Neither lock exists; a split never takes the default full-set output name
- 2026-10-19 | 9A-2a | (f) The fixed-wave contrast reads the applied tilt of a given wave (tiltByWave) instead of the final tilt, which depends on how far each game got; coverage is reported next to it. The random control draws its tilts from the seed and the wave only, so they are identical across styles and its fixed-wave contrast is exactly 0 by construction
- 2026-10-19 | 9A-2a | (g) tests/golden-modes.test.js pins the director payloads and the result of static, adaptive and random (balanced bot, seed 1, 15 waves), generated from the Phase 9A-1 code before any change and never regenerated; the first-look run also proved that all 300 static, random and adaptive rows equal the committed tuning rows in every column except the new tiltByWave
- 2026-10-19 | 9A-2a | (h) Other: (1) validateRun lives in src/sim/telemetryValidate.js (not telemetrySchema.js), that is where the mode list was extended; (2) the runUnit row-keys assertion was extended by tiltByWave; (3) the preview test recomputes the preview at the start event from a copy of the game in the intermission, because the balanced bot starts waves inside its own act call; (4) --split=validation was run once by mistake before the CLI wired the lock (see Known Issues); (5) the menu does not list the new arms; their labels are 'Adaptive v2 (research)' and 'Counter arm (research)'; (6) the tilt limit of the overlay bars comes from the arm's own config (tiltMaxOf)

- 2026-10-19 | 9A-2b-1 | (a) The prior arm exists to split the total effect of Director v1 into parts: the learning Directors seem to favour durable enemy types whatever the player builds, so a fixed arm with weights from the static baseline alone reproduces that bias without learning and without the defense. The attribution chain is then exact: (adaptive - static) = (random - static) + (prior - random) + (adaptive - prior), checked per seed
- 2026-10-19 | 9A-2b-1 | (b) The prior's definition: the template-share-weighted mean of the baseline rewards of the types in the wave's template is the reference, the advantage is clamped like v1's ([-1, advClipHigh]) and the tilt is clamp(1 + beta * advantage); types outside the template keep tilt 1; no state, no rng, no reading of the defense (tested: identical decisions for different seeds and loadouts)
- 2026-10-19 | 9A-2b-1 | (c) Goldens now pin every arm (static/adaptive/random from 9A-2a, adaptive2/counter from the 9A-2a code before the prior existed, the prior from its own commit) and are never regenerated
- 2026-10-19 | 9A-2b-1 | (d) The lock gate of the experiment CLI is exported as main(argv, deps) with injectable dependencies and covered by tests/cli-lock.test.js (stubs only, the real runner is never called for locked sets); the accidental unlocked run of the validation split is recorded in docs/EXPERIMENT.md (Incident log): seeds 1021-1030 are not pristine, only the held-out seeds 2001+ are confirmatory
- 2026-10-19 | 9A-2b-1 | (e) The fixed wave for the style contrast is chosen by a rule that uses coverage COUNTS only (smallest eligible wave >= 9 with minimum coverage >= 0.75 over adaptive, adaptive2, counter, prior and random, else the largest minimum coverage), so the choice cannot be steered by outcome values; on the training data the rule was not met and chose wave 9 (70%)
- 2026-10-19 | 9A-2b-1 | (f) No arm is tuned before the held-out run: amendment A3 will fix the confirmatory family first, and the tuning grid planned in 9A-2a for Director v2 is dropped from the plan
- 2026-10-19 | 9A-2b-1 | (g) Other: (1) the mode order of result sets follows ALL_MODES (static, adaptive, random, adaptive2, counter, prior), whatever order --modes lists; (2) main(argv, deps) has no injectable exit: it returns the exit code; (3) playGame returns director null for modes without scores (prior); (4) the pooled tilt agreement averages all unit-wave cells; (5) the first-look code was split into firstLook.js, firstLookChain.js, firstLookContrast.js and firstLookFormat.js to stay near 300 lines; (6) the identity check can only fail through a bug (it is algebraic), so its error line is tested on a hand-set result

- 2026-10-19 | 9A-2b-2 | (a) Amendment A3 fixes the confirmatory plan before the held-out run so that nothing can be chosen after seeing held-out results: version 4, 150 seeds (2001-2150), six confirmatory modes, the primary population, the fixed wave, a family of three hypotheses with Holm, estimands with CIs only, sensitivity analyses, and a no-tuning rule (any change needs an amendment A4 before the run)
- 2026-10-19 | 9A-2b-2 | (b) The population is the units whose STATIC game reached wave 5: a pre-treatment condition (waves 1-4 are identical in every mode, the same units end early in every mode), so conditioning on it cannot be affected by the treatment arms
- 2026-10-19 | 9A-2b-2 | (c) The primary fixed wave is 9 although the coverage rule (minimum coverage >= 0.75) was not met on the training seeds (70% at wave 9): 9 is the first eligible wave at which all four predicted enemy types are unlocked, and wave 5 (the only pre-treatment wave) can test only two of them; the registered protocol states the unmet rule and the held-out report prints the computed coverage and what the rule would choose
- 2026-10-19 | 9A-2b-2 | (d) Only three hypotheses are confirmatory (K1 composition variability costs lives; K2 and K3 the weights of Director v1 and v2 separate defenses at wave 9); everything else (attribution pairs, contrasts at waves 5 and 9, five metrics) is estimation with point estimates and cluster-bootstrap CIs and no p-values, so the multiplicity burden stays small
- 2026-10-19 | 9A-2b-2 | (e) 150 held-out seeds: the training dry run suggested about 27 seeds for K1, 52 for K2 and about 240 for K3 at the Holm level; 150 seeds is a compromise between run time (about 6.5 minutes for 4500 games) and power, and the low power for K3 is stated up front in the interpretation guide
- 2026-10-19 | 9A-2b-2 | (f) The validation seeds (1021-1030) are not used for confirmation: they are not pristine (the incident, and they were part of the tuning set read in 9A-1); the tuning grid for Director v2 planned in 9A-2a was dropped (no arm is tuned before the held-out run)
- 2026-10-19 | 9A-2b-2 | (g) Dry-run safety: npm run confirm without --dry-run requires set heldout, protocol version 4, the current protocol hash and a numeric lock runIndex and refuses any output name containing dryrun; with --dry-run it requires a dryrun output name and labels everything EXPLORATORY DRY RUN ON TRAINING DATA: NOT CONFIRMATORY; incomplete data produce no statistic
- 2026-10-19 | 9A-2b-2 | (h) Other: (1) allowedModesFor('calibration') stays the protocol modes (not only static) because existing calibration tests use adaptive; (2) the held-out run defaults to the six confirmatory modes and refuses --modes and --styles (as before) and unitsFor rejects any other mode list for heldout; (3) contrastSeedValues was factored out of firstLookContrast.js (the first-look output is byte-identical, checked); (4) PROTOCOL_PREVIOUS_HASHES holds the version 3 hash so version 3 rows can still be analyzed with a note; (5) the K2/K3 unlocked-only rule changes nothing at wave 9 (all types unlocked) and drops the regenerator and bruiser pairs at wave 5; (6) the post hoc power note uses alpha 0.016667 (Holm level of the smallest of three p-values)

## 14. Known Issues / TODO
<!-- Add items as they appear; remove when fixed -->
- Browser behaviour of the debug scene (resize, DPR, key handling) was syntax-checked and served but only the user's manual check covers real rendering.
- Phase 0 test `tests/boot.test.js` is a runner sanity check only; it can be removed once real tests dominate.
- Debug walkers use `prevDistance`/`distance` interpolation; when real enemies arrive in Phase 2 they must keep the same prev/current pattern for smooth rendering.
- Phase 1B was NOT run in a real browser by Claude (extension not connected): no measured FPS, and layout/visuals are unverified beyond node --check, a stub-canvas smoke test and file serving. User approval pass needed.
- Whether Rajdhani digits are tabular is unknown until the gallery numerals row is read; HUD numbers use tabular-nums plus min-width regardless.
- p95 frame stat sorts a preallocated Float32Array 4x per second (typed-array sort may allocate internally); renderer allocates only at event time (fx.burst option spread, HUD count-up closures).
- Gallery effect-lab/map-preview stages each run a full renderer; both pause when scrolled out of view.
- The difficulty band is narrow and chaotic (Stage C was used): hpLinear x0.9 makes the balanced bot lose no life at all (20 lives, 40 min); x1.1 loses at wave 8. Lives are lost almost only in waves 7-10 (wave 10 'The Vanguard' costs 8 of 12) because the bot's 60 fully upgraded towers dominate from wave 11. Seeds change the outcome a lot (seed 3 loses 11 lives, seed 2 only 2).
- Wave length: the balanced bot needs 43.4 game minutes for 30 waves (waves take 60-130 s each; the aim was 18-26 min). Shorter games need fewer/shorter waves or a faster bot, which would reopen the calibration.
- Phase 4A was NOT run in a real browser by Claude (extension not connected): wave control, end screen, HUD updates, Enter key, debug panel position and focus handling are verified only by pure-logic tests, node --check and sim playthroughs.
- Phase 3B was NOT run in a real browser by Claude (extension not connected): all tower art, trails, impacts, status overlays, the panel layout and the 40-tower frame rate are verified only by pure-logic tests, node --check, stub-canvas smoke runs (all tiers, reduced motion on and off, stress layout) and file serving. No frame-time numbers exist.
- Lance and Sniper share the same accent color (Defense primary); only their silhouettes tell them apart, which the gallery colorblind table reports as "rely on silhouette".
- The poison liquid/bubbles and tier chevrons are drawn per frame with a few path commands (no allocation, but not cached Path2D).
- Phase 3A was NOT run in a real browser by Claude (extension not connected): the build tray layout, tower panel positions, tooltips, hotkeys and pointer handling are verified only by tests of their pure parts, node --check and a stub-canvas smoke test.
- Balance is rough: after the R1-R7 tuning each tower lands around 25 dps, mortar is weak against bruisers and regenerators, frost's direct damage triggers a hit flash on every pulse.
- Gold has no spend limits beyond cost; the 80-tower cap is a safety limit. Sold towers keep their in-flight projectiles (by design).
- Phase 2 was NOT run in a real browser by Claude (extension not connected): only the stub-canvas smoke tests, node --check and file serving were verified. Visual feel, 60 FPS with ~600 enemies, and click targeting need the user's check.
- The placeholder auto-spawner (random enemy every 90 ticks) is temporary; the wave runner replaces it in Phase 4. Enemies that reach the base only emit ENEMY_LEAKED (no lives are subtracted until Phase 4).
- Headless sim cost with 600 enemies: about 26k steps/s (roughly 0.04 ms per step); the render side at 600 enemies is unmeasured.
- Phase 4B was verified in headless Chrome with software rendering (no GPU, no human): screenshots were read and key flows scripted, but feel, animation smoothness, audio-less pacing and real-GPU frame rate need the user's playtest. Stress mode (40 towers, spawn every 3 ticks) averaged 21 ms per frame in that setup, identical to the commit before Phase 4B.
- Quick mode has no special finale: wave 15 is an ordinary wave (Phase 9 item). The 30-wave game still ends with 4816 unspent gold for the balanced bot.
- The wave control subtitle ("Place towers, then start (Enter) - Enemy HP x1.0") wraps to two lines inside the 300 px control next to the countdown ring; legible, but cramped.
- Digit-only seeds such as "007" become the number 7 (text seeds keep their exact text).
- The gallery core canvases draw the core only (no particles or darkening); the particle and screen effects of the fall and the victory are only visible in the live game.
- Phase 5 was checked in headless Chrome (software rendering): download buttons were verified by intercepting the anchor click and reading the Blob (name, type, contents), not by saving a real file; the layout of the taller end card (its top edge now overlaps the HUD strip slightly) needs a human look.
- The collector adds about 4% wall time to a headless 30-wave run (2095 ms without, 2181 ms with full telemetry); there is no browser frame-time measurement of it.
- Late attachment loses everything before attach (counted in meta.ignoredEvents); startGold is then the gold at attach time.
- A 30-wave full run is 1.3 MB of JSON (enemies.csv 387 KB); the 20000-record cap is far above any real run (about 3200 enemies).
- The Director's bias: tanky types (Regenerator, Bruiser) score higher against most defenses, so in adaptive games they get more share; compare against the random control (the balanced bot: adaptive lost 19.7 lives on average over seeds 1-3 versus 18.0 random and 13.0 static, 15 waves).
- Seeds only change lane offsets, so bot runs vary little across seeds (the balanced bot's lives left differ by seed mostly because of when leaks happen).
- monoMortar loses at wave 5 and monoSniper at wave 7 in every mode, before or at the Director's first eligible wave, so H5/H6 are trivially satisfied for them in the compare output.
- The end card overlaps the HUD strip a little (Phase 7 reworks the end screen layout).
- About 30% of the 40-tower stress layout never fires (towers out of range of the path).
- The first adaptive wave (5) is 'adapted' as soon as waves 1-4 produced non-zero scores; 'cold-start' therefore appears only when the scores are exactly zero or a wave is observed without any updated type.
- The report's insight cap (config.report.maxInsights = 5) applies to the concatenated list, so when the Director leaned on or backed off two types each, the toughest-wave and mean-shift insights (4 and 5) are cut off; in the real 15-wave run only 'Mortar dealt 34% of your damage.' fit after the four weight lines.
- Phase 7 was checked in headless Chrome with software rendering (no GPU, no human): overlay values, direction marks, the report and Esc/focus behavior were read from the DOM and screenshots were looked at, but animations (scan sweep, bar transitions, staged fades) were not judged in motion.
- The overlay (max height 420) scrolls inside when its rows, plain-language lines and mini chart do not fit; the mini chart can sit below the fold.
- The wave control title can wrap for long set-piece names in the intermission ('Next: Wave 10 — The Vanguard' was not measured).
- Gallery overlays are driven by a stand-in game object; they show the recorded run's decisions, not live ones.
- Exploratory tuning-set results (Phase 8A, 30 seeds): the primary P1 (adaptive vs static) shows +1.48 lives lost (95% CI 0.85 to 2.15); P2 (adaptive vs random) is null (+0.06, CI -0.65 to 0.75); T1 is reversed (the random control leans toward the predicted types more often than the Director: 17% / 0% / 73% / 20% versus 47% / 43% / 83% / 60% for the four predicted styles). Most of the "harder than static" effect is also present in the random control (C1 +1.42).
- The Director's final weights are similar for every style (Regenerator and Bruiser up, Fast Runner and Armored Grunt down): it behaves like a tankiness detector more than a counter to the player's mix.
- balancedR (a random tower mix) wins only about 45% of static games and its Director results barely move (a possible ceiling or floor effect); the calibration constrains the mean, not the spread between styles.
- All styles lose most lives in the same few waves; seeds only change lanes and the bots' random choices, so seed-level variation is modest (sd of seed-level P1 differences 1.9 lives).
- The tuning run's rows file records gitDirty true: it was produced with the calibrated knobs in the working tree before they were committed (the code and protocol hashes are the ones in the commit).
- Under A1 the tilt-alignment comparison (T1) is more strongly reversed than under the Phase 8A definition (adaptive minus random -0.556, CI -0.647 to -0.464): the random control leans toward the predicted types in 67% to 97% of its observed games, the Director in 0% to 67%. Random tilts are drawn uniformly from [1/3, 3], so a maximum over the predicted types rarely stays below 1.15; the test favors the control by construction, so T1 says little about whether the Director responds to the style.
- The diagnostics support the tankiness hypothesis: in static games Regenerator (1.31) and Shielded Bruiser (1.26) earn more reward per unit of threat than average and Fast Runner (0.55) far less; only about 1% of the reward variance is explained by the bot style while 29% to 56% is explained by the wave.
- 15 of 150 adaptive and 15 of 150 random games ended before an eligible wave (tiltObserved 0) and are excluded from tilt statistics only.
- Test runtimes grew on this machine (balance 25 s, whole suite 32 s in the last run): the machine was busy; Phase 8A measured 10 s and 12 s.
- Phase 8B was checked on the tuning set only; the figures were looked at as rendered images in headless Chrome, not in other viewers.
- Phase 9A-1 tuning "before" (Director v1, ablation styles, exploratory): P1 +1.207 lives (95% CI 0.667 to 1.787, Holm 0.0002); P2 +0.540 (-0.127 to 1.287, p 0.161, not significant); T2 +0.271 (0.076 to 0.508, Holm 0.0378); T0 -0.175 (-0.361 to -0.010, p 0.063); sensitivity on units that reached wave 5: P1 +1.651, P2 +0.671 (p 0.116), C1 +0.981; adaptive contrast 0.096 (0.005 to 0.191, p 0.052) on 29 seeds and 113 games per mode.
- 37 of 150 units per mode (25%) end before wave 5 (the same units in all modes); they never reach an eligible wave, so they carry no tilt and 113 of 150 games per mode enter the contrast.
- The random control's contrast is negative (T0 -0.175), not zero: its tilts come from createRng(seed).fork('director-wave-' + wave), so styles with the same seed see the SAME tilts per wave and differ only through the wave at which their last eligible record falls. The control is therefore not an independent-null sampler; read T2 together with T0. Not verified further.
- The reward contrast (static, waves 5+) is +0.199 (0.092 to 0.310, p 0.0016) but concentrated: noSniper -> shieldedBruiser +0.570 (0.400 to 0.751); noLance -> armoredGrunt +0.084 (0.006 to 0.188); noMortar and noPoison have CIs that include 0. Variance explained by the style stays small (etaStyle 0.017 to 0.066) against the wave (0.39 to 0.50).
- Calibration stage 3 dropped noFrost (0.00 static win rate at every tilePool/upgradeAfter except 0.10 at tilePool 3), so Frost is never ablated; the chosen mean (0.520) is only just inside the window and noLance wins 20% of its calibration games.
- npm run figures and tests/figuresCli.test.js defaults still point at docs/results/tuning-summary.json and diagnostics.json (now version 3 files with different hypotheses and styles); the figure builders target protocol version 2, so the figures are not regenerated until Phase 9B.
- Tuning rows were produced with the working tree clean (gitDirty false) at the commit that archived the focus outputs; the diagnostics code was committed afterwards and does not influence rows.
- Phase 9A-1 verification used headless Chrome smoke checks only (8 pass); nothing under src/ changed.
- Phase 9A-2a first look (TRAIN seeds, exploratory, nothing tuned, 71 of 100 units in the population): mean lives lost static 10.61, adaptive 12.42, random 12.01, adaptive2 10.86, counter 11.25. Paired differences (population, unadjusted): adaptive - static +1.867 (0.733 to 3.158, p 0.005); adaptive2 - static +0.391 (-0.048 to 0.858, p 0.112); adaptive2 - random -1.079 (-2.127 to 0.016, p 0.073); adaptive2 - adaptive -1.477 (-2.873 to -0.237, p 0.040); counter - static +0.712 (0.136 to 1.448, p 0.035); counter - adaptive2 +0.321 (-0.136 to 0.792, p 0.212). Fixed-wave contrast at wave 13: adaptive +0.294 (0.150 to 0.430), adaptive2 +0.100 (-0.016 to 0.201), counter +0.430 (0.321 to 0.561), random 0 (coverage 65% to 70%). At wave 5 the contrast is 0.000 (adaptive, adaptive2), 0.288 (counter): the Director has seen nothing that depends on the defense yet.
- In this first look Director v2 is milder than v1 (closer to static) and its contrast is about a third of v1's at the late waves; the counter arm separates defenses clearly but costs the player fewer lives than v1. These are descriptive numbers for 20 seeds, not a ranking.
- Coverage of the fixed-wave contrast falls from 100% at wave 5 to 56% to 66% at wave 15 (games ended before the wave, or the wave was not eligible).
- The baseline table is generated from the current sim balance; any balance change makes it stale until npm run baseline is run again. Waves above 15 reuse the wave-15 entry.
- Tests do not cover the counter arm in the browser beyond the smoke page (overlay title and HUD); the preview refresh on tower events is tested through its pure key only.
- tests/figures use an explicit legacy protocol and npm run figures is still not regenerated for version 3 (Phase 9B).
- During this phase `node experiments/runExperimentCli.js --set=tuning --split=validation` was run once while main() did not yet consult the lock, so it executed the whole tuning set (450 games, base tuning-validation) with no lock; the two output files were deleted without being read. Seeds 1021-1030 had already been run as part of the committed 9A-1 tuning set, and the new arms were NOT run on them. The CLI now refuses without --final, --yes and a clean tree and is covered by tests.
- Incident (recorded in Phase 9A-2b-1, see docs/EXPERIMENT.md Incident log): the validation split was run once without a lock in Phase 9A-2a (whole tuning set, 450 games, outputs deleted unread, new arms not run on it). Seeds 1021-1030 were already read as part of the tuning set in 9A-1, so they are not pristine; only the held-out seeds 2001+ are confirmatory. The lock gate is covered by tests/cli-lock.test.js.
- Phase 9A-2b-1 six-mode first look (TRAIN seeds, exploratory, nothing tuned, population 71 of 100 units): attribution of lives lost: random - static +1.470 (0.484 to 2.454, p 0.011), prior - random +0.228 (-0.657 to 1.144, p 0.640), adaptive - prior +0.169 (-0.605 to 1.043, p 0.721), total adaptive - static +1.867 (0.733 to 3.158, p 0.005); adaptive2 - prior -1.308 (-2.538 to -0.220, p 0.037); counter - prior -0.987 (-2.259 to 0.147, p 0.136). In these data most of v1's total sits in composition variability, and the prior alone is about as hard as v1 (both 38 wins in all 100 units, versus 44 for random and 51 for static); the identity holds (largest error 8.9e-16).
- Tilt agreement (pooled): adaptive vs prior 0.214, adaptive2 vs prior 0.340, adaptive vs adaptive2 0.278, random vs prior 0.872: v1's weights are close to the fixed durability prior, v2's are further from it.
- The fixed-wave contrast of random and prior is exactly 0 at every wave (checked and printed); counter is clearly positive (+0.29 at wave 5, +0.34 to +0.43 at waves 9 to 14), adaptive about +0.12 at wave 9 and +0.26 to +0.31 at waves 12 to 14, adaptive2 smaller (+0.03 at wave 9, up to about +0.1 at waves 12 to 15); coverage limits all of these to 56% to 85% of the population.
- The pre-registered fixed-wave rule was not met on the training data (no candidate reached 75% minimum coverage); wave 9 was chosen as the best minimum coverage (70%). Amendment A3 must decide what to do with a rule that is not met at 20 seeds (150 held-out seeds will change coverage counts only a little in relative terms).
- tests/firstLook uses synthetic data; the real identity and zero checks were observed only in the training run.
- Phase 9A-2b-2 dry run on the TRAIN rows (exploratory, did not change the plan): K1 +1.470 (0.484 to 2.454, Holm p 0.0316, would be supported); K2 +0.118 (-0.025 to 0.248, Holm p 0.259, 13 seeds, 70% coverage); K3 +0.033 (-0.049 to 0.107, Holm p 0.429, 15 seeds); post hoc seeds needed at the Holm level: K1 27, K2 52, K3 244. Counter at wave 9 +0.341, prior and random exactly 0 (zero checks ok). Leave-one-style-out signs are stable for K1-K3.
- The fixed-wave coverage rule was not met on the training seeds (70% at wave 9) and may not be met on the held-out data either; the registered plan keeps wave 9 and reports the computed coverage.
- K2 and K3 depend on how many population units reach wave 9 in each arm (coverage 70% to 80% on training data); a lower coverage means fewer usable seeds and a noisier estimate. K3 is expected to be under-powered even with 150 seeds.
- The figure builders (npm run figures) still target protocol version 2 and the default input paths do not exist; they must be rewritten in Phase 9B.
- npm run plan-heldout times six training games for its runtime estimate (about 6.5 minutes for 4500 games on this machine); it is rough and linear.
- The held-out rows file is written only when the whole run completes (writeResults after runExperiment); an interrupted run leaves a lock without rows, and a re-run then needs --new-lock (runIndex 2, to be reported).

## 15. Session Log
<!-- Format: YYYY-MM-DD | Phase | What was done | What's next -->
- 2026-10-16 | Phase 0 | Verified Node v24.18.0 / Git 2.54; git init (main), .gitignore, package.json, folder skeleton, placeholder modules, dev server, boot page, trivial tests; checks passed | Phase 1: game loop, RNG, event bus, map rendering
- 2026-10-18 | Maintenance | Moved dev server to port 8137 (PORT override), dual-stack loopback bind, added dev alias, traversal tests, Node 22+ | Phase 1: game loop, RNG, event bus, map rendering
- 2026-10-18 | Docs | CLAUDE.md upgraded with Visual Design Bible, quality criteria, and Phase 1A/1B split | Phase 1A
- 2026-10-18 | Phase 1A | Built fixed-timestep stepper, seeded RNG with forks, strict event bus, validated 20x10 map and path, game state with temporary debug walkers, DPR-aware fit, debug renderer, dev keys; 96 tests pass; headless sim ~4.2M steps/s | Phase 1B: visual foundation and UI kit
- 2026-10-18 | Phase 1B | Built perf meters, vendored fonts, color/theme/tween/particles/floatText/shake/quality/settings/icons modules, procedural enemy shapes, layered renderer with cached static background, DOM UI kit (HUD, tooltip, toast, settings modal, debug panel), style gallery; 206 tests pass; no real-browser run | User approves the look (check main page and gallery), then Phase 2
- 2026-10-18 | Phase 2 | Built enemy data, damage model (armor/shield/DoT), statuses, spawn queue, order-preserving enemy lifecycle, corner-blended path sampling, enemy renderer (flash, spawn-in, statuses, health bars), sim-event fx, debug tools and keys, gallery enemy states; 272 tests pass; no real-browser run | User checks the visuals (main page + gallery), then Phase 3
- 2026-10-18 | Phase 3A | Built tower data, economy core, placement/upgrade/sell, targeting, firing, projectiles, attribution, matchup harness with R1-R7, build tray, tower panel, placement/selection overlays, ?debug=1 gating; 353 tests pass; no real-browser run | User checks gameplay (build, upgrade, sell, counters), then Phase 3B
- 2026-10-18 | Phase 3B | UI overlap fix (own commit), tower art/shapes/paths/animations, projectile trails and arcing shells, impact effects, sell ghosts and build-in, status overlays, stress mode, gallery towers; 424 tests pass; no real-browser run | User checks the visuals and the 40-tower performance (stress mode), then Phase 4
- 2026-10-18 | Phase 4A | Lives, 30-wave static script with pure builder, wave runner, win/lose, stats, wave control and end screen, bots, playthrough and calibration (budgetScale 3.6); 488 tests pass; no real-browser run | User playtests, then Phase 4B
- 2026-10-19 | Phase 4A.2 | Wave HP scaling (polynomial), base-HP regeneration, tower price growth and cap 60, weak bot, bot ladder calibration (Stage C), price in the tray and HP multiplier in the wave control; 512 tests pass; no real-browser run | User playtests, then Phase 4B
- 2026-10-19 | Phase 4B | Test tightening, Quick game (15 waves), waveLog and wave preview in the sim, main menu, how-to, pause menu, wave banner, wave preview, countdown ring, four core states with destroyed and victory animations, animated end screens with wave strip, pause locks and a single Escape handler, gallery 4b; 615 tests pass; verified in headless Chrome | User playtests, then tag phase-4b-complete; Phase 5 only when the user says so
- 2026-10-19 | Phase 5 | Telemetry collector, schema, validateRun, JSON/CSV export, docs/TELEMETRY.md, playthrough --telemetry, summarize, download buttons, debug telemetry line, browser-check dev tool (check, smoke); 700 tests pass; 30-wave balanced seed 1 still wins with 8 lives in 43.4 min (15 waves 18.9 min), none loses at wave 3, weak at wave 10; headless Chrome smoke passes | User checks, then tag phase-5-complete; Phase 6 only when the user says so
- 2026-10-19 | Phase 6 | Shared wave composer and golden static waves, Director math, Director and random control, game wiring, decision records, telemetry hook and validation, docs/DIRECTOR.md, monoMortar and monoSniper bots, playthrough --mode, compare tool, modes in menu and URL, Director UI lines; 778 tests pass; static results identical to Phase 5; headless Chrome smoke passes (5 checks) | User checks, then tag phase-6-complete; Phase 7 only when the user says so
- 2026-10-19 | Phase 7 | Layout fixes (wave control 360, HUD text), pure modules (decision log, director view, chart model, report, end card layout), Director overlay with HUD button and hotkey I, SVG charts, direction marks, scan sweep with a reduced-motion fade, the Director's Report from the end card, gallery section, demo fixture, window.__siege debug handle, smoke checks 6-8; 834 tests pass; Phase 6 results reproduce exactly (static 8 lives, adaptive 1, random 5); real-browser evidence from headless Chrome | User checks, then tag phase-7-complete; Phase 8 only when the user says so
- 2026-10-19 | Phase 8A | Insight cap 7 and the adaptive footnote; pre-registered protocol, five style bots, metrics, batch runner, statistics and analysis, held-out lock (not run), calibration (static only), one exploratory tuning-set run (450 games) with committed results, docs/EXPERIMENT.md; 894 tests pass; Phase 7 results reproduce exactly | User checks, then tag phase-8a-complete; Phase 8B only when the user says so
- 2026-10-19 | Phase 8B | Amendment A1 (final tilt at the last eligible wave, protocol version 2), archive of the v1 outputs, tuning set re-run (non-tilt columns identical), amendment report, static-mode diagnostics of the reward signal, six hand-written SVG figures with an index page, docs/results/README.md; 934 tests pass; Phase 7 results reproduce exactly; nothing under src changed; held-out set not run | User checks, then tag phase-8b-complete; Phase 9 only when the user says so
- 2026-10-19 | Phase 9A-1 | Early-loss check and style-contrast statistic, amendment A2 (protocol version 3: ablation styles, T1 retired, T2/T0, sensitivity and early-ends blocks), static recalibration (stage 3, noFrost dropped, tilePool 6 / upgradeAfter 4), archive of the focus-style outputs, tuning re-run with Director v1 (450 games), diagnostics with the reward contrast; 958 tests pass; Phase 7 results reproduce exactly (static 8 lives 18.9 min, adaptive 1 life 19.9 min, random 5 lives 19.0 min); nothing under src changed; held-out set not run | User checks, then tag phase-9a1-complete; Phase 9A-2 only when the user says so
- 2026-10-19 | Phase 9A-2a | Golden pin of the existing modes, train/validation split with a validation lock, static baseline table, Director v2 and the counter arm, runner modes, tiltByWave, minimal UI for the arms, first-look tool, first look on the train seeds (500 games), docs; 1035 tests pass; Phase 7 results reproduce exactly (static 8 lives 18.9 min, adaptive 1 life 19.9 min, random 5 lives 19.0 min); the 300 static/random/adaptive rows equal the committed tuning rows; validation and held-out seeds not run for the new arms | User checks, then tag phase-9a2a-complete; Phase 9A-2b only when the user says so
- 2026-10-19 | Phase 9A-2b-1 | Goldens for adaptive2/counter, CLI lock gate tests with stubs, incident record, prior control arm, first-look attribution chain, fixed-wave rule, tilt agreement, matched-set sensitivity, six-mode first look on the train seeds (600 games); 1081 tests pass; Phase 7 results reproduce exactly; the 500 older rows equal firstlook-train.rows.json in every column; protocol.js byte-identical; validation and held-out seeds not run | User checks, then tag phase-9a2b1-complete; Phase 9A-2b-2 only when the user says so
- 2026-10-19 | Phase 9A-2b-2 | Amendment A3 (protocol version 4: held-out 150 seeds, six confirmatory modes, PROTOCOL.confirmatory with K1-K3), v3 hypotheses golden, held-out gate for exactly the six modes, checkProtocolHash and PROTOCOL_PREVIOUS_HASHES, requiredN at the Holm level, confirmatory analysis code, confirm CLI with dry-run naming rules, plan-heldout, dry run on the train rows, pre-registration in docs/EXPERIMENT.md; 1109 tests pass; Phase 7 results reproduce exactly; nothing under src changed; held-out and validation seeds not run | User checks, then tag phase-9a2b2-complete (the freeze); Phase 9B (the held-out run) only when the user says so
