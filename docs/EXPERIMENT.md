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
- **held-out**: seeds 2001-2150 (150 seeds since amendment A3), disjoint from every other set. Run once, at the end, through the lock (below).

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

> Superseded by the held-out run (see docs/RESULTS.md): this plan was replaced by amendment A3 and carried out as the single held-out run; no arm was tuned.

## Diagnostics

`npm run diagnose` measures, in STATIC games on the tuning seeds only (no Director involved), why the Director's weights follow enemy tankiness more than the player's defense. The hypothesis: the reward formula (leak damage times progress squared per unit of threat) is higher for tanky enemy types (Regenerator, Shielded Bruiser) than for fragile ones whatever the player builds, so a learner that follows the reward ends up favoring tanks. It reports (1) the pooled reward per enemy type in static baselines and its ratio to the all-type average, for all waves and for waves 5 and later; (2) a variance decomposition: the share of the variance of per-wave rewards explained by the bot style (etaStyle) and by the wave (etaWave); (3) a noise floor: the wave-to-wave sd of the reward for the same style, wave and type across seeds, compared with the spread between types. The diagnostics are used by no code in this phase; Director v2 may use them, developed on the tuning seeds only.

### Reward contrast

The reward contrast (`rewardContrast` in `experiments/diagnose.js`, static games on the tuning seeds, with the protocol styles and knobs) asks whether the quantity the Director learns from, the reward, differs between defenses in the predicted direction, with no Director involved. For each (seed, style, wave >= 5) group it takes the enemy types that spawned and carried at least `config.director.minThreatShare` of the wave's threat, forms the threat-weighted mean reward R of the group and the relative reward rel = reward / R of each type; the per-(seed, style, type) value is the threat-weighted mean of rel over the waves. The contrast is then computed exactly like the style contrast above (a style's value for its predicted type minus the mean over the other styles, per seed, summarized with a bootstrap interval and a sign-flip p against 0). A contrast near zero means no learning rule based on this reward can follow the defense, however it is tuned; that is why it matters for any Director v2.

## Figures

The figures below were built for protocol version 2 and are regenerated for the new styles in a later phase (the old set is in docs/results/archive/figures-focus). `npm run figures` builds six hand-written SVG figures (white background, Okabe-Ito colors, patterns and marker shapes in addition to color) and an index page into docs/results/figures: fig1-forest.svg (all hypotheses), fig2-lives-lost.svg, fig3-win-rate.svg, fig4-weights.svg (mean final weights), fig5-tilt-alignment.svg and fig6-diagnostics.svg. Captions describe what is plotted, never causes.

> Superseded by the held-out run (see docs/RESULTS.md): the protocol-v4 figures (six modes, held-out data) are in docs/results/figures-final (`npm run figures:final`); the figures described here are legacy, built for protocol version 2.

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

> Superseded by the held-out run (see docs/RESULTS.md): this plan was replaced by amendment A3 and carried out as the single held-out run; no arm was tuned.

## Incident log

- **2026-10-19, validation split run without a lock.** During Phase 9A-2a the command `node experiments/runExperimentCli.js --set=tuning --split=validation` was run once before the lock was wired into the CLI, so it executed the whole tuning set (450 games) without a lock. The output files were deleted without being read and no results were seen; the new arms were not run on those seeds. **Consequence:** seeds 1021-1030 were already part of the tuning set whose results were read in Phase 9A-1, so they are **not pristine**; the held-out seeds 2001+ are untouched and are the only confirmatory data. The lock path (gate before any game, lock written before the runner, refusals, dirty tree, existing lock, research arms refused for the held-out set) is now covered by tests/cli-lock.test.js with stubbed dependencies.

## Six-mode first look (exploratory, training seeds)

**What was run.** All six modes (static, random, prior, adaptive, adaptive2, counter) on the TRAIN seeds 1001-1020 with the protocol styles and knobs (600 games, docs/results/firstlook-train6.rows.json) and analyzed with `npm run first-look` (docs/results/firstlook-train6-summary.md and .fixedwave.json). **Nothing was tuned:** the prior arm and the other arms have their initial parameter values, and the results were reported as printed. The 500 rows of the five older modes are identical in every column to the committed docs/results/firstlook-train.rows.json (checked with no ignored column).

**Chronology.** The prior arm and the attribution chain were designed after seeing the 9A-2a first-look results, before any validation or held-out run. The validation seeds (1021-1030) were not run for any arm; they are in any case **not pristine** (see the Incident log). PROTOCOL is unchanged (version 3).

