# Experiment analysis: tuning set

Analysis of the tuning set: 30 seeds x 5 styles x 3 modes = 450 games.

## How to read this

- Every comparison is "mode A minus mode B", computed per seed (averaged over the bot styles) and then summarized over seeds.
- A positive lives-lost difference for adaptive versus a control means the Director cost the player more lives.
- A 95% interval that includes 0 means no detectable effect at this sample size; the p-values test the same thing.
- Primary and secondary p-values are Holm-adjusted within their own family; descriptive rows are not adjusted.

## Primary hypotheses (Holm-adjusted within the primary family)

| id | hypothesis | A - B | mean diff | 95% CI | dz | p raw | p Holm | supports |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | Adaptive costs the player more lives than static | adaptive - static livesLost, expect greater | 1.207 | [0.667, 1.787] | 0.76 | 0.0001 | 0.0002 | yes |
| P2 | Adaptive costs the player more lives than the random control | adaptive - random livesLost, expect greater | 0.540 | [-0.127, 1.287] | 0.27 | 0.1611 | 0.1611 | yes |

## Secondary hypotheses (Holm-adjusted within the secondary family)

| id | hypothesis | A - B | mean diff | 95% CI | dz | p raw | p Holm | supports |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Adaptive wins less often than static | adaptive - static won, expect less | -0.120 | [-0.173, -0.073] | -0.83 | 0.0001 | 0.0010 | yes |
| S2 | Adaptive wins less often than the random control | adaptive - random won, expect less | -0.067 | [-0.113, -0.020] | -0.50 | 0.0176 | 0.0378 | yes |
| S3 | A larger fraction of threat leaks under adaptive than static | adaptive - static leakFraction, expect greater | 0.012 | [0.006, 0.018] | 0.68 | 0.0006 | 0.0029 | yes |
| S4 | A larger fraction of threat leaks under adaptive than random | adaptive - random leakFraction, expect greater | 0.006 | [-0.001, 0.013] | 0.29 | 0.1297 | 0.1297 | yes |
| S5 | Enemies get further along the path under adaptive than static | adaptive - static penetration, expect greater | 0.022 | [0.016, 0.029] | 1.20 | 0.0000 | 0.0001 | yes |
| S6 | Enemies get further along the path under adaptive than random | adaptive - random penetration, expect greater | 0.015 | [0.008, 0.022] | 0.77 | 0.0002 | 0.0011 | yes |
| S7 | The final wave reached is lower under adaptive than static | adaptive - static finalWave, expect less | -0.620 | [-0.927, -0.347] | -0.73 | 0.0001 | 0.0005 | yes |
| S8 | The final wave reached is lower under adaptive than random | adaptive - random finalWave, expect less | -0.380 | [-0.653, -0.140] | -0.52 | 0.0083 | 0.0330 | yes |
| T2 | The final weights separate defenses in the predicted direction more under adaptive than under the random control | adaptive - random tiltContrast, expect greater | 0.271 | [0.076, 0.508] | 0.44 | 0.0126 | 0.0378 | yes |

## Descriptive comparison (no adjustment)

| id | hypothesis | A - B | mean diff | 95% CI | dz | p raw | p Holm | supports |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T0 | Null check: the random control shows no style contrast | random - 0 tiltContrast, expect twosided | -0.175 | [-0.361, -0.010] | -0.35 | 0.0631 | - | n/a (two-sided) |
| C1 | Composition variability alone (random versus static) costs lives | random - static livesLost, expect greater | 0.667 | [0.133, 1.193] | 0.44 | 0.0231 | - | yes |

## Tilt alignment (a final weight of at least 1.15 on a predicted type)

| style | predicted | adaptive | adaptive 95% | random | random 95% |
| --- | --- | --- | --- | --- | --- |
| noLance | armoredGrunt | 14% | [0.050, 0.346] | 52% | [0.324, 0.717] |
| noMortar | swarmling | 13% | [0.043, 0.310] | 54% | [0.351, 0.721] |
| noPoison | regenerator | 70% | [0.481, 0.855] | 75% | [0.531, 0.888] |
| noSniper | shieldedBruiser | 52% | [0.340, 0.693] | 70% | [0.515, 0.841] |

Note: tiltAligned uses a fixed threshold and is biased in favor of the random control (its tilts are spread wider than the Director’s); it is shown for continuity, not as a hypothesis.

## Mean final weight per enemy type, adaptive mode (95% CI over seeds; 113 games used, 37 excluded: no eligible wave reached; random: 113 used, 37 excluded)

