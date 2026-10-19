# Experiment protocol (pre-registration)

This document fixes the experiment BEFORE any held-out data exist. The machine-readable version is `experiments/protocol.js` (its sha256, `protocolHash()`, is recorded in every results file and in the held-out lock). Changing the protocol after the held-out run would invalidate the confirmatory claim.

## Research question

Does an enemy director that adapts the composition of waves to a player's defense make the game harder than the same waves in a fixed script, and is that effect more than "different waves"? Three modes are compared: **static** (the hand-authored waves), **adaptive** (the Director, docs/DIRECTOR.md) and **random** (a control that applies random tilts of the same range and learns nothing).

Fairness invariants, identical in all three modes (tested): every wave spends the same threat (`STATIC_THREAT[wave]`, within the data tolerance), enemies get the same HP multiplier, and a game has the same number of waves. Only the composition of eligible waves differs.

## Players: the style bots

The earlier bots are deterministic and could not support an experiment (one layout per game, no variation across seeds). Since amendment A2 (protocol version 3) the experiment uses **ablation** style bots (`experiments/styleBots.js`) whose choices come from their own seeded random stream: `balancedR` (random tower mix, 0.2 per tower) and `noLance`, `noMortar`, `noFrost`, `noPoison`, `noSniper` (weight 0 for the missing tower, 0.25 for each of the other four). The rationale: a defense that lacks a tower should be weak against exactly the enemy type that tower counters (the `strongVs` entry of the missing tower in `src/data/towers.js`), which gives each style a clean, pre-registered prediction (`noLance`: armoredGrunt; `noMortar`: swarmling; `noFrost`: fastRunner; `noPoison`: regenerator; `noSniper`: shieldedBruiser). The focus styles of protocol versions 1 and 2 (`lanceHeavy`, `mortarHeavy`, `poisonHeavy`, `sniperHeavy`) stay in the code so the archived results remain reproducible, but are not part of the protocol. **`noFrost` was dropped by the calibration (stage 3, below): it wins 0 of 10 static calibration games at the chosen knobs, so `PROTOCOL.styles` has five styles: balancedR, noLance, noMortar, noPoison, noSniper.** Each build samples a tower type from the style's weights, picks a tile from the best `tilePool` free tiles, and from `upgradeAfter` towers on alternates between upgrades and builds. They act only through sim commands.

**Calibration rule (static mode only).** Bot strength must be sensible before any adaptive result is looked at: on the calibration seeds, in static mode, the mean win rate must lie in [0.5, 0.9] and among the qualifying knob sets the one closest to a 0.7 mean wins (ties: larger tilePool, smaller upgradeAfter). `npm run calibrate` plays a fixed grid of nine combinations (tilePool 1, 3, 6 x upgradeAfter 4, 6, 8; focusWeight stays 0.3 and is ignored by the ablation styles), 540 static games on the calibration seeds, and never runs adaptive or random mode. The choice is made on those same results in up to three stages, no new games: **stage 1** every style wins at least 20%; **stage 2** every style wins at least 10%; **stage 3** styles whose static win rate is below 10% are dropped (balancedR may not be dropped, at least four styles must remain) and the mean is recomputed over the rest. Result: no combination qualifies in stage 1 or 2; one qualifies in stage 3. Chosen knobs: tilePool 6, focusWeight 0.3, upgradeAfter 4 (mean static win rate 0.520 over the five kept styles; noFrost dropped; table in docs/results/calibration.md). The consequence for interpretation: the mean sits just inside the lower bound, and noLance wins only 20% of its static calibration games, so ablation styles are weak defenses by construction. A guard test (`tests/calibrationGuard.test.js`) re-checks the window and fails when the sim's balance changes, which means "recalibrate".

## Seed sets

- **calibration**: seeds 1001-1010 (static mode only, used for the bot knobs).
- **tuning**: seeds 1001-1030. Exploratory: used to look at results and to tune the Director in Phase 9.
- **held-out**: seeds 2001-2060, disjoint from every other set. Run once, at the end, through the lock (below).

