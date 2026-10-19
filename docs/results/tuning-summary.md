# Experiment analysis: tuning set

Analysis of the tuning set: 30 seeds x 5 styles x 3 modes = 450 games.

## How to read this

- Every comparison is "mode A minus mode B", computed per seed (averaged over the five bot styles) and then summarized over seeds.
- A positive lives-lost difference for adaptive versus a control means the Director cost the player more lives.
- A 95% interval that includes 0 means no detectable effect at this sample size; the p-values test the same thing.
- Primary and secondary p-values are Holm-adjusted within their own family; descriptive rows are not adjusted.

## Primary hypotheses (Holm-adjusted within the primary family)

| id | hypothesis | A - B | mean diff | 95% CI | dz | p raw | p Holm | supports |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | Adaptive costs the player more lives than static | adaptive - static livesLost, expect greater | 1.480 | [0.853, 2.153] | 0.79 | 0.0001 | 0.0002 | yes |
| P2 | Adaptive costs the player more lives than the random control | adaptive - random livesLost, expect greater | 0.060 | [-0.653, 0.753] | 0.03 | 0.8861 | 0.8861 | yes |

## Secondary hypotheses (Holm-adjusted within the secondary family)

| id | hypothesis | A - B | mean diff | 95% CI | dz | p raw | p Holm | supports |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Adaptive wins less often than static | adaptive - static won, expect less | -0.113 | [-0.167, -0.067] | -0.78 | 0.0002 | 0.0011 | yes |
| S2 | Adaptive wins less often than the random control | adaptive - random won, expect less | -0.047 | [-0.107, 0.020] | -0.26 | 0.2335 | 0.7005 | yes |
| S3 | A larger fraction of threat leaks under adaptive than static | adaptive - static leakFraction, expect greater | 0.010 | [0.005, 0.015] | 0.70 | 0.0001 | 0.0006 | yes |
| S4 | A larger fraction of threat leaks under adaptive than random | adaptive - random leakFraction, expect greater | -0.002 | [-0.007, 0.003] | -0.13 | 0.4909 | 0.7285 | no |
| S5 | Enemies get further along the path under adaptive than static | adaptive - static penetration, expect greater | 0.019 | [0.014, 0.024] | 1.37 | 0.0000 | 0.0001 | yes |
| S6 | Enemies get further along the path under adaptive than random | adaptive - random penetration, expect greater | 0.009 | [0.003, 0.015] | 0.52 | 0.0063 | 0.0251 | yes |
| S7 | The final wave reached is lower under adaptive than static | adaptive - static finalWave, expect less | -0.460 | [-0.713, -0.240] | -0.69 | 0.0002 | 0.0011 | yes |
| S8 | The final wave reached is lower under adaptive than random | adaptive - random finalWave, expect less | -0.100 | [-0.300, 0.087] | -0.18 | 0.3643 | 0.7285 | yes |
| T1 | The final weights lean toward the predicted enemy types more often under adaptive than random (final weights measured at the last eligible wave) | adaptive - random tiltAligned, expect greater | -0.556 | [-0.647, -0.464] | -2.13 | 0.0000 | 0.0001 | no |

## Descriptive comparison (no adjustment)

| id | hypothesis | A - B | mean diff | 95% CI | dz | p raw | p Holm | supports |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Composition variability alone (random versus static) costs lives | random - static livesLost, expect greater | 1.420 | [0.740, 2.173] | 0.70 | 0.0002 | - | yes |

## Tilt alignment (a final weight of at least 1.15 on a predicted type)

| style | predicted | adaptive | adaptive 95% | random | random 95% |
| --- | --- | --- | --- | --- | --- |
| lanceHeavy | swarmling | 15% | [0.059, 0.325] | 67% | [0.478, 0.814] |
| mortarHeavy | fastRunner | 0% | [0.000, 0.125] | 78% | [0.592, 0.894] |
| poisonHeavy | fastRunner+shieldedBruiser | 67% | [0.488, 0.808] | 97% | [0.833, 0.994] |
| sniperHeavy | swarmling+fastRunner | 26% | [0.132, 0.447] | 89% | [0.719, 0.961] |

