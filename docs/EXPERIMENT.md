# Experiment protocol (pre-registration)

This document fixes the experiment BEFORE any held-out data exist. The machine-readable version is `experiments/protocol.js` (its sha256, `protocolHash()`, is recorded in every results file and in the held-out lock). Changing the protocol after the held-out run would invalidate the confirmatory claim.

## Research question

Does an enemy director that adapts the composition of waves to a player's defense make the game harder than the same waves in a fixed script, and is that effect more than "different waves"? Three modes are compared: **static** (the hand-authored waves), **adaptive** (the Director, docs/DIRECTOR.md) and **random** (a control that applies random tilts of the same range and learns nothing).

Fairness invariants, identical in all three modes (tested): every wave spends the same threat (`STATIC_THREAT[wave]`, within the data tolerance), enemies get the same HP multiplier, and a game has the same number of waves. Only the composition of eligible waves differs.

## Players: the style bots

The earlier bots are deterministic and could not support an experiment (one layout per game, no variation across seeds). The experiment uses five **style bots** (`experiments/styleBots.js`) whose choices come from their own seeded random stream: `balancedR` (random tower mix), `lanceHeavy`, `mortarHeavy`, `poisonHeavy` and `sniperHeavy` (a focus tower plus a share for every other tower). Each build samples a tower type from the style's weights, picks a tile from the best `tilePool` free tiles, and from `upgradeAfter` towers on alternates between upgrades and builds. They act only through sim commands.

**Calibration rule (static mode only).** Bot strength must be sensible before any adaptive result is looked at: on the calibration seeds, in static mode, the mean win rate over the five styles must lie in [0.5, 0.9], every style must win at least 20%, and among the qualifying knob sets the one closest to a 0.7 mean wins (ties: larger tilePool, smaller focusWeight, smaller upgradeAfter). `npm run calibrate` evaluates a fixed grid (stage 1: tilePool 1, 3, 6 x focusWeight 0.3, 0.4, 0.5 at upgradeAfter 6; stage 2 only if needed adds upgradeAfter 4 and 8) and never runs adaptive or random mode. Chosen knobs: tilePool 1, focusWeight 0.3, upgradeAfter 6 (mean static win rate 0.64 on the calibration seeds; table in docs/results/calibration.md). A guard test (`tests/calibrationGuard.test.js`) re-checks the window and fails when the sim's balance changes, which means "recalibrate".

## Seed sets

- **calibration**: seeds 1001-1010 (static mode only, used for the bot knobs).
- **tuning**: seeds 1001-1030. Exploratory: used to look at results and to tune the Director in Phase 9.
- **held-out**: seeds 2001-2060, disjoint from every other set. Run once, at the end, through the lock (below).

Seeds 1-5 belong to earlier balance tests and are in no set. A game is the unit "style x mode x seed" (Quick, 15 waves); the full design is 5 styles x 3 modes x seeds (450 games for tuning, 900 for held-out).

## Hypotheses

Differences are always metric(mode A) minus metric(mode B), computed per (style, seed), averaged over the styles within each seed, then summarized over seeds.

| id | family | metric | comparison | expected direction |
|---|---|---|---|---|
| P1 | primary | livesLost | adaptive vs static | greater |
| P2 | primary | livesLost | adaptive vs random | greater |
| S1 | secondary | won | adaptive vs static | less |
| S2 | secondary | won | adaptive vs random | less |
| S3 | secondary | leakFraction | adaptive vs static | greater |
| S4 | secondary | leakFraction | adaptive vs random | greater |
| S5 | secondary | penetration | adaptive vs static | greater |
| S6 | secondary | penetration | adaptive vs random | greater |
| S7 | secondary | finalWave | adaptive vs static | less |
| S8 | secondary | finalWave | adaptive vs random | less |
| T1 | secondary | tiltAligned | adaptive vs random | greater |
| C1 | descriptive | livesLost | random vs static | greater (composition variability alone) |

**Tilt predictions** (for T1; a style is "aligned" when the final weight of at least one predicted type is >= 1.15): lanceHeavy: swarmling (a Lance is single-target); mortarHeavy: fastRunner (shells miss fast enemies); poisonHeavy: fastRunner and shieldedBruiser (poison needs time and shields block it); sniperHeavy: swarmling and fastRunner (slow shots, no splash). balancedR has no prediction and is skipped in T1.

## Metrics