**Attribution chain.** On the population (units whose static game reached wave 5), seed-level paired differences of lives lost split Director v1's total effect into three parts that add up exactly per seed: (adaptive - static) = (random - static) [composition variability] + (prior - random) [enemy-durability bias beyond variability] + (adaptive - prior) [learning on top of the prior]. The first-look output checks the identity per seed (tolerance 1e-9) and prints an error line if it ever fails. The same differences are reported for all five metrics and for adaptive2 and counter against static and prior. Nothing is adjusted for multiple comparisons.

> Superseded by the held-out run (see docs/RESULTS.md): K1 was not supported (random composition alone did not cost lives); most of Director v1's added difficulty was the fixed durability bias.

**Fixed-wave rule.** The fixed wave for the style contrast is chosen from coverage COUNTS only (never outcome values): the smallest eligible wave >= 9 whose minimum coverage over adaptive, adaptive2, counter, prior and random is at least 0.75; otherwise the wave with the largest minimum coverage (ties: the smaller wave). On these training data no candidate reached 75%, and the rule chose wave 9 (minimum coverage 70%) with `metRule` false; the table is written to firstlook-train6-summary.fixedwave.json. The contrast is also reported at every eligible wave 5, 7, 9, 11, 12, 13, 14, 15, with a matched-set sensitivity restricted to units observed at W in all of adaptive, adaptive2 and counter.

**Tilt agreement.** For pairs (adaptive, prior), (adaptive2, prior), (adaptive, adaptive2) and (random, prior): over units observed in both modes at an eligible wave, the mean over the five enemy types of |tilt A - tilt B|, per wave and pooled over all unit-wave cells. random against prior shows the scale of a disagreement; adaptive against prior shows how close v1 is to a fixed durability prior.

**Zero by construction.** The random control's tilts depend only on the seed and the wave and the prior's only on the wave, so both are identical across styles and their fixed-wave contrast is exactly 0 at every wave; the output asserts it and warns loudly otherwise.

### Planned next steps (written before the next phase)

Amendment A3 (protocol version 4) will fix, before any held-out run: the confirmatory modes (static, random, prior, adaptive, adaptive2, counter); the primary population (units whose static game reached wave 5); the fixed wave W* from the rule above; a confirmatory hypothesis family of two response hypotheses (fixed-wave style contrast of adaptive and of adaptive2 greater than 0) and four attribution hypotheses on lives lost (random - static greater than 0; prior - random, adaptive - prior and adaptive2 - prior two-sided) with Holm across the family; all other hypotheses reported as descriptive; a held-out size of 150 seeds; and no tuning of any arm before the held-out run. The held-out set is then run once through the lock.

> Superseded by the held-out run (see docs/RESULTS.md): this plan was replaced by amendment A3 and carried out as the single held-out run; no arm was tuned.

## Amendment A3 (protocol version 4)

This section is the pre-registration of the single held-out evaluation. The code (`experiments/confirmatory.js`, `confirmCli.js`, `fixedWave.js`), the protocol (`PROTOCOL.confirmatory` in `experiments/protocol.js`) and this document at the freeze commit define the confirmatory analysis.

**1. Chronology.** Amendment A3 was made after seeing the protocol version 3 tuning results, the Phase 9A-1 diagnostics and the Phase 9A-2 first looks on the training seeds (exploratory dry runs only), and before any held-out run. The seeds 1021-1030 were already part of the tuning set whose results were read in Phase 9A-1 (see the Incident log), so they are **not pristine** and are not used for confirmation. The held-out seeds 2001-2150 are untouched.

**2. What changed.** Protocol version 4. The held-out set grows from 60 to 150 seeds (2001-2150), so the run is 150 seeds x 5 styles x 6 modes = 4500 games (750 per mode). The six confirmatory modes are static, random, prior, adaptive, adaptive2 and counter; the held-out run uses exactly these six (no subsets). The new block `PROTOCOL.confirmatory` holds everything below. The version 3 exploratory hypotheses (P1-P2, S1-S8, T2, T0, C1) are unchanged and still apply to tuning-set analyses (a golden test pins them). Rows produced under version 3 can still be analyzed: the analysis CLI recognizes the version 3 hash and prints a note.

**3. Primary population and the confirmatory hypotheses.** The primary population is the set of units (style, seed) whose STATIC game reached wave 5 or later, a pre-treatment condition (waves 1-4 are identical in every mode); the same units are used in every mode. The confirmatory family is exactly three hypotheses:
- **K1** (metric): composition variability alone costs lives: livesLost(random) minus livesLost(static) is greater than 0. Seed-level value: for each seed, the mean over the population styles of that seed of the difference; seeds without a population unit are dropped and listed.
- **K2** (contrast): the final weights of Director v1 (adaptive) separate defenses in the predicted direction at wave 9.
- **K3** (contrast): the same for Director v2 (adaptive2).