| style | armoredGrunt | swarmling | fastRunner | regenerator | shieldedBruiser |
| --- | --- | --- | --- | --- | --- |
| balancedR | 0.59 [0.512, 0.673] | 0.77 [0.642, 0.916] | 0.49 [0.464, 0.519] | 1.35 [1.293, 1.409] | 1.27 [1.182, 1.350] |
| noLance | 0.75 [0.638, 0.876] | 0.87 [0.725, 1.027] | 0.61 [0.543, 0.681] | 1.27 [1.181, 1.364] | 1.12 [1.041, 1.194] |
| noMortar | 0.57 [0.507, 0.640] | 0.80 [0.700, 0.909] | 0.46 [0.426, 0.506] | 1.26 [1.204, 1.318] | 1.21 [1.113, 1.324] |
| noPoison | 0.79 [0.679, 0.908] | 0.83 [0.696, 0.978] | 0.53 [0.459, 0.614] | 1.35 [1.232, 1.480] | 1.17 [1.081, 1.259] |
| noSniper | 0.68 [0.577, 0.792] | 0.84 [0.723, 0.951] | 0.56 [0.498, 0.632] | 1.22 [1.116, 1.323] | 1.32 [1.199, 1.450] |

## Mean lives lost by style and mode

| style | static | adaptive | random |
| --- | --- | --- | --- |
| balancedR | 12.27 | 14.00 | 13.30 |
| noLance | 15.73 | 15.83 | 15.70 |
| noMortar | 10.37 | 10.77 | 11.40 |
| noPoison | 15.37 | 18.10 | 16.17 |
| noSniper | 14.67 | 15.73 | 15.17 |
| all | 13.68 | 14.89 | 14.35 |

## Win rate (Wilson 95%) by style and mode

| style | static | adaptive | random |
| --- | --- | --- | --- |
| balancedR | 57% [0.392, 0.726] | 47% [0.302, 0.639] | 53% [0.361, 0.698] |
| noLance | 43% [0.274, 0.608] | 37% [0.219, 0.545] | 43% [0.274, 0.608] |
| noMortar | 67% [0.488, 0.808] | 57% [0.392, 0.726] | 57% [0.392, 0.726] |
| noPoison | 37% [0.219, 0.545] | 20% [0.095, 0.373] | 30% [0.167, 0.479] |
| noSniper | 43% [0.274, 0.608] | 27% [0.142, 0.444] | 37% [0.219, 0.545] |
| all | 49% [0.414, 0.573] | 37% [0.300, 0.453] | 44% [0.363, 0.520] |

## Static win rate per style (the calibration guard)

| style | win rate |
| --- | --- |
| balancedR | 57% |
| noLance | 43% |
| noMortar | 67% |
| noPoison | 37% |
| noSniper | 43% |
| mean | 49% |

## Power (80%, alpha 0.05): seeds needed for the primary comparisons

| id | sd of seed diffs | observed effect | seeds for observed effect | seeds for half the effect |
| --- | --- | --- | --- | --- |
| P1 | 1.594 | 1.207 | 14 | 55 |
| P2 | 2.009 | 0.540 | 109 | 435 |

## Style contrast: final weight on the predicted type minus the same weight under the other styles (95% CI over seeds; sign-flip p against 0; hypotheses T2 and T0 are in the tables above)

| mode | seeds | mean contrast | 95% CI | p raw | rows used | rows excluded |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 29 | 0.096 | [0.005, 0.191] | 0.0519 | 113 | 37 |
| random | 29 | -0.175 | [-0.361, -0.010] | 0.0631 | 113 | 37 |

## Style contrast per (style, predicted type), mean over seeds

| style | type | adaptive | n | random |
| --- | --- | --- | --- | --- |
| noLance | armoredGrunt | 0.104 | 21 | -0.215 |
| noMortar | swarmling | -0.052 | 24 | -0.131 |
| noPoison | regenerator | 0.125 | 20 | -0.214 |
| noSniper | shieldedBruiser | 0.151 | 26 | -0.166 |

## Early ends (finalWave < 5) by mode

| mode | units | ended early | won |
| --- | --- | --- | --- |
| adaptive | 150 | 37 | 56 |
| random | 150 | 37 | 66 |
| static | 150 | 37 | 74 |

Early-ends invariant holds: the same (style, seed) units ended before wave 5 in every mode.

## Sensitivity analysis (not adjusted): units whose static game reached wave 5 or later (a pre-treatment condition)

| id | A - B | units used | units excluded | seeds | mean diff | 95% CI | p raw |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | adaptive - static livesLost | 113 | 37 | 30 | 1.651 | [0.848, 2.556] | 0.0001 |
| P2 | adaptive - random livesLost | 113 | 37 | 30 | 0.671 | [-0.106, 1.494] | 0.1163 |
| C1 | random - static livesLost | 113 | 37 | 30 | 0.981 | [0.262, 1.738] | 0.0144 |

## Completeness

Completeness: every style x mode x seed present exactly once (450 of 450).

## Notes

- Results on the tuning seed set are exploratory: they may guide tuning, they are not the confirmatory evaluation.
- Seeds are the unit of analysis: all numbers are seed-level paired differences averaged over the styles, not game-level counts.
- The bots are scripted players with fixed tower mixes, not humans.
- The Director may be reacting to tankiness (tanky enemy types tend to score higher against most defenses): compare with the random control.