Seeds 1-5 belong to earlier balance tests and are in no set. A game is the unit "style x mode x seed" (Quick, 15 waves); the full design is 5 styles x 3 modes x seeds (450 games for tuning, 900 for held-out; protocol versions 1 and 2 had five different styles, protocol version 3 has the five listed above).

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
| T2 | secondary | tiltContrast | adaptive vs random | greater |
| T0 | descriptive | tiltContrast | random vs 0 | two-sided (null check) |
| C1 | descriptive | livesLost | random vs static | greater (composition variability alone) |

T1 (tilt alignment with a fixed 1.15 threshold) was **retired by amendment A2**: its reversal on the tuning data (the random control "aligned" more often than the Director) is kept in docs/results/archive as the reason. The threshold test favors the control by construction, because random tilts are drawn from [1/3, 3] and spread wider than the Director's. `tiltAligned` stays as a descriptive table (threshold 1.15) and is not a hypothesis.

**Style contrast (T2, T0).** Definition (identical to `experiments/contrast.js`): eligible rows are rows of the mode with `tiltObserved` 1. S is the set of styles with a non-empty prediction. For a seed g, a style s in S and a type t predicted for s, the pair is usable when the row (s, g) is eligible and at least one row (s', g) with s' in S minus {s} is eligible; its value is the final weight `tilt_t` of (s, g) minus the mean of `tilt_t` over those reference rows. The seed value is the mean of the usable pair values; seeds without a usable pair are dropped. The contrast asks whether a style's final weight on the type its missing tower would counter exceeds the same weight under the other styles. T2 is the paired seed-level difference of the contrast, adaptive minus random; T0 is the contrast of the random mode against 0 (two-sided). **The random control is the empirical null:** its tilts do not depend on the defense, so its contrast shows what the statistic gives when nothing is learned. T2 is inside the Holm-adjusted secondary family; T0 is descriptive. **Tilt predictions** (one type per ablation style, the `strongVs` entry of the missing tower): noLance: armoredGrunt; noMortar: swarmling; noFrost: fastRunner (dropped by calibration); noPoison: regenerator; noSniper: shieldedBruiser. balancedR has no prediction, so it is not in S and takes no part in the contrast (the contrast therefore compares the four ablation styles with each other).

**Sensitivity analysis (reached wave 5).** For P1, P2 and C1 the analysis is repeated on the units (style, seed) whose STATIC game reached wave 5 or later. This is a pre-treatment condition: waves 1-4 have identical compositions in all modes and the bots read the same state, so those games are identical in every mode up to wave 5. The block reports the units used and excluded, the mean difference, the 95% interval and the raw p (no Holm), and is labelled a sensitivity analysis. **Early-ends check:** the same (style, seed) units must end before wave 5 in every mode; the analysis prints a prominent warning when that invariant is violated.

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

**A2 (protocol version 3): ablation styles and the style-contrast hypotheses.** The focus styles were replaced by the ablation styles, T1 was retired and replaced by the contrast hypotheses T2 and T0, the bots were recalibrated (static mode only) and a reached-wave-5 sensitivity analysis and an early-ends check were added. Why: on the tuning data the Director behaved like a tankiness detector (similar final weights for every style) and T1 was reversed by construction; the focus styles had predictions that were guesses about weaknesses, whereas an ablation style has a prediction read from the tower data. **Chronology:** A2 was made after seeing the tuning results of protocol versions 1 and 2 and the Phase 8B diagnostics, before any held-out run. Nothing in the Director or the sim changed. The focus-style tuning outputs are archived in docs/results/archive (tuning-a1-focus.*, diagnostics-focus.*, figures-focus), the contrast statistic was first tried on those archived data as an exploratory, post-hoc sanity check (docs/results/contrast-focus-styles-exploratory.md, early-losses-focus-styles.md), and the tuning set was re-run with the unchanged Director (v1) under the new styles as the "before" (docs/results/tuning-summary.md).

## Planned next steps (written before any held-out run)

Director v2 and an informed counter arm will be built in Phase 9A-2 and tuned on the tuning seeds only; the v1 tuning results are reported as the "before". The confirmatory hypothesis family for the held-out run will be fixed in a further amendment (A3) BEFORE that run. The held-out set is run once through the lock with the final Director.

## Diagnostics

`npm run diagnose` measures, in STATIC games on the tuning seeds only (no Director involved), why the Director's weights follow enemy tankiness more than the player's defense. The hypothesis: the reward formula (leak damage times progress squared per unit of threat) is higher for tanky enemy types (Regenerator, Shielded Bruiser) than for fragile ones whatever the player builds, so a learner that follows the reward ends up favoring tanks. It reports (1) the pooled reward per enemy type in static baselines and its ratio to the all-type average, for all waves and for waves 5 and later; (2) a variance decomposition: the share of the variance of per-wave rewards explained by the bot style (etaStyle) and by the wave (etaWave); (3) a noise floor: the wave-to-wave sd of the reward for the same style, wave and type across seeds, compared with the spread between types. The diagnostics are used by no code in this phase; Director v2 may use them, developed on the tuning seeds only.

### Reward contrast

The reward contrast (`rewardContrast` in `experiments/diagnose.js`, static games on the tuning seeds, with the protocol styles and knobs) asks whether the quantity the Director learns from, the reward, differs between defenses in the predicted direction, with no Director involved. For each (seed, style, wave >= 5) group it takes the enemy types that spawned and carried at least `config.director.minThreatShare` of the wave's threat, forms the threat-weighted mean reward R of the group and the relative reward rel = reward / R of each type; the per-(seed, style, type) value is the threat-weighted mean of rel over the waves. The contrast is then computed exactly like the style contrast above (a style's value for its predicted type minus the mean over the other styles, per seed, summarized with a bootstrap interval and a sign-flip p against 0). A contrast near zero means no learning rule based on this reward can follow the defense, however it is tuned; that is why it matters for any Director v2.

