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

- **Static** (available): fixed, hand-authored waves, the same every run. The control group.
- **Adaptive** (shown, locked): the Director AI re-weights each wave against your towers. Arrives in Phase 6.
- Game length is Quick (15 waves) or Full (30 waves); the wave script, HP curve and economy are identical, Quick just ends after wave 15.
- A game is set up by its URL: `?seed=..&mode=static&waves=15|30&play=1` (without `play` or `debug` the menu opens first).

## Controls (dev)

| Key | Action |
|---|---|
| Esc | Cancel placing / deselect, otherwise open the pause menu |
| Space | Pause / resume |
| 1 / 2 / 3 | Game speed x1 / x2 / x3 |
| N | Single step (while paused) |
| ` (backquote) | Toggle debug HUD |

Add `?seed=<integer or text>` to the URL to replay a specific seed, e.g. http://localhost:8137/?seed=12345.

More dev controls:

- Backquote shows/hides the debug panel (hidden by default; FPS, frame ms avg/p95/max, ticks/s, sim speed, quality, particles).
- Enemies now come only from the 30 waves. `?debug=1&spawn=N` turns on the old random spawner (one random enemy every N ticks) for testing.
- The gear button in the HUD opens Settings (quality, auto-lower quality, screen shake, reduced motion, particle density).
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