## Mean final weight per enemy type, adaptive mode (95% CI over seeds; 135 games used, 15 excluded: no eligible wave reached; random: 135 used, 15 excluded)

| style | armoredGrunt | swarmling | fastRunner | regenerator | shieldedBruiser |
| --- | --- | --- | --- | --- | --- |
| balancedR | 0.68 [0.578, 0.796] | 0.83 [0.717, 0.950] | 0.57 [0.488, 0.662] | 1.24 [1.175, 1.313] | 1.24 [1.148, 1.327] |
| lanceHeavy | 0.64 [0.558, 0.724] | 0.82 [0.731, 0.926] | 0.52 [0.469, 0.577] | 1.33 [1.266, 1.393] | 1.25 [1.171, 1.327] |
| mortarHeavy | 0.66 [0.579, 0.745] | 0.84 [0.730, 0.959] | 0.53 [0.474, 0.597] | 1.30 [1.217, 1.376] | 1.20 [1.123, 1.285] |
| poisonHeavy | 0.65 [0.561, 0.749] | 0.74 [0.673, 0.813] | 0.55 [0.487, 0.635] | 1.30 [1.230, 1.369] | 1.27 [1.205, 1.340] |
| sniperHeavy | 0.67 [0.605, 0.738] | 0.89 [0.756, 1.034] | 0.52 [0.469, 0.577] | 1.33 [1.253, 1.407] | 1.15 [1.081, 1.231] |

## Mean lives lost by style and mode

| style | static | adaptive | random |
| --- | --- | --- | --- |
| balancedR | 14.03 | 14.17 | 14.50 |
| lanceHeavy | 10.70 | 12.83 | 12.90 |
| mortarHeavy | 11.40 | 12.10 | 12.20 |
| poisonHeavy | 9.07 | 11.77 | 11.57 |
| sniperHeavy | 12.60 | 14.33 | 13.73 |
| all | 11.56 | 13.04 | 12.98 |

## Win rate (Wilson 95%) by style and mode

| style | static | adaptive | random |
| --- | --- | --- | --- |
| balancedR | 47% [0.302, 0.639] | 47% [0.302, 0.639] | 43% [0.274, 0.608] |
| lanceHeavy | 67% [0.488, 0.808] | 47% [0.302, 0.639] | 57% [0.392, 0.726] |
| mortarHeavy | 53% [0.361, 0.698] | 50% [0.332, 0.668] | 53% [0.361, 0.698] |
| poisonHeavy | 80% [0.627, 0.905] | 57% [0.392, 0.726] | 70% [0.521, 0.833] |
| sniperHeavy | 57% [0.392, 0.726] | 47% [0.302, 0.639] | 47% [0.302, 0.639] |
| all | 61% [0.527, 0.681] | 49% [0.414, 0.573] | 54% [0.460, 0.618] |

## Static win rate per style (the calibration guard)

| style | win rate |
| --- | --- |
| balancedR | 47% |
| lanceHeavy | 67% |
| mortarHeavy | 53% |
| poisonHeavy | 80% |
| sniperHeavy | 57% |
| mean | 61% |

## Power (80%, alpha 0.05): seeds needed for the primary comparisons

| id | sd of seed diffs | observed effect | seeds for observed effect | seeds for half the effect |
| --- | --- | --- | --- | --- |
| P1 | 1.877 | 1.480 | 13 | 51 |
| P2 | 1.988 | 0.060 | 8614 | 34455 |

## Completeness

Completeness: every style x mode x seed present exactly once (450 of 450).

## Notes

- Results on the tuning seed set are exploratory: they may guide tuning, they are not the confirmatory evaluation.
- Seeds are the unit of analysis: all numbers are seed-level paired differences averaged over the styles, not game-level counts.
- The bots are scripted players with fixed tower mixes, not humans.
- The Director may be reacting to tankiness (tanky enemy types tend to score higher against most defenses): compare with the random control.
