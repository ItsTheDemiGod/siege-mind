# docs/results

Experiment outputs, committed here (experiments/results stays git-ignored for scratch output). Protocol: docs/EXPERIMENT.md.

| File | What it is | Regenerate with | Status |
|---|---|---|---|
| calibration.json, calibration.md | The static-mode bot calibration (every knob combination, win rates, the chosen knobs) | `npm run calibrate` | calibration-seed run, used to fix the bots |
| tuning.csv, tuning.rows.json | The 450 tuning-set games (30 seeds x 5 styles x 3 modes) under protocol version 2 (amendment A1) | `npm run experiment -- --set=tuning` | exploratory |
| tuning-summary.json, tuning-summary.md | The pre-registered analysis of the tuning rows | `npm run analyze -- --in=docs/results/tuning.rows.json --out=docs/results/tuning-summary` | exploratory |
| amendment-A1.json, amendment-A1.md | Side-by-side comparison of the Phase 8A and the A1 definition of the final tilt | `npm run amendment-report` | exploratory |
| diagnostics.json, diagnostics.md | Static-mode diagnostics of the reward signal (baselines, variance decomposition, noise floor) | `npm run diagnose` | exploratory |
| figures/ | Six SVG figures and an index page built from the two files above | `npm run figures` | exploratory |
| archive/ | The Phase 8A tuning outputs (protocol version 1, legacy final-tilt definition) | kept for the record | superseded, not regenerable (protocol hash differs) |

Nothing here is confirmatory: the held-out seed set has not been run (experiments/heldout.lock.json does not exist).
