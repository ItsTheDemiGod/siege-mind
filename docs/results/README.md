# docs/results

Experiment outputs, committed here (experiments/results stays git-ignored for scratch output). Protocol: docs/EXPERIMENT.md.

| File | What it is | Regenerate with | Status |
|---|---|---|---|
| calibration.json, calibration.md | The static-mode bot calibration for the ablation styles (nine combinations, win rates, the stage that qualified, the chosen knobs, the dropped style) | `npm run calibrate` | calibration-seed run, used to fix the bots |
| early-losses-focus-styles.json, .md | Which archived focus-style games ended before wave 5, per mode | `npm run early-losses -- --in=docs/results/archive/tuning-a1-focus.rows.json --out=docs/results/early-losses-focus-styles` | exploratory, post-hoc |
| contrast-focus-styles-exploratory.json, .md | The style-contrast statistic tried on the archived focus-style rows | `npm run contrast -- --in=docs/results/archive/tuning-a1-focus.rows.json --preset=focus --out=docs/results/contrast-focus-styles-exploratory` | exploratory, post-hoc (designed after seeing these data) |
| tuning.csv, tuning.rows.json | The 450 tuning-set games (30 seeds x 5 styles x 3 modes: static, adaptive with Director v1, random) under protocol version 3 (amendment A2, ablation styles) | `npm run experiment -- --set=tuning` | exploratory; the "before" for Director v2 |
| tuning-summary.json, tuning-summary.md | The pre-registered analysis of those rows (P1, P2, S1-S8, T2, T0, C1, contrast, early ends, reached-wave-5 sensitivity) | `npm run analyze -- --in=docs/results/tuning.rows.json --out=docs/results/tuning-summary` | exploratory |
| diagnostics.json, diagnostics.md | Static-mode diagnostics of the reward signal for the ablation styles: baselines, variance decomposition, noise floor, reward contrast | `npm run diagnose` | exploratory |
| firstlook-train.rows.json, firstlook-train.csv | 500 games on the TRAIN seeds 1001-1020 (5 styles x 5 modes: static, random, adaptive, adaptive2, counter), protocol version 3 | `npm run experiment -- --set=tuning --split=train --modes=static,random,adaptive,adaptive2,counter --base=firstlook-train` | exploratory; nothing tuned; the static, random and adaptive rows equal the committed tuning rows except for the added `tiltByWave` field |
| firstlook-train-summary.json, firstlook-train-summary.md | The first look: population (static game reached wave 5), descriptive tables, paired mode differences (not adjusted), fixed-wave style contrast with coverage, early-ends check | `npm run first-look -- --in=docs/results/firstlook-train.rows.json --out=docs/results/firstlook-train-summary` | exploratory |
| firstlook-train6.rows.json, firstlook-train6.csv | 600 games on the TRAIN seeds 1001-1020 (5 styles x 6 modes: static, random, prior, adaptive, adaptive2, counter), protocol version 3 | `npm run experiment -- --set=tuning --split=train --modes=static,random,prior,adaptive,adaptive2,counter --base=firstlook-train6` | exploratory; nothing tuned; the 500 rows of the five older modes equal firstlook-train.rows.json column for column |
| firstlook-train6-summary.json, .md, .fixedwave.json | The six-mode first look: attribution chain with its identity check, fixed-wave style contrast with coverage and the matched-set sensitivity, the pre-registered fixed-wave choice (counts only), tilt agreement, mean tilts, early-ends check | `npm run first-look -- --in=docs/results/firstlook-train6.rows.json --out=docs/results/firstlook-train6-summary` | exploratory |
| confirm-dryrun-train.json, .md | Dry run of the confirmatory analysis (amendment A3) on the six-mode TRAIN rows, labelled EXPLORATORY DRY RUN ON TRAINING DATA: NOT CONFIRMATORY | `npm run confirm -- --in=docs/results/firstlook-train6.rows.json --dry-run --out=docs/results/confirm-dryrun-train` | exploratory; did not change the plan |
| heldout.rows.json, heldout.csv, heldout-confirmatory.json, .md | The single held-out run (150 seeds x 5 styles x 6 modes) and its confirmatory analysis | `npm run experiment -- --set=heldout --final --yes`, then `npm run confirm -- --in=docs/results/heldout.rows.json --out=docs/results/heldout-confirmatory` | **confirmatory** (the single held-out run, lock run index 1); the only confirmatory data in this folder |
| figures-final/ (fig1-confirmatory ... fig6-pair-contrasts .svg, index.html) | The six protocol-v4 figures (held-out data, training comparison, post hoc per-pair contrasts); every figure shows its N and an evidence-status tag | `npm run figures:final` | held-out estimates (fig1 confirmatory, fig2-5 estimates, fig6 post hoc) |
| firstlook-train6.rows.json (input) | Besides being the training data of the six-mode first look, this file is an input of the results package: the per-pair replication table in ../RESULTS.md and figure 6 read it (read-only, validated as the train split) | read by `npm run results-doc` and `npm run figures:final` | exploratory |
| ../RESULTS.md | The generated results document; every number is read from the JSON files here, and the generator refuses to run if the fixed text no longer matches the data | `npm run results-doc` | generated from the held-out run |
| archive/ | Superseded outputs, see below | kept for the record | superseded |

## archive/

- `tuning-v1.*`, `tuning-v1-summary.*`: the Phase 8A tuning outputs (protocol version 1, legacy final-tilt definition). Not regenerable (protocol hash differs).
- `tuning-a1-focus.csv`, `tuning-a1-focus.rows.json`, `tuning-a1-focus-summary.*`: the tuning set (450 games, five focus styles) re-run under amendment A1, protocol version 2. Not regenerable with the current protocol; the focus bots remain in the code.
- `amendment-A1.*`: comparison of the Phase 8A and the A1 definition of the final tilt.
- `diagnostics-focus.*`: static-mode diagnostics of the reward signal for the focus styles.
- `figures-focus/`: the six SVG figures built from the focus-style analysis. The figures are regenerated for the new styles in a later phase.

The legacy figures (`npm run figures`, protocol version 2) are not regenerated: they stay as they were and their default input paths no longer exist; the figures of the held-out evaluation are `npm run figures:final`.

Status: the training, tuning, calibration, first-look and diagnostics outputs above are **exploratory** and were used to design the confirmatory plan. Only heldout.* and heldout-confirmatory.* are confirmatory (experiments/heldout.lock.json, run index 1); generated outputs (anything a script writes here) are never edited by hand.
