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
- `?spawn=N` sets the debug walker spawn interval in ticks (stress test: `?spawn=6` gives roughly 360 walkers).
- The gear button in the HUD opens Settings (quality, auto-lower quality, screen shake, reduced motion, particle density).
- Style gallery: http://localhost:8137/gallery.html