For K2 and K3 the seed-level value is the fixed-wave style contrast: the applied tilt of wave 9 (`tiltByWave`) of a style on the enemy type predicted for it (`PROTOCOL.tiltPredictions`) minus the mean of the same tilt over the other styles that have predictions, in the same seed and mode; one pair per predicted type, a reference style is required (minReference 1), population units only, and only pairs whose predicted type is unlocked at the wave (the unlocked-only rule); a seed's value is the mean of its pairs and seeds without a usable pair are dropped and listed. Every hypothesis is tested with a two-sided sign-flip permutation test over seeds against 0 (exact for up to 16 seeds, otherwise 100,000 random sign patterns, fixed random seed), reported with a 95% cluster bootstrap interval over seeds, and the three p-values are adjusted together with Holm. **A hypothesis is supported only if its estimate has the predicted sign and its Holm-adjusted p is below 0.05.**

**4. The fixed-wave choice.** The primary wave is 9 and the secondary wave is 5. The coverage rule fixed in Phase 9A-2b-1 (smallest eligible wave >= 9 whose minimum coverage over adaptive, adaptive2, counter, prior and random is at least 0.75; otherwise the wave with the largest minimum coverage) was NOT met on the training seeds: the best minimum coverage was 70% at wave 9. Wave 9 is kept because it is the first eligible wave at which all four predicted enemy types are unlocked (Regenerator from wave 6, Shielded Bruiser from wave 8, and wave 8 is an introduction wave); wave 5 is the only pre-treatment wave and can test only the predicted types unlocked at that wave (two of the four). The coverage at wave 9 in the held-out data is reported as computed, together with what the rule would choose.

**5. Estimands and sensitivity analyses.** For every pair (random-static, prior-random, adaptive-prior, adaptive2-prior, adaptive-static, adaptive2-static, counter-static, counter-prior) and every metric (livesLost, won, finalWave, leakFraction, penetration) the analysis reports the seed-level population estimate with its 95% cluster bootstrap interval and **no p-values**. The attribution chain decomposes a Director's total effect exactly: (adaptive - static) = (random - static) [composition variability] + (prior - random) [enemy-durability bias beyond variability] + (adaptive - prior) [learning on top of the prior]. The fixed-wave contrast is also reported at waves 5, 9 and 13 for adaptive, adaptive2, counter, prior and random with coverage (random and prior are zero by construction and the output asserts it), and for adaptive, adaptive2 and counter also in a matched-set version (only units observed at that wave in all three). **Wave 13 is a DESCRIPTIVE estimand only:** it was added after seeing the training first look, in which the fixed-wave contrast grew with the wave as the Director accumulated evidence (adaptive 0.000 at wave 5, 0.118 at wave 9, about 0.26-0.31 at waves 12-14); wave 13 is a late wave with training coverage of 65-70% (wave 15, the last, has only 56-66%). Late-wave contrasts are conditional on surviving to that wave, are reported with coverage and matched-set versions, and are never confirmatory; K1-K3 and the primary wave 9 are unchanged. Sensitivity analyses: K1 on all units; K2 and K3 on the matched set of units observed at wave 9 in adaptive, adaptive2 and counter; leave-one-style-out recomputation of K1-K3. A descriptive, post hoc power note (seeds needed at the observed estimate and alpha 0.016667) is printed and is not part of the plan.

**6. The held-out procedure.** Exact commands, in this order: `git status` (must be clean), `npm run plan-heldout` (prints the plan and a rough runtime), `npm run experiment -- --set=heldout --final --yes`, then `npm run confirm -- --in=docs/results/heldout.rows.json --out=docs/results/heldout-confirmatory`. The lock `experiments/heldout.lock.json` is written BEFORE any game is played and records the git commit, the protocol hash and the `runIndex`. The rows file is written only when the whole run completes; if the run is interrupted nothing partial may be analysed. A re-run needs `--new-lock`, is recorded as runIndex 2 and the report must state the run index and that the data were evaluated N times; `npm run confirm` refuses rows without a lock run index, rows of another set, protocol version or protocol hash, and prints `held-out data evaluated N time(s) (run index N)`. A dry run on training data is allowed only with `--dry-run` and an output base name containing `dryrun`; it is labelled EXPLORATORY DRY RUN ON TRAINING DATA: NOT CONFIRMATORY. The analysis never computes a statistic on incomplete data.

