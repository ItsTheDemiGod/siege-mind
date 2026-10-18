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
