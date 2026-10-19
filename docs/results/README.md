# docs/results

Experiment outputs, committed here (experiments/results stays git-ignored for scratch output). Protocol: docs/EXPERIMENT.md.

| File | What it is | Regenerate with | Status |
|---|---|---|---|
| calibration.json, calibration.md | The static-mode bot calibration for the ablation styles (nine combinations, win rates, the stage that qualified, the chosen knobs, the dropped style) | `npm run calibrate` | calibration-seed run, used to fix the bots |
| early-losses-focus-styles.json, .md | Which archived focus-style games ended before wave 5, per mode | `npm run early-losses -- --in=docs/results/archive/tuning-a1-focus.rows.json --out=docs/results/early-losses-focus-styles` | exploratory, post-hoc |
| contrast-focus-styles-exploratory.json, .md | The style-contrast statistic tried on the archived focus-style rows | `npm run contrast -- --in=docs/results/archive/tuning-a1-focus.rows.json --preset=focus --out=docs/results/contrast-focus-styles-exploratory` | exploratory, post-hoc (designed after seeing these data) |
| archive/ | Superseded outputs, see below | kept for the record | superseded |

## archive/

- `tuning-v1.*`, `tuning-v1-summary.*`: the Phase 8A tuning outputs (protocol version 1, legacy final-tilt definition). Not regenerable (protocol hash differs).
- `tuning-a1-focus.csv`, `tuning-a1-focus.rows.json`, `tuning-a1-focus-summary.*`: the tuning set (450 games, five focus styles) re-run under amendment A1, protocol version 2. Not regenerable with the current protocol; the focus bots remain in the code.
- `amendment-A1.*`: comparison of the Phase 8A and the A1 definition of the final tilt.
- `diagnostics-focus.*`: static-mode diagnostics of the reward signal for the focus styles.
- `figures-focus/`: the six SVG figures built from the focus-style analysis. The figures are regenerated for the new styles in a later phase.

The tuning rows and the analysis of the current protocol (version 3, ablation styles, Director v1) and the refreshed diagnostics are added here after the tuning re-run.

Nothing here is confirmatory: the held-out seed set has not been run (experiments/heldout.lock.json does not exist).
