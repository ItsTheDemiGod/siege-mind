## Research question and method

### The question

Does an enemy director that adapts the composition of waves to a player's defense make the game harder than the same waves in a fixed script, and is that effect more than "different waves"? (`docs/EXPERIMENT.md`, Research question.) The study grew over time: the first questions concerned Director v1, and later phases added arms that split its effect into parts.

### Fairness

In every mode each wave spends the same threat, enemies get the same hit point multiplier and a game has the same number of waves; only the composition of eligible waves differs. Eligible waves exclude the fixed set pieces, the introduction waves and the first waves; the Director still learns from every finished wave (`docs/EXPERIMENT.md`, Research question; `CLAUDE.md`, Director AI Spec). These invariants are tested.

### The Director in one paragraph

For each enemy type that spawned in a wave, the Director computes a reward from how far the units got, with leaks counting as full progress, relative to their threat cost. It compares each type with the threat-weighted average, smooths that advantage into a running score, and turns the score into a bounded weight (tilt) that multiplies the type's template share before the shares are renormalized and turned into a wave that spends the target threat (`CLAUDE.md`, Director AI Spec; `docs/DIRECTOR.md`). A known bias, flagged before any experiment, is that durable types tend to travel further against most defenses and so score higher, which is why the control arms exist (`CLAUDE.md`, Director AI Spec, Known bias).

### The players

Scripted bots act only through simulation commands and draw their choices from their own seeded stream. Since amendment A2 the experiment uses ablation styles: one balanced random mix and styles that each omit one tower, so that a defense lacking a tower should be weak against exactly the enemy type that tower counters; this gives every style a prediction read from the tower data rather than guessed (`docs/EXPERIMENT.md`, Players). The bots were calibrated in static mode only, before any adaptive result was looked at, and the calibration dropped one style whose static games were almost never won (`docs/EXPERIMENT.md`, Players).

### Seed sets

Calibration seeds were used only for bot knobs. The tuning seeds were exploratory and split into training and validation parts. The held-out seeds were disjoint from every other set and run once (`docs/EXPERIMENT.md`, Seed sets). Seeds are the clusters of the analysis: games of one seed share their random choices, so comparisons are paired at the seed level, with cluster bootstrap intervals and sign-flip permutation tests, and with Holm adjustment inside a family (`docs/EXPERIMENT.md`, Analysis plan).

### Pre-registration, amendments and the incident

The protocol was written before any held-out data existed, and its hash is stored in every result file and in the held-out lock (`docs/EXPERIMENT.md`, opening paragraph).

- **A1** moved the measurement of the final weights to the last eligible wave for adaptive and random alike, after a measurement asymmetry was noticed in the tuning results; no hypothesis, metric or seed set changed.
- **A2** replaced the focus styles with the ablation styles, retired a hypothesis that was biased in favor of the random control by construction, and added a contrast statistic, a sensitivity analysis and an early-ends check.
- **A3** is the pre-registration of the single held-out evaluation: six modes, a primary population of units whose static game reached wave 5, a fixed wave for the style contrast (wave 9, chosen although a coverage rule fixed earlier was not met on the training data, with the reason stated in advance), three confirmatory hypotheses K1, K2 and K3 with Holm adjustment, estimands reported with intervals and no p-values, sensitivity analyses, an interpretation guide written before the results and a no-tuning rule (`docs/EXPERIMENT.md`, Amendments and Amendment A3).

Each amendment states its chronology: what had been seen when it was made. An incident is also on record: the validation split was once run without a lock before the lock was wired into the command line tool; the outputs were deleted unread, so the validation seeds are not pristine and were not used for confirmation (`docs/EXPERIMENT.md`, Incident log).

### The attribution chain

To split the total effect of Director v1 into parts, two non-learning arms were added: the random control (composition variability) and the prior control (a fixed lean toward durable enemy types, with no learning and no look at the defense). The chain is exact, checked unit by unit: the effect of v1 against static equals the effect of random against static, plus the effect of the prior against random, plus the effect of v1 against the prior (`docs/EXPERIMENT.md`, Amendment A3, Estimands; `CLAUDE.md`, Decisions Log, prior control). It follows one path through the arms; a different path would split the total differently (`docs/RESULTS.md`, Limits).

### What was confirmatory and what was an estimate

Only K1, K2 and K3 are tests. K1 asks whether composition variability alone costs lives; K2 and K3 ask whether the final weights of Director v1 and Director v2 separate defenses in the predicted direction at wave 9. Everything else (the attribution parts, contrasts at other waves, other metrics, per-pair results, the replication check against the training seeds) is reported as an estimate with an interval and no p-value, and the post hoc parts are labelled as such (`docs/EXPERIMENT.md`, Amendment A3; `CLAUDE.md`, Decisions Log, confirmatory plan).

### The lock and the freeze

The held-out procedure is fixed: a clean working tree, a plan printout, one run through a lock that is written before any game is played and records the git commit and the protocol hash, then the analysis command, which refuses rows that do not match the lock and never computes statistics on incomplete data (`docs/EXPERIMENT.md`, The held-out procedure). Afterward the simulation was frozen by a test. The outcome in words is in the Results section.
