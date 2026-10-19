# EXPLORATORY DRY RUN ON TRAINING DATA: NOT CONFIRMATORY

Protocol version 4, hash `60b7408915417a5ba91e6b597a91bd780b158e951c3f6dcf7c7802d97da29f74`.

## How to read this

- Only K1, K2 and K3 are tests. A hypothesis is "supported" only when its estimate has the predicted sign and its Holm-adjusted p-value is below 0.05; otherwise the data show no detectable effect at this sample size, which is not proof of absence.
- K1: does random composition alone (random minus static) cost lives? K2 and K3: do the final weights of Director v1 and v2 separate the defenses in the predicted direction at the primary wave?
- Everything else (the estimand tables, the contrast tables, the attribution pairs) is estimation: a point estimate with a 95% interval over seeds, never a p-value.
- Coverage says how many population units reached the wave at which a weight is observed; low coverage means a noisier contrast.

## Confirmatory family K1-K3 (Holm across exactly these three; supported = predicted sign AND Holm p below 0.05)

| id | hypothesis | seeds | estimate | 95% CI | p raw | p Holm | supported |
| --- | --- | --- | --- | --- | --- | --- | --- |
| K1 | Composition variability alone (random versus static) costs the player lives | 20 | 1.470 | [0.484, 2.454] | 0.0105 | 0.0316 | yes |
| K2 | Director v1 final weights separate defenses in the predicted direction at wave 9 | 13 | 0.118 | [-0.025, 0.248] | 0.1296 | 0.2593 | no |
| K3 | Director v2 weights separate defenses in the predicted direction at wave 9 | 15 | 0.033 | [-0.049, 0.107] | 0.4286 | 0.4286 | no |

Population: 71 units (static-reached), 29 excluded; 20 seeds x 5 styles x 6 modes = 600 games.

Coverage rule (smallest eligible wave >= 9 whose minimum coverage over adaptive, adaptive2, counter, prior and random is at least 0.75; otherwise the wave with the largest minimum coverage): minimum coverage at wave 9 is 70%; rule met at the primary wave: no; the rule itself would choose wave 9 (met: no). Registered: met no, training coverage 70%.

## Estimand livesLost (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)

| pair | seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| random-static | 20 | 1.470 | [0.484, 2.454] |
| prior-random | 20 | 0.228 | [-0.657, 1.144] |
| adaptive-prior | 20 | 0.169 | [-0.605, 1.043] |
| adaptive2-prior | 20 | -1.308 | [-2.538, -0.220] |
| adaptive-static | 20 | 1.867 | [0.733, 3.158] |
| adaptive2-static | 20 | 0.391 | [-0.048, 0.858] |
| counter-static | 20 | 0.712 | [0.136, 1.448] |
| counter-prior | 20 | -0.987 | [-2.259, 0.147] |

## Estimand won (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)

| pair | seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| random-static | 20 | -0.098 | [-0.183, -0.019] |
| prior-random | 20 | -0.077 | [-0.158, -0.002] |
| adaptive-prior | 20 | -0.015 | [-0.090, 0.052] |
| adaptive2-prior | 20 | 0.094 | [0.037, 0.156] |
| adaptive-static | 20 | -0.190 | [-0.281, -0.105] |
| adaptive2-static | 20 | -0.081 | [-0.156, -0.010] |
| counter-static | 20 | -0.099 | [-0.210, -0.007] |
| counter-prior | 20 | 0.076 | [0.005, 0.150] |

## Estimand finalWave (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)

| pair | seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| random-static | 20 | -0.412 | [-0.898, 0.063] |
| prior-random | 20 | -0.213 | [-0.736, 0.280] |
| adaptive-prior | 20 | -0.173 | [-0.486, 0.117] |
| adaptive2-prior | 20 | 0.282 | [-0.048, 0.670] |
| adaptive-static | 20 | -0.798 | [-1.300, -0.347] |
| adaptive2-static | 20 | -0.343 | [-0.678, -0.075] |
| counter-static | 20 | -0.435 | [-0.913, -0.040] |
| counter-prior | 20 | 0.190 | [-0.154, 0.572] |

## Estimand leakFraction (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)

