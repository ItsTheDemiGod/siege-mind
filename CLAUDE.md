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
- **Charts:** Chart.js, vendored locally into `vendor/` (NOT loaded from a CDN, so demos work offline).
- **Node.js 22+** is for dev tooling only: local server, tests (`node --test`), headless simulation.
- **Runtime dependencies allowed:** Chart.js only. Ask the user before adding anything else.
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
    sim/                     <- PURE logic, runs in Node
      rng.js
      game.js                <- top-level game state + step()
      map.js                 <- grid, path, buildable cells
      enemies.js
      towers.js
      projectiles.js
      waves.js               <- static wave script + wave runner
      economy.js
      events.js              <- tiny event bus
      stepper.js             <- fixed-timestep accumulator (pure math)
      damage.js              <- armor/shield/DoT damage model + events
      statuses.js            <- slow, poison, regen suppression
      director.js            <- adaptive Director AI (Phase 6)
      telemetry.js           <- per-wave stats collection (Phase 5)
    data/
      towers.js
      enemies.js
      waves.js               <- static script + threat-budget curve
      config.js              <- economy, lives, director hyperparameters
      map.js                 <- default map grid + waypoints
      enemies.js
      debugTools.js          <- debug tool/key table (Phase 2)
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
      fit.js                 <- canvas fit to window, DPR + backing-pixel budget
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
      keys.js                <- dev keyboard controls
    audio/
      synth.js               <- WebAudio procedural SFX
  tests/                     <- node:test unit tests (sim, enemies, damage, statuses, perf, color, theme parity, tween, particles, quality, settings, icons, render rules)
  experiments/
    bots.js                  <- bot player strategies
    run.js                   <- headless batch runner
    results/                 <- generated CSV/JSON (gitignored if large)
    analysis/                <- charts / stats for the report
  docs/
    DEMO_SCRIPT.md
    REPORT_NOTES.md
    screens/                 <- screenshots and GIFs for README/report
  .github/
    workflows/
      test.yml               <- CI (Phase 10, or earlier once a GitHub remote exists)
