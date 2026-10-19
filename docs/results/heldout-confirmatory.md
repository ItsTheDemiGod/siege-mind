# CONFIRMATORY ANALYSIS OF THE HELD-OUT RUN (amendment A3)

Protocol version 4, hash `6ff1e583210a9e00106cd123d502a660f2e79cc6cedb046f20de32a3ad0fe178`.

## How to read this

- Only K1, K2 and K3 are tests. A hypothesis is "supported" only when its estimate has the predicted sign and its Holm-adjusted p-value is below 0.05; otherwise the data show no detectable effect at this sample size, which is not proof of absence.
- K1: does random composition alone (random minus static) cost lives? K2 and K3: do the final weights of Director v1 and v2 separate the defenses in the predicted direction at the primary wave?
- Everything else (the estimand tables, the contrast tables, the attribution pairs) is estimation: a point estimate with a 95% interval over seeds, never a p-value.
- Coverage says how many population units reached the wave at which a weight is observed; low coverage means a noisier contrast.

## Confirmatory family K1-K3 (Holm across exactly these three; supported = predicted sign AND Holm p below 0.05)

| id | hypothesis | seeds | estimate | 95% CI | p raw | p Holm | supported |
| --- | --- | --- | --- | --- | --- | --- | --- |
| K1 | Composition variability alone (random versus static) costs the player lives | 150 | 0.067 | [-0.223, 0.351] | 0.6522 | 0.6522 | no |
| K2 | Director v1 final weights separate defenses in the predicted direction at wave 9 | 124 | 0.186 | [0.153, 0.218] | 0.0000 | 0.0000 | yes |
| K3 | Director v2 weights separate defenses in the predicted direction at wave 9 | 127 | 0.097 | [0.080, 0.115] | 0.0000 | 0.0000 | yes |

Population: 614 units (static-reached), 136 excluded; 150 seeds x 5 styles x 6 modes = 4500 games.

Coverage rule (smallest eligible wave >= 9 whose minimum coverage over adaptive, adaptive2, counter, prior and random is at least 0.75; otherwise the wave with the largest minimum coverage): minimum coverage at wave 9 is 73%; rule met at the primary wave: no; the rule itself would choose wave 9 (met: no). Registered: met no, training coverage 70%.

## Estimand livesLost (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)

| pair | seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| random-static | 150 | 0.067 | [-0.223, 0.351] |
| prior-random | 150 | 1.631 | [1.236, 2.054] |
| adaptive-prior | 150 | -0.257 | [-0.509, -0.016] |
| adaptive2-prior | 150 | -1.730 | [-2.065, -1.412] |
| adaptive-static | 150 | 1.441 | [1.156, 1.758] |
| adaptive2-static | 150 | -0.032 | [-0.196, 0.133] |
| counter-static | 150 | 0.474 | [0.225, 0.722] |
| counter-prior | 150 | -1.224 | [-1.583, -0.881] |

## Estimand won (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)

| pair | seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| random-static | 150 | -0.018 | [-0.040, 0.004] |
| prior-random | 150 | -0.110 | [-0.140, -0.082] |
| adaptive-prior | 150 | 0.020 | [-0.004, 0.046] |
| adaptive2-prior | 150 | 0.128 | [0.101, 0.156] |
| adaptive-static | 150 | -0.108 | [-0.131, -0.085] |
| adaptive2-static | 150 | -0.000 | [-0.018, 0.018] |
| counter-static | 150 | -0.031 | [-0.054, -0.009] |
| counter-prior | 150 | 0.097 | [0.069, 0.128] |

## Estimand finalWave (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)

| pair | seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| random-static | 150 | -0.206 | [-0.326, -0.090] |
| prior-random | 150 | -0.157 | [-0.317, -0.009] |
| adaptive-prior | 150 | -0.083 | [-0.196, 0.045] |
| adaptive2-prior | 150 | 0.376 | [0.239, 0.529] |
| adaptive-static | 150 | -0.446 | [-0.577, -0.322] |
| adaptive2-static | 150 | 0.013 | [-0.092, 0.123] |
| counter-static | 150 | -0.129 | [-0.266, 0.007] |
| counter-prior | 150 | 0.234 | [0.072, 0.406] |

## Estimand leakFraction (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)

| pair | seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| random-static | 150 | 0.005 | [0.002, 0.008] |
| prior-random | 150 | 0.002 | [-0.001, 0.006] |
| adaptive-prior | 150 | 0.003 | [0.001, 0.006] |
| adaptive2-prior | 150 | -0.005 | [-0.008, -0.002] |
| adaptive-static | 150 | 0.010 | [0.008, 0.013] |
| adaptive2-static | 150 | 0.002 | [-0.000, 0.004] |
| counter-static | 150 | 0.007 | [0.003, 0.010] |
| counter-prior | 150 | -0.000 | [-0.004, 0.003] |

## Estimand penetration (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)

| pair | seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| random-static | 150 | 0.004 | [0.001, 0.007] |
| prior-random | 150 | 0.012 | [0.008, 0.015] |
| adaptive-prior | 150 | 0.003 | [0.001, 0.006] |
| adaptive2-prior | 150 | -0.013 | [-0.016, -0.010] |
| adaptive-static | 150 | 0.019 | [0.016, 0.022] |
| adaptive2-static | 150 | 0.003 | [0.000, 0.005] |
| counter-static | 150 | -0.002 | [-0.006, 0.002] |
| counter-prior | 150 | -0.018 | [-0.022, -0.013] |

