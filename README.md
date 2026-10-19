# Siege Mind

A browser tower defense game where an adaptive Director AI re-weights enemy waves against your tower loadout.
Includes a headless, seeded experiment harness comparing Static vs Adaptive mode.

## Run locally

```
npm start      # or: npm run dev
```

Then open http://localhost:8137. To use another port, set `PORT`:

```
# PowerShell
$env:PORT=9000; npm start
# cmd
set PORT=9000 && npm start
# bash
PORT=9000 npm start
```

## How to play

Open the game, pick **Quick** (15 waves, about 20 minutes) or **Full** (30 waves, about 45 minutes), optionally type a seed, and press **Start**. Stop the enemies reaching your base: build towers (**A S D F G** or the tray at the top), click a tower to upgrade (**U**) or sell (**Delete**) it, press **Enter** to start a wave, **1 2 3** for speed, **Space** to pause, **Esc** for the pause menu. The "How to play" button in the menu and the pause menu explains the five enemies.

## Game modes

- **Static**: fixed, hand-authored waves, the same every run. The control group.
- **Adaptive**: the Director AI watches how far each enemy type gets against your defense and tilts the mix of eligible waves toward what worked. Every wave still spends exactly the same threat and enemy HP as Static, so only the composition changes; waves 1-4, 6, 8 and the set pieces (10, 20, 30) stay as written. A small violet line in the wave banner and preview says when the Director adapted a wave.
- **Random control**: reachable only with `?mode=random`. It tilts waves at random by the same amount and learns nothing; it exists so results can be compared against "just different" waves.
- Game length is Quick (15 waves) or Full (30 waves); the wave script, HP curve and economy are identical, Quick just ends after wave 15.
- A game is set up by its URL: `?seed=..&mode=static|adaptive|random&waves=15|30&play=1` (without `play` or `debug` the menu opens first).
- `npm run compare -- --bots=weak,monoMortar,monoSniper,balanced --modes=static,adaptive,random --seeds=1,2,3 --waves=15` plays all combinations headlessly and prints the comparison tables and the report-only hypotheses. How the Director works: [docs/DIRECTOR.md](docs/DIRECTOR.md).

## Controls (dev)