**7. Interpretation guide (written before the results).** A supported K1 means that composition variability alone (random weights of the same total threat) costs the player lives in the scripted-bot setting; a supported K2 or K3 means that the Director's weights separate the defenses in the predicted direction at wave 9, that is, the weights respond to the defense rather than to the wave alone, within this setting. A hypothesis that is not supported means no detectable effect at this sample size; it is not proof of absence. Director v2 is expected to have low power for K3 (the dry run on 20 training seeds suggested a small, imprecise effect, and the post hoc estimate was about 240 seeds), and this is stated up front: a non-supported K3 must not be read as "v2 does not respond". The estimand tables describe sizes of effects, never causes beyond the exact decomposition above. The wave 13 contrasts are descriptive and conditional on survival to that wave: a larger contrast at wave 13 than at wave 9 would suggest that evidence accumulates, but it cannot be tested and must not be read as confirmation.

**Planned power (approximate, written before the run).** The dry run on the training seeds gave post hoc required seeds at the Holm level 0.016667 of K1 27, K2 52 and K3 244 (80% power at the training estimate). With the normal approximation power = Phi(3.2356 * sqrt(n / n80) - 2.394), the approximate power at 150 seeds is: K1 about 1; K2 about 0.99 if the true effect equals the training estimate and about 0.64 if it is half of it; K3 about 0.56 if the true effect equals the training estimate and lower if it is smaller (about 0.13 at half of it). Seeds dropped for coverage (about 20-30% at wave 9) reduce the effective sample, so K3 is expected to be under-powered and a non-supported K3 would not show the absence of an effect.

**8. Limits stated in advance.** The players are scripted bots with fixed tower mixes, calibrated in static mode only; there is one map and one enemy set; the styles are pooled in the primary analysis (leave-one-style-out is the check); the counter arm reads the tower loadout and is a reference, not a fair competitor; results on the tuning and training seeds are exploratory.

**9. The no-tuning rule.** After this commit and before the held-out run no arm, parameter, population, wave or hypothesis may be changed. Any change requires a new amendment (A4) written before the run.

**10. Freeze.** This document, the code and the protocol at the freeze commit define the confirmatory analysis; the user creates the git tag `phase-9a2b2-complete` at the freeze; the held-out lock records the git commit of the run, so a run on any other commit is visible.

## Results of the held-out run (run index 1)

The single held-out run (150 seeds x 5 styles x 6 modes, lock run index 1) was evaluated with `npm run confirm`. The full results document is docs/RESULTS.md (generated; every number in it is read from the JSON outputs); the confirmatory analysis itself is docs/results/heldout-confirmatory.json and .md; the protocol-v4 figures are in docs/results/figures-final (`npm run figures:final`, index.html); the held-out rows and CSV are docs/results/heldout.rows.json and heldout.csv.

- **K1** (random minus static, lives lost) was not supported: random composition alone did not cost lives, and the training estimate that had suggested otherwise did not replicate.
- **K2** (Director v1 weights separate defenses at wave 9) was supported.
- **K3** (Director v2 weights separate defenses at wave 9) was supported.

Everything else is estimation with intervals and no p-values; the per-pair contrasts in docs/RESULTS.md are post hoc. The amendments that fixed the plan are A1, A2 and A3 above; the incident log above records the one unlocked validation-split run (seeds 1021-1030 are not pristine and were not used for confirmation).

## Reproduction

```
npm run calibrate                                   # bot knobs (static mode), writes docs/results/calibration.*
npm run experiment -- --set=tuning                  # 450 games, writes docs/results/tuning.csv and tuning.rows.json
npm run analyze -- --in=docs/results/tuning.rows.json --out=docs/results/tuning-summary
```

## The held-out procedure

The held-out set is run once, at the very end, with `npm run experiment -- --set=heldout --final --yes`. The command first consults the lock `experiments/heldout.lock.json`: it refuses without `--final` and `--yes`, with uncommitted changes (unless `--allow-dirty`, which the lock records), with an unknown git commit, and when a lock already exists (a repeat needs `--new-lock`). A successful run writes the lock BEFORE playing any game; the lock records the run index, the time, the git commit, whether the tree was dirty, a hash of the code that decides results and the protocol hash. A `runIndex` above 1 means the held-out set was run more than once; the report must state this, and the earlier locks are kept in the lock's `previous` list. The lock file is meant to be committed.