```

## 6. Game Design Spec

**Map:** one fixed winding path on a tile grid. Logical canvas 1280x720; a HUD strip is reserved at the top (80 px); the map grid is 20 columns x 10 rows of 64 px tiles = 1280x640, drawn below the HUD strip. The sim's world coordinates have their origin at the top-left corner of the MAP (not the canvas); only the renderer adds the 80 px HUD offset. Spawn tile (0,1), exit tile (19,7), path waypoints (in tile coordinates) (0,1) -> (17,1) -> (17,4) -> (2,4) -> (2,7) -> (19,7), an S-shaped path with two hairpin turns (total length 3520 world units). Blocked (non-buildable decor) tiles: (8,2) (9,2) (10,5) (11,5) (5,9) (6,9). Everything else is buildable. Towers are placed only on buildable tiles. Single entry, single base.

**Economy and lives (initial values, tunable in `config.js`):** start gold 150, lives 20, kill reward per enemy type (in data), tower sell refund 70%, 2 upgrade levels per tower.

**Towers**

| Tower | Role | Strong vs | Weak vs |
|---|---|---|---|
| Lance (piercing) | Single target, ignores armor | Armored Grunt | Swarmling |
| Mortar (splash) | AoE, slow shell | Swarmling | Fast Runner (shells miss), single tanky targets |
| Frost | Low damage, slows | Fast Runner (also supports every other tower) | Low standalone damage |
| Poison | Stacking damage over time, stops regeneration while poisoned | Regenerator | Fast Runner (leaves range before ticks land), Shielded Bruiser (shield blocks DoT) |
| Sniper | Long range, high damage, slow fire, bonus damage to shields | Shielded Bruiser | Swarmling, Fast Runner |

**Enemies**

| Enemy | Traits | Threat cost (per unit) |
|---|---|---|
| Armored Grunt | hp 120, speed 55, flat armor 6 (non-piercing damage), reward 10 | 10 |
| Swarmling | hp 28, speed 70, packs of 8 spaced 12 ticks, reward 2 | 3 (pick cost 24 per pack) |
| Fast Runner | hp 45, speed 130 (~2x), reward 6 | 8 |
| Regenerator | hp 260, speed 45, armor 1, regenerates 2% maxHp/s unless poisoned, reward 16, leaks for 2 lives | 16 |
| Shielded Bruiser | hp 220, speed 38, armor 3, shield 160 that must break first and blocks DoT, reward 24, leaks for 3 lives | 24 |

These are initial values (src/data/enemies.js), retuned in Phase 9.

Exact numeric stats are decided in Phases 2 and 3, stored in `src/data/`, and recorded in Section 13.

**Waves:** 30 waves. Each wave has a **threat budget** from an escalation curve in `data/waves.js`. Static Mode uses a fixed hand-authored composition per wave. Adaptive Mode spends the SAME budget but chooses composition via the Director. Boss/special waves (e.g. 10, 20, 30) are fixed in both modes.

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

## 7. Director AI Spec (Phase 6)

Weighted-bandit style, fully explainable. No deep learning.

- **State:** weight `w[type]` for each of the 5 enemy types (init uniform, sums to 1), plus per-type running stats.
- **After each wave**, for every type that spawned:
  - `leakRate = leaked / spawned`
  - `progress = mean(pathProgressAtDeathOrLeak)` in [0, 1] (leaked = 1)
  - `effectiveness = a * leakRate + b * progress` (defaults a=0.6, b=0.4, in `config.js`)
- **Update:** `target = softmax(effectiveness / temperature)` over spawned types, then `w = (1 - alpha) * w + alpha * target` (defaults alpha=0.4, temperature=0.25). Types that did not spawn keep their weight, decayed slightly toward uniform.
- **Safety:** floor `w >= 0.05` for every type (no type disappears), then renormalize. Epsilon-exploration: 10% of spawn slots drawn uniformly.
- **Composition:** sample enemies by weight with the seeded RNG until the wave's threat budget is spent. Packs (Swarmling) count as one pick.
- **Fairness invariant:** total threat per wave is identical between Static and Adaptive Mode. Adaptive may only change composition (and, as a stretch goal, spawn timing/clumping).
- **Explainability output per wave:** old weights, new weights, per-type effectiveness inputs, and a one-line human-readable reason (e.g. "Fast Runners leaked 40% -> weight up; Armored Grunts died at 22% of path -> weight down").

## 8. Telemetry Spec (Phase 5)

Collected via the event bus, never by sim code calling telemetry directly.

- **Per enemy:** id, type, spawnTime, outcome (killed/leaked), pathProgress at outcome, damage taken by source tower type, time alive.
- **Per tower:** type, placedAt wave, damage dealt, kills.
- **Per wave:** wave number, composition, threat budget, leaks, lives lost, gold earned/spent, tower loadout snapshot, Director weights (if adaptive).
- Exposed as plain JSON-serializable objects; exportable to JSON/CSV.

## 9. Experiment Harness Spec (Phase 8)

- Bot players in `experiments/bots.js`: `monoSplash`, `monoSniper`, `balanced`, `adaptiveBot` (shifts loadout toward whatever is leaking), `random`.
- Runner: `npm run sim -- --mode=static|adaptive --bot=<name> --seeds=30` executes full 30-wave games headless using the exact same `src/sim/` code.
- Metrics: wave reached, lives lost, total leaks, leak rate per enemy type, gold efficiency, Director weight trajectories.
- Output: CSV/JSON into `experiments/results/`; analysis scripts/charts in `experiments/analysis/` (JS with Chart.js, or optional Python pandas/matplotlib for report figures).
- Report mean +/- 95% CI and a significance test for Static vs Adaptive per bot.

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

### [ ] Phase 3 — Tower system
- [ ] Tile selection, placement, sell, 2 upgrade levels
- [ ] Targeting modes (first, strongest, closest) and range display
- [ ] 5 towers from `data/towers.js` with projectiles/effects (pierce, splash, slow, poison stacking + regen stop, sniper shield bonus)
- [ ] Counter relationships verifiably working
- [ ] Towers drawn procedurally with visible upgrade levels, rotation toward target, muzzle flash and recoil, projectile trails, distinct impact effects per tower, placement ghost with valid/invalid tint, range rings
**Done when:** each tower type visibly counters/loses to the enemies in Section 6; tests for damage and status effects.

### [ ] Phase 4 — Economy, static waves, game flow (playable baseline)
- [ ] Gold, kill rewards, build/upgrade costs, lives, win/lose conditions
- [ ] 30-wave static script + threat-budget curve in `data/waves.js`
- [ ] Wave runner (start wave button/auto-start, between-wave timer), HUD
- [ ] Main menu, game over/victory screens, restart
- [ ] Styled main menu, animated wave banner, between-wave countdown, base core with damage states, animated game over/victory screens
**Done when:** a human can play wave 1 to 30 in Static Mode start to finish.

### [ ] Phase 5 — Telemetry layer
- [ ] Event-bus subscribers collecting per-enemy, per-tower, per-wave data (Section 8)
- [ ] JSON/CSV export; telemetry unit tests
**Done when:** after any run, a complete telemetry object exists and exports cleanly.

### [ ] Phase 6 — Adaptive Director AI
- [ ] `director.js` implementing Section 7 with hyperparameters in `config.js`
- [ ] Budget-preserving composition sampler using seeded RNG
- [ ] Fixed special waves; fairness invariant test (same budget as static)
- [ ] Director unit tests (update math, floor, exploration, determinism)
**Done when:** in Adaptive Mode, waves visibly shift toward whatever the loadout handles worst, with equal total threat to Static.

### [ ] Phase 7 — Explainability overlay and mode UI
- [ ] Vendor Chart.js; live panel: effectiveness bars, weight history, per-wave reason text
- [ ] Menu toggle Static/Adaptive; in-game overlay show/hide hotkey
- [ ] Wave preview ("incoming composition") bar
- [ ] Director identity in violet (animated Director panel, animated weight bars, scan-sweep on composition change) and a 'Director's Report' end-of-run screen: weight timeline, what the Director learned about the player's build, and one-line plain-language insights
**Done when:** a viewer can watch the overlay and understand why each wave changed.

### [ ] Phase 8 — Headless experiment harness
- [ ] Bots (Section 9) and batch runner using the same `src/sim/` code
- [ ] Results to `experiments/results/`; analysis scripts and charts
- [ ] Stats (mean, 95% CI, significance test) for Static vs Adaptive
**Done when:** one command reproduces the full comparison and produces report-ready charts.

### [ ] Phase 9 — Final polish, audio, and balance
- [ ] Balance pass using harness data
- [ ] Procedural WebAudio SFX plus optional music
- [ ] Performance profiling against Section 2 criterion 8
- [ ] Accessibility pass (colorblind check, reduced motion)
- [ ] Final visual tuning in the gallery
- [ ] Tutorial/tooltips
- [ ] Settings screen
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
- 2026-10-18 | 1A/1B | Art direction: holographic war room, fully procedural visuals | Claude Code cannot author raster art and this style needs no assets
- 2026-10-18 | 1A/1B | Phase 1 split into 1A engine and 1B visual foundation | Visual quality is built in from the start, not bolted on in Phase 9
- 2026-10-18 | 1B | Visual bar: no placeholder visuals after Phase 1B | Keeps every later phase on-style

## 14. Known Issues / TODO
<!-- Add items as they appear; remove when fixed -->
- Browser behaviour of the debug scene (resize, DPR, key handling) was syntax-checked and served but only the user's manual check covers real rendering.
- Phase 0 test `tests/boot.test.js` is a runner sanity check only; it can be removed once real tests dominate.
- Debug walkers use `prevDistance`/`distance` interpolation; when real enemies arrive in Phase 2 they must keep the same prev/current pattern for smooth rendering.
- Phase 1B was NOT run in a real browser by Claude (extension not connected): no measured FPS, and layout/visuals are unverified beyond node --check, a stub-canvas smoke test and file serving. User approval pass needed.
- Whether Rajdhani digits are tabular is unknown until the gallery numerals row is read; HUD numbers use tabular-nums plus min-width regardless.
- p95 frame stat sorts a preallocated Float32Array 4x per second (typed-array sort may allocate internally); renderer allocates only at event time (fx.burst option spread, HUD count-up closures).
- Gallery effect-lab/map-preview stages each run a full renderer; both pause when scrolled out of view.
- Phase 2 was NOT run in a real browser by Claude (extension not connected): only the stub-canvas smoke tests, node --check and file serving were verified. Visual feel, 60 FPS with ~600 enemies, and click targeting need the user's check.
- The placeholder auto-spawner (random enemy every 90 ticks) is temporary; the wave runner replaces it in Phase 4. Enemies that reach the base only emit ENEMY_LEAKED (no lives are subtracted until Phase 4).
- Headless sim cost with 600 enemies: about 26k steps/s (roughly 0.04 ms per step); the render side at 600 enemies is unmeasured.

## 15. Session Log
<!-- Format: YYYY-MM-DD | Phase | What was done | What's next -->
- 2026-10-16 | Phase 0 | Verified Node v24.18.0 / Git 2.54; git init (main), .gitignore, package.json, folder skeleton, placeholder modules, dev server, boot page, trivial tests; checks passed | Phase 1: game loop, RNG, event bus, map rendering
- 2026-10-18 | Maintenance | Moved dev server to port 8137 (PORT override), dual-stack loopback bind, added dev alias, traversal tests, Node 22+ | Phase 1: game loop, RNG, event bus, map rendering
- 2026-10-18 | Docs | CLAUDE.md upgraded with Visual Design Bible, quality criteria, and Phase 1A/1B split | Phase 1A
- 2026-10-18 | Phase 1A | Built fixed-timestep stepper, seeded RNG with forks, strict event bus, validated 20x10 map and path, game state with temporary debug walkers, DPR-aware fit, debug renderer, dev keys; 96 tests pass; headless sim ~4.2M steps/s | Phase 1B: visual foundation and UI kit
- 2026-10-18 | Phase 1B | Built perf meters, vendored fonts, color/theme/tween/particles/floatText/shake/quality/settings/icons modules, procedural enemy shapes, layered renderer with cached static background, DOM UI kit (HUD, tooltip, toast, settings modal, debug panel), style gallery; 206 tests pass; no real-browser run | User approves the look (check main page and gallery), then Phase 2
- 2026-10-18 | Phase 2 | Built enemy data, damage model (armor/shield/DoT), statuses, spawn queue, order-preserving enemy lifecycle, corner-blended path sampling, enemy renderer (flash, spawn-in, statuses, health bars), sim-event fx, debug tools and keys, gallery enemy states; 272 tests pass; no real-browser run | User checks the visuals (main page + gallery), then Phase 3
