# Diagnostics: the reward signal in static games (tuning seeds)

## How to read this

- Every number comes from static games: no Director was involved. A ratio above 1 means that enemy type earns more reward per unit of threat than the average type, whatever the player builds.
- eta squared is the share of the variance of the per-wave rewards explained by the player style (etaStyle) or by the wave (etaWave); a low etaStyle means the reward says little about the defense.
- The noise floor compares the wave-to-wave sd of the reward (for the same style, wave and type, across seeds) with the spread between types.

## Static baseline reward per enemy type, all waves (ratio to the all-type pooled reward)

| enemy | cells | units | pooled reward | ratio | balancedR ratio | noLance ratio | noMortar ratio | noPoison ratio | noSniper ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| armoredGrunt | 1498 | 11794 | 0.0314 | 0.90 | 0.93 | 0.95 | 0.82 | 0.92 | 0.90 |
| swarmling | 1118 | 26544 | 0.0444 | 1.28 | 1.22 | 1.35 | 1.37 | 1.32 | 1.09 |
| fastRunner | 983 | 8635 | 0.0189 | 0.54 | 0.53 | 0.64 | 0.54 | 0.51 | 0.50 |
| regenerator | 844 | 4016 | 0.0412 | 1.18 | 1.21 | 1.11 | 1.20 | 1.25 | 1.16 |
| shieldedBruiser | 652 | 2583 | 0.0400 | 1.15 | 1.16 | 0.93 | 1.17 | 1.04 | 1.49 |

## Static baseline reward per enemy type, waves 5 and later (the Director's eligible region)

| enemy | cells | units | pooled reward | ratio | balancedR ratio | noLance ratio | noMortar ratio | noPoison ratio | noSniper ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| armoredGrunt | 950 | 9054 | 0.0247 | 0.79 | 0.81 | 0.85 | 0.77 | 0.82 | 0.69 |
| swarmling | 870 | 22576 | 0.0357 | 1.14 | 1.09 | 1.22 | 1.23 | 1.17 | 0.95 |
| fastRunner | 870 | 8183 | 0.0180 | 0.57 | 0.56 | 0.69 | 0.56 | 0.54 | 0.52 |
| regenerator | 844 | 4016 | 0.0412 | 1.32 | 1.34 | 1.25 | 1.29 | 1.40 | 1.33 |
| shieldedBruiser | 652 | 2583 | 0.0400 | 1.28 | 1.28 | 1.05 | 1.25 | 1.17 | 1.72 |

## Share of reward variance explained (eta squared)

| enemy | cells | etaStyle | etaWave |
| --- | --- | --- | --- |
| armoredGrunt | 1498 | 0.026 | 0.390 |
| swarmling | 1118 | 0.029 | 0.473 |
| fastRunner | 983 | 0.033 | 0.498 |
| regenerator | 844 | 0.017 | 0.482 |
| shieldedBruiser | 652 | 0.066 | 0.430 |

## Noise floor: median sd of the cell reward over (style, wave) groups with 2+ seeds, against the spread of the per-type pooled rewards (0.0232, waves 5+)

| enemy | groups | median sd | sd / spread |
| --- | --- | --- | --- |
| armoredGrunt | 75 | 0.0097 | 0.42 |
| swarmling | 60 | 0.0227 | 0.98 |
| fastRunner | 55 | 0.0070 | 0.30 |
| regenerator | 50 | 0.0104 | 0.45 |
| shieldedBruiser | 40 | 0.0072 | 0.31 |

## Reward contrast (waves 5+; relative reward of a style's predicted type minus the other styles'; 950 groups used, 0 skipped)

| seeds | mean contrast | 95% CI | sign-flip p |
| --- | --- | --- | --- |
| 25 | 0.199 | [0.092, 0.310] | 0.0016 |

## Reward contrast per (style, predicted type), mean over seeds

| style | type | n | mean contrast | 95% CI |
| --- | --- | --- | --- | --- |
| noLance | armoredGrunt | 20 | 0.084 | [0.006, 0.188] |
| noMortar | swarmling | 21 | 0.076 | [-0.069, 0.220] |
| noPoison | regenerator | 15 | 0.097 | [-0.053, 0.313] |
| noSniper | shieldedBruiser | 15 | 0.570 | [0.400, 0.751] |

## Mean relative reward (1 = the threat-weighted average of the wave) per style and enemy type, waves 5 and later; n = seeds with the type

| style | armoredGrunt | swarmling | fastRunner | regenerator | shieldedBruiser |
| --- | --- | --- | --- | --- | --- |
| balancedR | 0.77 (21) | 0.98 (21) | 0.61 (21) | 1.42 (21) | 1.38 (20) |
| noLance | 0.81 (20) | 1.04 (20) | 0.69 (20) | 1.34 (17) | 1.23 (17) |
| noMortar | 0.74 (23) | 1.07 (23) | 0.62 (23) | 1.34 (23) | 1.33 (23) |
| noPoison | 0.77 (18) | 1.03 (18) | 0.60 (18) | 1.47 (16) | 1.28 (14) |
| noSniper | 0.69 (24) | 0.89 (24) | 0.56 (24) | 1.48 (20) | 1.90 (18) |

## Notes

- These are static-mode measurements: no Director influenced the games.
- A type ratio above 1 means the reward formula favors that type regardless of the Director.
- A low etaStyle means the reward mostly reflects the enemy type and the wave, not the player's defense.
- The table is diagnostic only and is used by no code in this phase.
- The reward contrast is measured in static games: it asks whether the quantity the Director learns from differs between defenses in the predicted direction, independently of the Director.
- A contrast near zero means no learning rule based on this reward can follow the defense.