## Fixed-wave style contrast (unlocked predicted types only; estimate and 95% CI, no p-values)

| wave | mode | seeds | observed units | coverage | estimate | 95% CI | zero check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | adaptive | 141 | 614/614 | 100% | 0.126 | [0.090, 0.161] | - |
| 5 | adaptive2 | 141 | 614/614 | 100% | 0.086 | [0.062, 0.111] | - |
| 5 | counter | 141 | 614/614 | 100% | 0.478 | [0.418, 0.537] | - |
| 5 | prior | 141 | 614/614 | 100% | 0.000 | [0.000, 0.000] | ok |
| 5 | random | 141 | 614/614 | 100% | 0.000 | [0.000, 0.000] | ok |
| 9 | adaptive | 124 | 453/614 | 74% | 0.186 | [0.153, 0.218] | - |
| 9 | adaptive2 | 127 | 469/614 | 76% | 0.097 | [0.080, 0.115] | - |
| 9 | counter | 124 | 460/614 | 75% | 0.437 | [0.407, 0.468] | - |
| 9 | prior | 123 | 446/614 | 73% | 0.000 | [0.000, 0.000] | ok |
| 9 | random | 124 | 454/614 | 74% | 0.000 | [0.000, 0.000] | ok |
| 13 | adaptive | 103 | 370/614 | 60% | 0.263 | [0.208, 0.319] | - |
| 13 | adaptive2 | 114 | 409/614 | 67% | 0.184 | [0.152, 0.216] | - |
| 13 | counter | 114 | 402/614 | 65% | 0.489 | [0.461, 0.518] | - |
| 13 | prior | 110 | 386/614 | 63% | 0.000 | [0.000, 0.000] | ok |
| 13 | random | 106 | 391/614 | 64% | 0.000 | [0.000, 0.000] | ok |

## Fixed-wave style contrast on the matched set (units observed at that wave in adaptive, adaptive2 AND counter; descriptive)

| wave | mode | matched units | seeds | estimate | 95% CI |
| --- | --- | --- | --- | --- | --- |
| 5 | adaptive | 614 | 141 | 0.126 | [0.090, 0.161] |
| 5 | adaptive2 | 614 | 141 | 0.086 | [0.062, 0.111] |
| 5 | counter | 614 | 141 | 0.478 | [0.418, 0.537] |
| 9 | adaptive | 435 | 121 | 0.186 | [0.152, 0.220] |
| 9 | adaptive2 | 435 | 121 | 0.097 | [0.080, 0.115] |
| 9 | counter | 435 | 121 | 0.435 | [0.401, 0.468] |
| 13 | adaptive | 351 | 98 | 0.267 | [0.210, 0.325] |
| 13 | adaptive2 | 351 | 98 | 0.163 | [0.128, 0.200] |
| 13 | counter | 351 | 98 | 0.489 | [0.458, 0.521] |

## Coverage at the primary wave 9

| mode | observed | population | coverage |
| --- | --- | --- | --- |
| adaptive | 453 | 614 | 74% |
| adaptive2 | 469 | 614 | 76% |
| counter | 460 | 614 | 75% |
| prior | 446 | 614 | 73% |
| random | 454 | 614 | 74% |

## Sensitivity: K1 on all units; K2 and K3 on the matched set

| analysis | units / seeds | estimate | 95% CI |
| --- | --- | --- | --- |
| K1 on all units | 750 units / 150 seeds | 0.087 | [-0.147, 0.325] |
| K2 on the matched set | 435 units / 121 seeds | 0.186 | [0.152, 0.220] |
| K3 on the matched set | 435 units / 121 seeds | 0.097 | [0.080, 0.115] |

## Sensitivity: leave-one-style-out estimate (the style removed)

| hypothesis | balancedR | noLance | noMortar | noPoison | noSniper | min | max | sign stable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K1 | 0.046 | 0.123 | 0.106 | 0.117 | -0.036 | -0.036 | 0.123 | no |
| K2 | 0.186 | 0.245 | 0.159 | 0.252 | 0.094 | 0.094 | 0.252 | yes |
| K3 | 0.097 | 0.125 | 0.059 | 0.140 | 0.057 | 0.057 | 0.140 | yes |

## Power (descriptive and post hoc, not part of the confirmatory plan): seeds needed for 80% power at the observed estimate and alpha 0.016667

| id | sd of seed values | seeds needed |
| --- | --- | --- |
| K1 | 1.811 | 7671 |
| K2 | 0.188 | 11 |
| K3 | 0.099 | 11 |

## Notes

- The confirmatory family is exactly K1-K3; everything else in this report is estimation (point estimates and confidence intervals, no p-values).
- The bots are scripted players on one map with fixed tower mixes, not humans.
- The validation seeds were not used for confirmation because they are not pristine (they were part of the tuning set that was read earlier).
- The counter arm reads the tower loadout and is a reference, not a fair competitor.
- The random and prior contrasts are zero by construction: their tilts cannot depend on the defense.
- The attribution pairs are estimates, not tests: they split a Director's total effect into composition variability, enemy-durability bias and learning.
