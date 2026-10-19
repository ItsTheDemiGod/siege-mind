# The Siege Mind Director (Phase 6)

Three game modes share one wave machinery:

| Mode | What it does |
|---|---|
| `static` | the hand-authored waves; the control group |
| `adaptive` | the Director tilts the composition of eligible waves toward what worked against the player's defense |
| `random` | a second control: random tilts of the same range, no learning (URL only: `?mode=random`, not in the menu) |

All three spend **the same threat per wave** (`STATIC_THREAT[wave]`, in base threat units), apply **the same HP multiplier** (`hpMultiplierForWave(wave)`) and run the **same number of waves**. The Director changes composition only.

## Eligibility

A wave is adaptive-eligible when it is not a fixed set piece (waves 10, 20, 30), not an introduction wave (3, 4, 6, 8, where a new enemy type first appears) and `wave >= firstAdaptiveWave` (5). Every other wave uses the static plan exactly (decision reasons `static-early`, `static-intro`, `static-fixed`). The Director **observes and learns from every finished wave**, eligible or not.

## Observation (sim events only, independent of telemetry)

For every enemy type that spawned in a wave (an enemy belongs to the wave it spawned in, even if it dies later): `units`, `leaked`, `meanProgress` (progress along the path at death or leak; a leak counts as 1) and `threatSpent = units * threatCost`.

```
reward    = leakDamage * meanProgress^k / threatCost          (k = rewardExponent, integer power by repeated multiplication)
average   = sum(threatSpent * reward) / sum(threatSpent)       over the types that spent at least minThreatShare of the wave's threat
advantage = clamp((reward - average) / average, -1, +advClipHigh)    (0 when average is 0)
score     = (1 - alpha) * score + alpha * advantage            for those types
score     = decay * score                                      for every other type
tilt      = clamp(1 + beta * score, 1 / tiltMax, tiltMax)
```

Why progress and not leak rate alone: leaks are rare (the balanced bot leaks only 5 enemies in 15 waves), so progress is the continuous signal; the exponent rewards near-leaks. Dividing by the threat cost makes cheap swarmlings and expensive bruisers comparable. No `exp`, `log` or `pow` is used anywhere, so every JavaScript engine produces the same numbers.

## Composition of an eligible wave

`base share` = the static template share (`absentFloorShare` when the type is unlocked but the template leaves it out, 0 while it is still locked). `share = base * tilt / sum(base * tilt)`. The shared composer (`src/data/waveCompose.js`) turns the shares into picks with the same largest-remainder rules, timing windows and minimum gaps as the static builder, and a deterministic fit step brings the realized threat within the data tolerance (`max(5%, 12)`) of `STATIC_THREAT`.

**Cold start:** with all scores 0 (every tilt 1) the plan is the static plan itself (reason `cold-start`).

## Random control

`tilt = 1 / tiltMax + (tiltMax - 1 / tiltMax) * u`, one `u` per enemy type in ENEMY_ORDER from `createRng(seed).fork('director-wave-' + wave)`. It records the same observations (so its scores are comparable) but ignores them. It exists because of a **known bias**: tanky enemy types (Regenerator, Bruiser) travel further against most defenses, so they score higher, and the Director will tend to send more of them. To show the Director responds to the player's build and is not just sending tanks, compare it against the random control.

## Config keys (`config.director`)

| Key | Default | Meaning |
|---|---|---|
| `firstAdaptiveWave` | 5 | waves before this are static |
| `rewardExponent` | 2 | `k` in `meanProgress^k` |
| `alpha` | 0.5 | weight of the newest advantage in the score |
| `decay` | 0.85 | per-wave fade of the score of unobserved types |
| `minThreatShare` | 0.05 | a type needs this share of the wave threat to be scored |
| `advClipHigh` | 2 | upper clamp of the advantage (the lower clamp is -1) |
| `beta` | 1 | how strongly a score becomes a tilt |
| `tiltMax` | 3 | tilt is clamped to `[1 / tiltMax, tiltMax]` |
| `absentFloorShare` | 0.05 | base share of an unlocked type the template omits |
| `historyLimit` | 40 | observation entries kept in the director state |

## The decision record

Every wave in a Director mode has a plain JSON record, in the `WAVE_STARTED` payload (`director`), in `getWavePreview(game).director` (only `eligible` and `reason`) and in telemetry `waves[n].director`. It is computed by the pure `planFor(game, wave)`, so the preview always equals what will spawn.