| pair | seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| random-static | 20 | 0.011 | [0.002, 0.019] |
| prior-random | 20 | -0.006 | [-0.018, 0.006] |
| adaptive-prior | 20 | 0.009 | [0.001, 0.018] |
| adaptive2-prior | 20 | 0.003 | [-0.008, 0.013] |
| adaptive-static | 20 | 0.014 | [0.002, 0.025] |
| adaptive2-static | 20 | 0.007 | [0.002, 0.012] |
| counter-static | 20 | 0.007 | [0.001, 0.014] |
| counter-prior | 20 | 0.003 | [-0.006, 0.012] |

## Estimand penetration (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)

| pair | seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| random-static | 20 | 0.012 | [0.002, 0.023] |
| prior-random | 20 | 0.014 | [0.003, 0.025] |
| adaptive-prior | 20 | 0.003 | [-0.003, 0.010] |
| adaptive2-prior | 20 | -0.016 | [-0.025, -0.007] |
| adaptive-static | 20 | 0.030 | [0.018, 0.042] |
| adaptive2-static | 20 | 0.011 | [0.005, 0.019] |
| counter-static | 20 | 0.002 | [-0.008, 0.012] |
| counter-prior | 20 | -0.025 | [-0.035, -0.016] |

## Fixed-wave style contrast (unlocked predicted types only; estimate and 95% CI, no p-values)

| wave | mode | seeds | observed units | coverage | estimate | 95% CI | zero check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | adaptive | 18 | 71/71 | 100% | 0.009 | [-0.119, 0.135] | - |
| 5 | adaptive2 | 18 | 71/71 | 100% | 0.008 | [-0.076, 0.093] | - |
| 5 | counter | 18 | 71/71 | 100% | 0.386 | [0.234, 0.537] | - |
| 5 | prior | 18 | 71/71 | 100% | 0.000 | [0.000, 0.000] | ok |
| 5 | random | 18 | 71/71 | 100% | 0.000 | [0.000, 0.000] | ok |
| 9 | adaptive | 13 | 50/71 | 70% | 0.118 | [-0.025, 0.248] | - |
| 9 | adaptive2 | 15 | 57/71 | 80% | 0.033 | [-0.049, 0.107] | - |
| 9 | counter | 15 | 55/71 | 77% | 0.341 | [0.229, 0.465] | - |
| 9 | prior | 14 | 52/71 | 73% | 0.000 | [0.000, 0.000] | ok |
| 9 | random | 15 | 54/71 | 76% | 0.000 | [0.000, 0.000] | ok |

## Coverage at the primary wave 9

| mode | observed | population | coverage |
| --- | --- | --- | --- |
| adaptive | 50 | 71 | 70% |
| adaptive2 | 57 | 71 | 80% |
| counter | 55 | 71 | 77% |
| prior | 52 | 71 | 73% |
| random | 54 | 71 | 76% |

## Sensitivity: K1 on all units; K2 and K3 on the matched set

| analysis | units / seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| K1 on all units | 100 units / 20 seeds | 1.000 | [0.280, 1.700] |
| K2 on the matched set | 49 units / 13 seeds | 0.096 | [-0.068, 0.243] |
| K3 on the matched set | 49 units / 13 seeds | 0.039 | [-0.068, 0.135] |

## Sensitivity: leave-one-style-out estimate (the style removed)

| hypothesis | balancedR | noLance | noMortar | noPoison | noSniper | min | max | sign stable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K1 | 1.183 | 1.654 | 1.733 | 1.179 | 1.600 | 1.179 | 1.733 | yes |
| K2 | 0.118 | 0.072 | 0.156 | 0.250 | 0.046 | 0.046 | 0.250 | yes |
| K3 | 0.033 | 0.032 | 0.059 | 0.091 | 0.022 | 0.022 | 0.091 | yes |

## Power (descriptive and post hoc, not part of the confirmatory plan): seeds needed for 80% power at the observed estimate and alpha 0.016667

| id | sd of seed values | seeds needed |
| --- | --- | --- |
| K1 | 2.340 | 27 |
| K2 | 0.262 | 52 |
| K3 | 0.161 | 244 |

## Notes

- The confirmatory family is exactly K1-K3; everything else in this report is estimation (point estimates and confidence intervals, no p-values).
- The bots are scripted players on one map with fixed tower mixes, not humans.
- The validation seeds were not used for confirmation because they are not pristine (they were part of the tuning set that was read earlier).
- The counter arm reads the tower loadout and is a reference, not a fair competitor.
- The random and prior contrasts are zero by construction: their tilts cannot depend on the defense.
- The attribution pairs are estimates, not tests: they split a Director's total effect into composition variability, enemy-durability bias and learning.
