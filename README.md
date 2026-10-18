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

## Controls (dev)

| Key | Action |
|---|---|
| Space | Pause / resume |
| 1 / 2 / 3 | Game speed x1 / x2 / x3 |
| N | Single step (while paused) |
| ` (backquote) | Toggle debug HUD |

Add `?seed=<integer or text>` to the URL to replay a specific seed, e.g. http://localhost:8137/?seed=12345.

More dev controls:

- Click on the map = spawn a test effect (ring, sparks, floating "+25", small shake).
- Backquote toggles the debug panel (FPS, frame ms avg/p95/max, ticks/s, sim speed, quality, particles).
- `?spawn=N` sets the placeholder auto-spawner (one random enemy every N ticks, 0 = off; default 90).
- The gear button in the HUD opens Settings (quality, auto-lower quality, screen shake, reduced motion, particle density).
- Style gallery: http://localhost:8137/gallery.html

### Debug tools (Phase 2)

- Spawn one enemy: Q grunt, W swarmling pack, E fast runner, R regenerator, T bruiser; Y one of each; K nukes everything.
- Pick a click tool: Z direct 40, X piercing 40, C sniper 60 (x3 vs shields), V poison, B frost, M splash 25 (radius 90). A toast names the tool; the debug panel shows it.
- Click on an enemy to apply the selected tool (a miss falls back to the plain test effect; splash always draws its ring).
- Settings has a "Floating damage numbers" switch (gold +N on kills is always shown).