## Figures

The figures below were built for protocol version 2 and are regenerated for the new styles in a later phase (the old set is in docs/results/archive/figures-focus). `npm run figures` builds six hand-written SVG figures (white background, Okabe-Ito colors, patterns and marker shapes in addition to color) and an index page into docs/results/figures: fig1-forest.svg (all hypotheses), fig2-lives-lost.svg, fig3-win-rate.svg, fig4-weights.svg (mean final weights), fig5-tilt-alignment.svg and fig6-diagnostics.svg. Captions describe what is plotted, never causes.

## Status after Phase 8A (exploratory, tuning set, protocol version 1, focus styles; archived)

On the 30 tuning seeds (archived in docs/results/archive/tuning-a1-focus-summary.md): P1 mean difference +1.48 lives (95% CI 0.85 to 2.15, Holm p 0.0002); P2 +0.06 (95% CI -0.65 to 0.75, Holm p 0.89); T1 is reversed (the random control leans toward the predicted types more often than the Director: -0.31). These are exploratory numbers, not the confirmatory evaluation.

## First look at the new arms (exploratory, training seeds)

**What was run.** Phase 9A-2a added two research arms next to the unchanged static, adaptive (v1) and random modes: `adaptive2` (Director v2: rewards divided by a static baseline, advantages shrunk for types with few units) and `counter` (an informed arm that reads the tower loadout; a ceiling, not a fair competitor); see docs/DIRECTOR.md. All five modes were played on the TRAIN seeds 1001-1020 (the first 20 tuning seeds) with the protocol styles and knobs (500 games, docs/results/firstlook-train.rows.json) and analyzed with `npm run first-look` (docs/results/firstlook-train-summary.md). **Nothing was tuned:** every parameter of the new arms has the initial value given in config.js, and the results were reported as printed. The 300 static, random and adaptive (v1) rows are identical in every column to the committed tuning rows (only the new JSON-only field `tiltByWave` is added).

