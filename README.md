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
