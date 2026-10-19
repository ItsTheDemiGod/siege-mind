# Diagnostics: the reward signal in static games (tuning seeds)

## How to read this

- Every number comes from static games: no Director was involved. A ratio above 1 means that enemy type earns more reward per unit of threat than the average type, whatever the player builds.
- eta squared is the share of the variance of the per-wave rewards explained by the player style (etaStyle) or by the wave (etaWave); a low etaStyle means the reward says little about the defense.
- The noise floor compares the wave-to-wave sd of the reward (for the same style, wave and type, across seeds) with the spread between types.

## Static baseline reward per enemy type, all waves (ratio to the all-type pooled reward)

| enemy | cells | units | pooled reward | ratio | balancedR ratio | lanceHeavy ratio | mortarHeavy ratio | poisonHeavy ratio | sniperHeavy ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| armoredGrunt | 1746 | 14076 | 0.0296 | 0.86 | 0.93 | 0.84 | 0.87 | 0.83 | 0.84 |
| swarmling | 1344 | 32168 | 0.0431 | 1.25 | 1.26 | 1.21 | 1.32 | 1.16 | 1.32 |
| fastRunner | 1201 | 10600 | 0.0190 | 0.55 | 0.53 | 0.52 | 0.57 | 0.55 | 0.57 |
| regenerator | 1040 | 4931 | 0.0427 | 1.24 | 1.18 | 1.29 | 1.20 | 1.27 | 1.23 |
| shieldedBruiser | 805 | 3190 | 0.0412 | 1.20 | 1.14 | 1.26 | 1.10 | 1.29 | 1.14 |

## Static baseline reward per enemy type, waves 5 and later (the Director's eligible region)

| enemy | cells | units | pooled reward | ratio | balancedR ratio | lanceHeavy ratio | mortarHeavy ratio | poisonHeavy ratio | sniperHeavy ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| armoredGrunt | 1168 | 11186 | 0.0265 | 0.81 | 0.83 | 0.79 | 0.84 | 0.81 | 0.82 |
| swarmling | 1066 | 27720 | 0.0373 | 1.14 | 1.14 | 1.13 | 1.20 | 1.04 | 1.23 |
| fastRunner | 1066 | 10060 | 0.0180 | 0.55 | 0.54 | 0.52 | 0.58 | 0.55 | 0.57 |
| regenerator | 1040 | 4931 | 0.0427 | 1.31 | 1.31 | 1.34 | 1.29 | 1.32 | 1.28 |
| shieldedBruiser | 805 | 3190 | 0.0412 | 1.26 | 1.27 | 1.31 | 1.18 | 1.35 | 1.18 |

## Share of reward variance explained (eta squared)

| enemy | cells | etaStyle | etaWave |
| --- | --- | --- | --- |
| armoredGrunt | 1746 | 0.015 | 0.287 |
| swarmling | 1344 | 0.010 | 0.494 |
| fastRunner | 1201 | 0.006 | 0.546 |
| regenerator | 1040 | 0.008 | 0.536 |
| shieldedBruiser | 805 | 0.014 | 0.557 |

## Noise floor: median sd of the cell reward over (style, wave) groups with 2+ seeds, against the spread of the per-type pooled rewards (0.0247, waves 5+)

| enemy | groups | median sd | sd / spread |
| --- | --- | --- | --- |
| armoredGrunt | 75 | 0.0091 | 0.37 |
| swarmling | 60 | 0.0178 | 0.72 |
| fastRunner | 55 | 0.0054 | 0.22 |
| regenerator | 50 | 0.0091 | 0.37 |
| shieldedBruiser | 40 | 0.0088 | 0.35 |

## Notes

- These are static-mode measurements: no Director influenced the games.
- A type ratio above 1 means the reward formula favors that type regardless of the Director.
- A low etaStyle means the reward mostly reflects the enemy type and the wave, not the player's defense.
- The table is diagnostic only and is used by no code in this phase.
