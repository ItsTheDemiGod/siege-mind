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

## 3. Tech Stack and Hard Constraints

- **Language:** vanilla JavaScript, ES modules. No TypeScript, no framework, no bundler.
- **Rendering:** HTML5 Canvas 2D.
- **Charts:** Chart.js, vendored locally into `vendor/` (NOT loaded from a CDN, so demos work offline).
- **Node.js 20+** is for dev tooling only: local server, tests (`node --test`), headless simulation.
- **Runtime dependencies allowed:** Chart.js only. Ask the user before adding anything else.
- **Target:** latest desktop Chrome/Edge. Logical canvas 1280x720, scaled to fit the window.
- **Assets:** prefer free CC0 assets (e.g. Kenney.nl) or procedurally drawn shapes. Early phases use simple placeholder shapes. Never use copyrighted assets.

## 4. Architecture Rules (non-negotiable; log any change in Section 13)

1. **Sim/render separation.** Everything in `src/sim/` is pure game logic with ZERO references to `window`, `document`, `canvas`, or any DOM API. It must run unchanged in Node. `src/render/` and `src/ui/` read sim state and never mutate it.
2. **Fixed timestep.** The sim advances in fixed steps of 1/60 s. Game speed (x1/x2/x3) = more sim steps per rendered frame, never a larger step.
3. **Seeded randomness.** All sim randomness goes through `src/sim/rng.js` (seeded PRNG such as mulberry32). `Math.random()` is forbidden inside `src/sim/`.
4. **Data-driven design.** All tower, enemy, wave, and economy numbers live in `src/data/`. No magic numbers in logic files.
5. **Event bus.** The sim emits events (`wave_started`, `enemy_spawned`, `enemy_killed`, `enemy_leaked`, `tower_fired`, `tower_placed`, `wave_ended`, `game_over`). Telemetry, audio, particles, and UI subscribe to events instead of being called directly from sim code.
6. **Serializable state.** Game state is plain objects/arrays (no class instances holding DOM or closures) so runs can be logged and replayed.
7. **Small modules.** One responsibility per file, aim for under ~300 lines, ES module imports/exports only, no globals.

## 5. Folder Structure (target)

```
siege-mind/
  CLAUDE.md                  <- this file
  README.md
  package.json               <- scripts: start, test, sim
  index.html
  vendor/                    <- chart.umd.js (vendored)
  src/
    main.js                  <- bootstraps game, wires sim + render + ui
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
      director.js            <- adaptive Director AI (Phase 6)
      telemetry.js           <- per-wave stats collection (Phase 5)
    data/
      towers.js
      enemies.js
      waves.js               <- static script + threat-budget curve
      config.js              <- economy, lives, director hyperparameters
    render/                  <- canvas drawing only
    ui/                      <- HUD, menus, overlays, analytics panel
    audio/
  tests/                     <- node:test unit tests for src/sim/*
  experiments/
    bots.js                  <- bot player strategies
    run.js                   <- headless batch runner
    results/                 <- generated CSV/JSON (gitignored if large)
    analysis/                <- charts / stats for the report
  docs/
    DEMO_SCRIPT.md
    REPORT_NOTES.md
```

## 6. Game Design Spec

**Map:** one fixed winding path on a tile grid (initial: 20x11 tiles of 64 px = 1280x704, plus a HUD strip). Towers are placed only on buildable tiles next to the path. Single entry, single base.

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

| Enemy | Traits | Threat cost |
|---|---|---|
| Armored Grunt | Medium HP, flat armor reduces non-piercing damage | defined in data |
| Swarmling | Low HP, spawns in packs of 8 | defined in data |
| Fast Runner | Low-medium HP, ~2x speed | defined in data |
| Regenerator | High HP, regenerates unless poisoned | defined in data |
| Shielded Bruiser | High HP plus a shield layer that must break first; shield ignores DoT | defined in data |

Exact numeric stats are decided in Phases 2 and 3, stored in `src/data/`, and recorded in Section 13.

**Waves:** 30 waves. Each wave has a **threat budget** from an escalation curve in `data/waves.js`. Static Mode uses a fixed hand-authored composition per wave. Adaptive Mode spends the SAME budget but chooses composition via the Director. Boss/special waves (e.g. 10, 20, 30) are fixed in both modes.

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
7. At the end of the phase:
   - Run all tests; fix failures.
   - Update the Phase Tracker (Section 12): tick completed items, set status.
   - Add entries to Decisions Log (13), Known Issues (14), Session Log (15).
   - `git add -A` and commit with message `phase-N: <short summary>`, then tag `phase-N-complete`.
   - Give the user a summary: what was built, how to run it, exactly what to check manually, known issues.
8. STOP and wait. Do not begin the next phase until the user says so.

## 12. Phase Tracker

Status key: [ ] not started, [~] in progress, [x] done