- **livesLost**: the start lives (20) minus the lives left; a lost game counts as 20. **won**: 1 for a victory. **finalWave**: the wave reached when the game ended.
- **leakFraction**: leaked threat divided by spawned threat (threat = units times the enemy's threat cost), so it is comparable across compositions.
- **penetration**: the threat-weighted mean path progress of all enemies at death or leak (a leak counts as 1).
- **tiltAligned**: 1 when the **final tilt** of a predicted type is at least 1.15. The final tilt (amendment A1) is the applied tilt (`director.tilt`) of the LAST wave record whose `director.eligible` is true, the same rule for adaptive and random; static runs have all tilts 1. The column `tiltObserved` is 1 when an adaptive or random game reached at least one eligible wave, otherwise 0; `tiltAligned` is null when `tiltObserved` is 0 or the style has no prediction.
- Also recorded: minutes, towers and upgrades, damage shares per tower, adapted waves and the mean share shift (see `experiments/metrics.js`).

## Analysis plan

Seeds are the clusters: the same seed with different modes shares its random choices, so the analysis is paired and the seed-level differences are treated as independent observations. For each hypothesis: the mean difference, a 95% percentile **cluster bootstrap** interval (10,000 resamples of the seeds), a two-sided **sign-flip permutation test** on the mean difference (exact for up to 16 seeds, otherwise 100,000 random sign patterns; fixed random seed 20261019) and the paired effect size dz. **Holm** adjustment is applied separately within the primary family and the secondary family; descriptive comparisons are not adjusted. A power block reports the seed-level standard deviation and the number of seeds needed to detect the observed effect and half of it with 80% power. All of this is deterministic (`experiments/analyze.js`).

**No peeking, no tuning to results.** The held-out set is never run during tuning. The hypotheses, metrics and the analysis above do not change after the first adaptive or random result exists. Nothing is tuned to make the Director look better: if results are null, they are reported as null.

## Threats to validity

- The bots are scripted, not humans; the styles are a small family of tower mixes.
- One map and one set of enemies; the sim is deterministic, so seeds only change the enemy lanes and the bots' random choices.
- Tanky enemy types (Regenerator, Bruiser) travel further against most defenses, so they score higher and the Director tends to send more of them. That is the reason for the random control: compare adaptive with random before reading intent into the weights.
- Bot strength is calibrated on static outcomes only; the pooled analysis averages five styles, so a style-specific effect can be diluted (per-style results are reported).
- Many secondary comparisons (Holm handles the multiplicity inside the family).
- Director parameters may be tuned in Phase 9, on the tuning seed set only; the held-out set then gives one evaluation.

## Amendments

**A1 (protocol version 2): where the final weights are measured.** In Phase 8A the final tilt was the last wave record's applied tilt (random) or the held weights computed from the scores of the last record (adaptive). In random mode a game whose last wave record is a non-eligible wave (a fixed or introduction wave, or any wave before 5) reports a tilt of exactly 1 for every type, while adaptive uses held weights, so the two modes were measured differently and the random tilt-alignment rate was biased low. The new rule, for both modes: the final tilt is the applied tilt of the last wave record with `director.eligible` true, plus the flag `tiltObserved`. **Chronology:** this problem was noticed AFTER the tuning-set results had been seen (the Phase 8A analysis). The amendment concerns only the measurement of the final tilt; it changes no hypothesis, no metric behind P1-P2, S1-S8 or C1, and no seed set, and it was made before any held-out run. The Phase 8A tuning outputs are kept under docs/results/archive (tuning-v1.*), the tuning set was re-run under A1 (every column other than the tilt columns is identical, checked unit by unit) and docs/results/amendment-A1.md compares the two definitions.

## Planned next steps (written before any held-out run)

Director v2 will be developed using ONLY the tuning seeds; the v1 tuning results are reported as the "before"; the held-out set will be run once through the lock with the final Director.

## Status after Phase 8A (exploratory, tuning set)

On the 30 tuning seeds (docs/results/tuning-summary.md): P1 mean difference +1.48 lives (95% CI 0.85 to 2.15, Holm p 0.0002); P2 +0.06 (95% CI -0.65 to 0.75, Holm p 0.89); T1 is reversed (the random control leans toward the predicted types more often than the Director: -0.31). These are exploratory numbers, not the confirmatory evaluation.

## Reproduction

```
npm run calibrate                                   # bot knobs (static mode), writes docs/results/calibration.*
npm run experiment -- --set=tuning                  # 450 games, writes docs/results/tuning.csv and tuning.rows.json
npm run analyze -- --in=docs/results/tuning.rows.json --out=docs/results/tuning-summary
```

## The held-out procedure

The held-out set is run once, at the very end, with `npm run experiment -- --set=heldout --final --yes`. The command first consults the lock `experiments/heldout.lock.json`: it refuses without `--final` and `--yes`, with uncommitted changes (unless `--allow-dirty`, which the lock records), with an unknown git commit, and when a lock already exists (a repeat needs `--new-lock`). A successful run writes the lock BEFORE playing any game; the lock records the run index, the time, the git commit, whether the tree was dirty, a hash of the code that decides results and the protocol hash. A `runIndex` above 1 means the held-out set was run more than once; the report must state this, and the earlier locks are kept in the lock's `previous` list. The lock file is meant to be committed.