| Key | Action |
|---|---|
| Esc | Cancel placing / deselect, otherwise open the pause menu |
| Space | Pause / resume |
| M | Mute / unmute the sound (also in the pause menu and Settings) |
| Arrow keys | While a tower is armed: move the placement cursor to the next buildable tile; **Enter** places the tower there (otherwise Enter starts the wave) |
| [ / ] | Select the previous / next tower |
| 1 / 2 / 3 | Game speed x1 / x2 / x3 |
| N | Single step (while paused) |
| ` (backquote) | Toggle debug HUD |

Add `?seed=<integer or text>` to the URL to replay a specific seed, e.g. http://localhost:8137/?seed=12345.

More dev controls:

- Backquote shows/hides the debug panel (hidden by default; FPS, frame ms avg/p95/max, ticks/s, sim speed, quality, particles).
- Enemies now come only from the 30 waves. `?debug=1&spawn=N` turns on the old random spawner (one random enemy every N ticks) for testing.
- The gear button in the HUD opens Settings (quality, auto-lower quality, screen shake, reduced motion, particle density, sound on/off, master and effects volume, and **Reset hints**).
- First-run hints: four short tips appear top left in your first game (build, start the wave, upgrade, and in the adaptive modes the Director). **Got it** dismisses one, **Skip all hints** turns them off, Settings brings them back. They never appear in `?debug=1` games.

### Sound

All sounds are generated live in the browser from oscillators and filtered noise (Web Audio); nothing is downloaded. The browser starts audio after your first click or key press. Master and effects volume are in Settings, **M** mutes. The Sound lab in the style gallery (http://localhost:8137/gallery.html, section 8) plays every sound, stress-tests the voice limiter and analyzes every sound offline (peak, loudness, DC offset, leading silence).

### Audit (dev)

`npm run audit` drives a headless Chrome through the main screens and writes docs/AUDIT.md: accessible names and roles, dialogs and focus traps, focus rings, text contrast, overflow at four window sizes, reduced motion and frame times in stress mode (measured without a GPU: an upper bound).
- Style gallery: http://localhost:8137/gallery.html

### Building towers (Phase 3A)

- Hotkeys: **A** Lance, **S** Mortar, **D** Frost, **F** Poison, **G** Sniper arm a tower (or click it in the HUD tray); click a free tile to build; pressing the same key again, **Esc** or right click stops placing.
- Click a tower to select it: **U** upgrades, **Delete** / **Backspace** sells (70% of everything invested), the panel has targeting (First / Strongest / Closest) and shows its damage and kills.
- Placement works while paused. `npm run matchups` prints the tower-vs-enemy matchup table (also written to experiments/results/matchups.json).

### Debug tools (need `?debug=1`)

- `?debug=1` unlocks everything below plus the click test effect on the map; `?gold=N` (debug only) sets the starting gold. Without `?debug=1` none of these keys do anything.

- Spawn one enemy: Q grunt, W swarmling pack, E fast runner, R regenerator, T bruiser; Y one of each; K nukes everything.
- Pick a click tool: Z direct 40, X piercing 40, C sniper 60 (x3 vs shields), V poison, B frost, M splash 25 (radius 90). A toast names the tool; the debug panel shows it.
- Click on an enemy to apply the selected tool (a miss falls back to the plain test effect; splash always draws its ring).
- Settings has a "Floating damage numbers" switch (gold +N on kills is always shown).

### Waves and the end of the game (Phase 4A)

- A wave control at the bottom centre shows the wave state. **Enter** (or its button) starts the next wave; wave 1 waits for you, later waves start automatically after a 12 s intermission (shown as a countdown ring; starting early is allowed and pays no bonus). Clearing a wave pays 13 + 6 x wave gold. A banner announces each wave and, between waves, a preview above the wave control shows what is coming.
- Leaks cost lives; at 0 lives, or after clearing the last wave (15 or 30), an animated results screen appears with a wave-by-wave strip and **Retry same seed**, **New seed** and **Main menu**. Esc hides it; "Show results" brings it back.
- `?debug=1&wave=N` starts at wave N, `?debug=1&startlives=N` sets the lives, `?mode=` accepts only `static` (anything else shows a toast; Adaptive arrives in Phase 6).
- `npm run playthrough -- --bot=balanced --seed=1 --waves=15|30` plays a full headless game with a bot and prints a per-wave table (bots: `none`, `weak`, `balanced`; the table also shows the enemy HP multiplier and seconds per wave).

### Difficulty knobs (Phase 4A.2)

- Enemy HP and shield grow with the wave number: `config.waves.hpCurve` is `'exponential'` (`hpGrowthPerWave`, compounding) or `'polynomial'` (`1 + hpLinear * d + hpQuad * d^2`, d = wave - 1). Armor, speed, rewards and threat costs do not scale. Regeneration heals a fraction of the enemy type's BASE HP, so healing does not grow with the multiplier.
- Tower prices grow with the number of towers owned: price = round(base * (1 + `config.economy.towerCostGrowth` * towers owned)); upgrades are not scaled; the cap is `config.towers.maxTowers` = 60. Selling refunds 70% of what was paid.
- `npm run playthrough -- --bot=none|weak|balanced --seed=1` replays a whole game headlessly and prints the per-wave table; `tests/balance.test.js` asserts the bot ladder.

## Run data (telemetry)

Every game records what happened (observation only; it never changes the game): per-wave results, damage by tower type, per-tower and per-enemy records, gold and lives. Full schema and rules: [docs/TELEMETRY.md](docs/TELEMETRY.md).

- **In the browser:** the end screen has **Download data (JSON)** and **Wave table (CSV)**; the pause menu (Esc) has **Download run data**. The debug panel (backquote) shows a `telemetry:` counter line.
- **Headless:** `npm run playthrough -- --bot=balanced --seed=1 --waves=15 --telemetry=full` (or `summary`, which omits the per-enemy records) writes `<bot>_seed<N>_static_w<W>.json`, `.waves.csv`, `.wavetypes.csv`, `.towers.csv` and (full only) `.enemies.csv` into `experiments/results/` (change it with `--out=DIR`), then validates the run.
- **Read a run:** `npm run summarize -- experiments/results/balanced_seed1_static_w15.json` prints per-wave, damage-by-source, per-enemy-type and tower tables.

## Browser check (dev)

Dev-only tools that drive a local headless Chrome, Chromium or Edge over the DevTools protocol (Node built-ins only; set `CHROME_PATH` if it is not found). They are not part of `npm test`.

- `npm run smoke:browser` loads the menu, a game, the gallery and the 40-tower stress mode, checks each page came up, and saves screenshots into `tools/browser-check/out/` (git-ignored).
- `npm run browser-check -- --url=/?seed=1&play=1 --wait=3000 --shot=game.png --eval="document.title"` loads one page (a path uses a built-in static server) and exits 1 on any console error, exception or failed request.

## Experiments

The comparison of the three modes is pre-registered in [docs/EXPERIMENT.md](docs/EXPERIMENT.md). `npm run calibrate` chooses the style bots' knobs (static mode only), `npm run experiment -- --set=tuning` plays the 450 tuning games into `docs/results/`, and `npm run analyze -- --in=docs/results/tuning.rows.json --out=docs/results/tuning-summary` prints and writes the analysis. The held-out seed set is run once, at the end, through a lock (`experiments/heldout.lock.json`).