### [x] Phase 0 — Environment, repo, and project skeleton
- [x] Verify Node 20+, Git; init repo, `.gitignore`, `package.json` (scripts: start, test, sim)
- [x] Create folder structure from Section 5 (empty placeholder files where needed)
- [x] `index.html` + `main.js` that draws a blank canvas and logs "Siege Mind boot OK"
- [x] `npm start` serves the game locally; `npm test` runs a trivial passing test
- [x] Initial commit
**Done when:** `npm start` opens a blank canvas page with no console errors and `npm test` passes.

### [ ] Phase 1 — Core engine: game loop, map, path, rendering
- [ ] Fixed-timestep loop with x1/x2/x3 speed, pause
- [ ] Seeded RNG (`rng.js`) + determinism test
- [ ] Event bus
- [ ] Tile map, path definition, buildable cells; render grid and path
- [ ] Canvas scaling to window, basic debug HUD (FPS, tick count)
**Done when:** a styled map renders at 60 FPS, pause/speed work, tests pass.

### [ ] Phase 2 — Enemy system
- [ ] Path-following movement with `pathProgress` tracking
- [ ] 5 enemy types from `data/enemies.js` (HP, speed, armor, regen, shield, pack spawn)
- [ ] Damage model (armor, shield, DoT immunity rules), death and leak events
- [ ] Health bars/placeholder visuals; debug spawner (keys to spawn each type)
**Done when:** all 5 enemy types walk the path, behave per spec, and leak/die with correct events; unit tests for damage math.

### [ ] Phase 3 — Tower system
- [ ] Tile selection, placement, sell, 2 upgrade levels
- [ ] Targeting modes (first, strongest, closest) and range display
- [ ] 5 towers from `data/towers.js` with projectiles/effects (pierce, splash, slow, poison stacking + regen stop, sniper shield bonus)
- [ ] Counter relationships verifiably working
**Done when:** each tower type visibly counters/loses to the enemies in Section 6; tests for damage and status effects.

### [ ] Phase 4 — Economy, static waves, game flow (playable baseline)
- [ ] Gold, kill rewards, build/upgrade costs, lives, win/lose conditions
- [ ] 30-wave static script + threat-budget curve in `data/waves.js`
- [ ] Wave runner (start wave button/auto-start, between-wave timer), HUD
- [ ] Main menu, game over/victory screens, restart
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
**Done when:** a viewer can watch the overlay and understand why each wave changed.

### [ ] Phase 8 — Headless experiment harness
- [ ] Bots (Section 9) and batch runner using the same `src/sim/` code
- [ ] Results to `experiments/results/`; analysis scripts and charts
- [ ] Stats (mean, 95% CI, significance test) for Static vs Adaptive
**Done when:** one command reproduces the full comparison and produces report-ready charts.

### [ ] Phase 9 — Balance, juice, and polish
- [ ] Balance pass using harness data (no tower/enemy dominates)
- [ ] Particles, hit feedback, screen shake (subtle), tower/enemy art pass, audio SFX/music
- [ ] Tutorial/tooltips, settings (volume, speed), accessibility basics (colorblind-safe palette)
**Done when:** the game feels good to play for 15+ minutes and balance data supports it.

### [ ] Phase 10 — Docs, deployment, and demo
- [ ] README (what, why, how to run, architecture diagram, screenshots/GIFs)
- [ ] `docs/DEMO_SCRIPT.md` (side-by-side Static vs Adaptive demo)
- [ ] `docs/REPORT_NOTES.md` (method, DDA background, results, limitations, future work)
- [ ] Deploy (GitHub Pages or Vercel), final regression test, tag `v1.0`
**Done when:** public URL works and all Section 2 success criteria are met.

## 13. Decisions Log
<!-- Format: YYYY-MM-DD | Phase | Decision | Reason -->
- Project start | Stack fixed to vanilla JS + Canvas + Chart.js; sim/render separation, fixed timestep, and seeded RNG chosen so headless experiments (Phase 8) reuse the real game code.
- 2026-10-16 | 0 | Dev server is zero-dependency `scripts/serve.js` (node: built-ins only) on port 5173; 403 on path traversal, 404 on missing files | Keeps "no runtime deps" rule; simple and portable
- 2026-10-16 | 0 | `npm test` script is `node --test "tests/**/*.test.js"` instead of `node --test tests/` | Node 24 treats a bare directory arg as a module and fails; quoted glob works on Node 20+ and Windows
- 2026-10-16 | 0 | Placeholder modules under src/sim, src/data, experiments/bots.js contain only a comment + `export {};` | Valid ES modules until their phase
- 2026-10-16 | 0 | Dev server is zero-dependency `scripts/serve.js` (node: built-ins only) on port 5173; 403 on path traversal, 404 on missing files | Keeps "no runtime deps" rule; simple and portable
- 2026-10-16 | 0 | `npm test` script is `node --test "tests/**/*.test.js"` instead of `node --test tests/` | Node 24 treats a bare directory arg as a module and fails; quoted glob works on Node 20+ and Windows
- 2026-10-16 |