| Field | Meaning |
|---|---|
| `version` | record format, 1 |
| `wave` | the wave number |
| `mode` | `adaptive` or `random` |
| `eligible` | whether the Director may change this wave |
| `reason` | `static-early`, `static-intro`, `static-fixed`, `cold-start`, `adapted` or `random` |
| `templateShares` | the static template shares (five enemy types) |
| `tilt` | the tilt per enemy type (all 1 when not eligible) |
| `finalShares` | the shares actually used |
| `picks` | picks per enemy type in the plan |
| `threatTarget` | `STATIC_THREAT[wave]` |
| `threatRealized` | the threat of the plan |
| `basedOnWave` | the last wave the Director had observed |
| `observed` | per-type observation of that wave: units, leaked, meanProgress, threatSpent, threatShare, reward, advantage, updated |
| `scores` | the scores at decision time |
| `lines` | human-readable explanation, for example "Fast Runner: weight x2.20, earned 1.8x the wave-average reward last wave (1 of 1 leaked)" |

## Reading the overlay

Press **I** (or the eye button left of the speed buttons) in Adaptive or Random mode. In Static mode the overlay never opens (a toast says so).

- **Header:** "Director" (or "Random control"), the wave the panel describes and the reason (adapted, no evidence yet, too early to adapt, new enemy type, set piece, random weights).
- **Rows (one per enemy type):** a center-zero bar (the tick in the middle is x1.00; a violet bar to the right means the Director raised the type, a grey bar to the left means it lowered it), a small up or down triangle when the change is at least 10%, the weight (for example x1.24) and "template% → final%": the share of the wave's threat the static script gives the type, and the share the Director uses.
- **Evidence:** "last wave 12 sent, 1 leaked, 45% progress, advantage +0.22": what the Director saw of that type in the last finished wave.
- **Lines:** the first two plain-language lines of the decision, and a mini chart of the weights over the waves.
- **Before a wave** (preparation or intermission) the panel shows the decision for the wave that is about to start, so it matches the preview; while a wave runs, and after the game, it shows the latest decision.
- **Held versus applied weights:** rows show the weight actually applied to this wave. A static wave (a set piece, an introduction wave, waves 1-4) applies x1.00 to every type, so the rows read x1.00 even though the Director keeps its beliefs. The tilt chart therefore plots the HELD weights (computed from the scores), which do not drop to x1.00 on set pieces. Filled markers mark waves the Director could adapt, hollow markers waves it held.
- Series are told apart by dash pattern and marker shape (circle, triangle, diamond, square, cross), and the composition strip by fill pattern (solid, diagonal, dots, horizontal, cross), not by color alone.

## The Director's Report

Adaptive and random runs offer a "Director's Report" button on the end card. It is built from the telemetry run (so a saved JSON file can be re-read) and has: the insights, the weight chart, the template-versus-Director composition strip, a per-type table and a footnote that it describes this run only. In adaptive mode the footnote adds the tankiness caveat: tanky enemy types tend to score higher against most defenses, so compare with the random control before reading intent into the weights.

Definitions: **shift** of a wave = half the sum over enemy types of |final share − template share| (the fraction of the wave's threat that moved); **final weight** = the held weight after the last wave (all x1.00 for the random control); **toughest wave** = the wave with the most lives lost (the earliest wins ties).

Insights, in this order, at most `maxInsights` (the cap applies to the whole list):

- **Insight 1 (leaned on):** for up to 2 types with a final weight of at least `pushRatio`, largest first: "The Director leaned on {Name} (weight ×{tilt}): it earned the most threat-adjusted progress against your defense."
- **Insight 2 (backed off):** for up to 2 types with a final weight of at most 1 / `pushRatio`, smallest first: "It backed off {Name} (weight ×{tilt}): your towers stopped them early."
- **Insight 3 (top damage):** when a tower type has at least `topDamageShare` of the damage: "{Tower} dealt {pct}% of your damage." plus, when that tower is weak against a type from insight 1: " The Director pushed {Name}, which {Tower} handles poorly."
- **Insight 4 (toughest wave):** "Toughest wave: wave {n}{ · name} — {k} lives lost{, mostly to {Name} leaks}." or "No lives were lost."
- **Insight 5 (mean shift):** "On average {pct}% of each adapted wave's threat moved to different enemy types."

Special cases: an adaptive run with no adapted wave replaces insights 1, 2 and 5 by "The Director had no evidence to act on yet (it starts adapting at wave 5)."; the random control replaces them by "This run used the random control: enemy weights were random and ignored how your defense performed."; a static run has no report. The wording is descriptive, not causal. Config keys used: `directionRatio`, `pushRatio`, `topDamageShare`, `maxInsights` in `config.report`.

## Phases 7 and 8

Phase 7 visualizes these records (the overlay, the charts and the Director's Report, described above). Phase 8 runs batches of bots and seeds in all three modes and compares them: Director versus Static (does it make the game harder?) and Director versus Random (is that because it responds to the defense?). `npm run compare` (experiments/directorCompare.js) is the small preview of that harness; its hypotheses are reported, never asserted, and are never used to tune the parameters.