**Chronology.** The arms were designed after seeing the protocol version 3 tuning results, before any validation or held-out run. The validation seeds (1021-1030) were not run for the new arms; `--split=validation` goes through its own lock (`experiments/validation.lock.json`, the same rules as the held-out lock) and has never been executed. PROTOCOL is unchanged (version 3): the new modes are allowed for the tuning set only.

**Population rule.** Comparisons use the units (style, seed) whose STATIC game reached wave 5 or later, a pre-treatment condition (waves 1-4 are identical in every mode, and the same units end early in every mode; the first-look output checks this across all five modes). Seed-level paired differences are averaged over the population styles of each seed; bootstrap intervals and sign-flip p-values use the protocol resample settings and are **not adjusted**.

**Fixed-wave contrast.** The final-tilt contrast of the protocol depends on how far each game got. The first look therefore also takes, for each wave W in 5, 7, 9, 11, 12, 13, 14, 15, the applied tilt of that wave (the JSON-only `tiltByWave`), computes the same style contrast as `contrastPerSeed` (a style's weight on its predicted type minus the other styles', same seed and mode) and reports the coverage (observed units over population units) next to it. The random control's tilts depend only on the seed and the wave, so they are identical across styles and **its fixed-wave contrast is exactly 0 by construction**; it is shown as a check of the statistic, not as a sampled null.

### Planned next steps (written before the next phase)

Phase 9A-2b will:
1. tune Director v2 on the TRAIN seeds only with this exact bounded grid: alpha in {0.35, 0.5, 0.7} x beta in {1, 1.5} x shrinkK in {2, 6} (12 combinations, adaptive2 mode only, all other parameters fixed), selecting the combination with the largest adaptive2-minus-random mean lives lost on the population among those whose fixed-wave contrast at the pre-chosen wave is positive;
2. run the validation seeds (1021-1030) ONCE through the validation lock for the chosen configuration, v1 and the counter arm;
3. write amendment A3 with the confirmatory hypotheses, the primary population (units whose static game reached wave 5), the fixed-wave contrast wave chosen by a coverage rule on the training data, and a held-out size of 150 seeds, before any held-out run.

## Incident log

- **2026-10-19, validation split run without a lock.** During Phase 9A-2a the command `node experiments/runExperimentCli.js --set=tuning --split=validation` was run once before the lock was wired into the CLI, so it executed the whole tuning set (450 games) without a lock. The output files were deleted without being read and no results were seen; the new arms were not run on those seeds. **Consequence:** seeds 1021-1030 were already part of the tuning set whose results were read in Phase 9A-1, so they are **not pristine**; the held-out seeds 2001+ are untouched and are the only confirmatory data. The lock path (gate before any game, lock written before the runner, refusals, dirty tree, existing lock, research arms refused for the held-out set) is now covered by tests/cli-lock.test.js with stubbed dependencies.

## Reproduction

```
npm run calibrate                                   # bot knobs (static mode), writes docs/results/calibration.*
npm run experiment -- --set=tuning                  # 450 games, writes docs/results/tuning.csv and tuning.rows.json
npm run analyze -- --in=docs/results/tuning.rows.json --out=docs/results/tuning-summary
```

## The held-out procedure

The held-out set is run once, at the very end, with `npm run experiment -- --set=heldout --final --yes`. The command first consults the lock `experiments/heldout.lock.json`: it refuses without `--final` and `--yes`, with uncommitted changes (unless `--allow-dirty`, which the lock records), with an unknown git commit, and when a lock already exists (a repeat needs `--new-lock`). A successful run writes the lock BEFORE playing any game; the lock records the run index, the time, the git commit, whether the tree was dirty, a hash of the code that decides results and the protocol hash. A `runIndex` above 1 means the held-out set was run more than once; the report must state this, and the earlier locks are kept in the lock's `previous` list. The lock file is meant to be committed.
