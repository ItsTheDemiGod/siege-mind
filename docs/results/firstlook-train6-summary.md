# First look at the new arms (exploratory, training seeds)

First look at the research arms: modes static, adaptive, random, adaptive2, counter, prior; 71 of 100 units in the population.

## Population (units whose static game reached wave 5 or later)

| units | seeds | units excluded | all units | all seeds |
| --- | --- | --- | --- | --- |
| 71 | 20 | 29 | 100 | 20 |

## Lives lost by style and mode, on the population

| style | static | adaptive | random | adaptive2 | counter | prior |
| --- | --- | --- | --- | --- | --- | --- |
| balancedR | 6.769 (sd 6.274, n 13) | 9.077 (sd 7.783, n 13) | 9.077 (sd 6.958, n 13) | 7.077 (sd 6.304, n 13) | 7.154 (sd 6.631, n 13) | 9.615 (sd 7.837, n 13) |
| noLance | 13.182 (sd 6.926, n 11) | 14.000 (sd 7.589, n 11) | 13.364 (sd 6.889, n 11) | 13.545 (sd 7.789, n 11) | 14.000 (sd 7.510, n 11) | 12.091 (sd 7.816, n 11) |
| noMortar | 7.438 (sd 7.580, n 16) | 7.938 (sd 9.044, n 16) | 9.250 (sd 8.283, n 16) | 7.313 (sd 7.744, n 16) | 8.063 (sd 7.672, n 16) | 8.500 (sd 8.794, n 16) |
| noPoison | 11.385 (sd 8.540, n 13) | 17.000 (sd 5.701, n 13) | 13.538 (sd 7.870, n 13) | 11.462 (sd 8.222, n 13) | 12.462 (sd 8.038, n 13) | 16.000 (sd 6.205, n 13) |
| noSniper | 14.056 (sd 8.606, n 18) | 14.556 (sd 8.611, n 18) | 14.667 (sd 8.303, n 18) | 14.667 (sd 8.630, n 18) | 14.500 (sd 8.611, n 18) | 15.000 (sd 8.430, n 18) |
| all | 10.606 (sd 8.102, n 71) | 12.423 (sd 8.476, n 71) | 12.014 (sd 7.938, n 71) | 10.859 (sd 8.274, n 71) | 11.254 (sd 8.180, n 71) | 12.282 (sd 8.291, n 71) |

## Win rate by style and mode, on the population

| style | static | adaptive | random | adaptive2 | counter | prior |
| --- | --- | --- | --- | --- | --- | --- |
| balancedR | 100% [0.772, 1.000] (n 13) | 77% [0.497, 0.918] (n 13) | 92% [0.667, 0.986] (n 13) | 92% [0.667, 0.986] (n 13) | 92% [0.667, 0.986] (n 13) | 77% [0.497, 0.918] (n 13) |
| noLance | 73% [0.434, 0.903] (n 11) | 55% [0.280, 0.787] (n 11) | 73% [0.434, 0.903] (n 11) | 64% [0.354, 0.848] (n 11) | 64% [0.354, 0.848] (n 11) | 64% [0.354, 0.848] (n 11) |
| noMortar | 88% [0.640, 0.965] (n 16) | 69% [0.444, 0.858] (n 16) | 69% [0.444, 0.858] (n 16) | 81% [0.570, 0.934] (n 16) | 81% [0.570, 0.934] (n 16) | 69% [0.444, 0.858] (n 16) |
| noPoison | 62% [0.355, 0.823] (n 13) | 38% [0.177, 0.645] (n 13) | 46% [0.232, 0.709] (n 13) | 62% [0.355, 0.823] (n 13) | 54% [0.291, 0.768] (n 13) | 38% [0.177, 0.645] (n 13) |
| noSniper | 44% [0.246, 0.663] (n 18) | 33% [0.163, 0.563] (n 18) | 39% [0.203, 0.614] (n 18) | 33% [0.163, 0.563] (n 18) | 33% [0.163, 0.563] (n 18) | 28% [0.125, 0.509] (n 18) |
| all | 72% [0.605, 0.810] (n 71) | 54% [0.420, 0.646] (n 71) | 62% [0.503, 0.724] (n 71) | 65% [0.532, 0.749] (n 71) | 63% [0.518, 0.736] (n 71) | 54% [0.420, 0.646] (n 71) |

## Final wave by style and mode, on the population

| style | static | adaptive | random | adaptive2 | counter | prior |
| --- | --- | --- | --- | --- | --- | --- |
| balancedR | 15.000 (sd 0.000, n 13) | 13.769 (sd 2.803, n 13) | 14.385 (sd 2.219, n 13) | 14.538 (sd 1.664, n 13) | 14.615 (sd 1.387, n 13) | 13.769 (sd 2.803, n 13) |
| noLance | 13.273 (sd 3.133, n 11) | 11.818 (sd 3.868, n 11) | 13.091 (sd 3.390, n 11) | 12.818 (sd 3.219, n 11) | 12.545 (sd 3.643, n 11) | 12.455 (sd 3.751, n 11) |
| noMortar | 14.313 (sd 2.496, n 16) | 14.000 (sd 2.608, n 16) | 14.188 (sd 2.482, n 16) | 14.063 (sd 2.620, n 16) | 14.313 (sd 2.496, n 16) | 14.188 (sd 2.482, n 16) |
| noPoison | 12.000 (sd 4.528, n 13) | 11.231 (sd 4.512, n 13) | 11.000 (sd 4.509, n 13) | 11.923 (sd 4.645, n 13) | 11.385 (sd 4.629, n 13) | 11.385 (sd 4.312, n 13) |
| noSniper | 10.389 (sd 4.474, n 18) | 9.944 (sd 4.318, n 18) | 10.278 (sd 4.535, n 18) | 10.056 (sd 4.385, n 18) | 10.056 (sd 4.385, n 18) | 9.944 (sd 3.948, n 18) |
| all | 12.859 (sd 3.766, n 71) | 12.085 (sd 3.956, n 71) | 12.479 (sd 3.916, n 71) | 12.549 (sd 3.839, n 71) | 12.479 (sd 3.906, n 71) | 12.254 (sd 3.801, n 71) |

## Leak fraction by style and mode, on the population

| style | static | adaptive | random | adaptive2 | counter | prior |
| --- | --- | --- | --- | --- | --- | --- |
| balancedR | 0.013 (sd 0.012, n 13) | 0.038 (sd 0.063, n 13) | 0.030 (sd 0.054, n 13) | 0.020 (sd 0.033, n 13) | 0.018 (sd 0.025, n 13) | 0.038 (sd 0.061, n 13) |
| noLance | 0.053 (sd 0.083, n 11) | 0.080 (sd 0.095, n 11) | 0.061 (sd 0.089, n 11) | 0.061 (sd 0.088, n 11) | 0.074 (sd 0.117, n 11) | 0.067 (sd 0.094, n 11) |
| noMortar | 0.030 (sd 0.074, n 16) | 0.033 (sd 0.073, n 16) | 0.034 (sd 0.073, n 16) | 0.033 (sd 0.075, n 16) | 0.030 (sd 0.070, n 16) | 0.032 (sd 0.071, n 16) |
| noPoison | 0.116 (sd 0.165, n 13) | 0.137 (sd 0.156, n 13) | 0.136 (sd 0.159, n 13) | 0.125 (sd 0.177, n 13) | 0.128 (sd 0.162, n 13) | 0.120 (sd 0.138, n 13) |
| noSniper | 0.156 (sd 0.159, n 18) | 0.161 (sd 0.147, n 18) | 0.163 (sd 0.163, n 18) | 0.166 (sd 0.161, n 18) | 0.162 (sd 0.158, n 18) | 0.146 (sd 0.129, n 18) |
| all | 0.078 (sd 0.127, n 71) | 0.093 (sd 0.125, n 71) | 0.089 (sd 0.130, n 71) | 0.085 (sd 0.133, n 71) | 0.086 (sd 0.131, n 71) | 0.084 (sd 0.112, n 71) |

## Penetration by style and mode, on the population

| style | static | adaptive | random | adaptive2 | counter | prior |
| --- | --- | --- | --- | --- | --- | --- |
| balancedR | 0.450 (sd 0.033, n 13) | 0.490 (sd 0.054, n 13) | 0.467 (sd 0.048, n 13) | 0.465 (sd 0.043, n 13) | 0.445 (sd 0.055, n 13) | 0.491 (sd 0.054, n 13) |
| noLance | 0.523 (sd 0.086, n 11) | 0.557 (sd 0.075, n 11) | 0.525 (sd 0.066, n 11) | 0.529 (sd 0.084, n 11) | 0.534 (sd 0.099, n 11) | 0.555 (sd 0.078, n 11) |
| noMortar | 0.473 (sd 0.082, n 16) | 0.497 (sd 0.071, n 16) | 0.482 (sd 0.085, n 16) | 0.479 (sd 0.082, n 16) | 0.455 (sd 0.082, n 16) | 0.498 (sd 0.073, n 16) |
| noPoison | 0.527 (sd 0.112, n 13) | 0.555 (sd 0.098, n 13) | 0.546 (sd 0.116, n 13) | 0.532 (sd 0.115, n 13) | 0.531 (sd 0.118, n 13) | 0.545 (sd 0.093, n 13) |
| noSniper | 0.549 (sd 0.147, n 18) | 0.574 (sd 0.123, n 18) | 0.561 (sd 0.152, n 18) | 0.565 (sd 0.139, n 18) | 0.560 (sd 0.156, n 18) | 0.563 (sd 0.124, n 18) |
| all | 0.506 (sd 0.107, n 71) | 0.535 (sd 0.094, n 71) | 0.518 (sd 0.109, n 71) | 0.516 (sd 0.106, n 71) | 0.506 (sd 0.118, n 71) | 0.531 (sd 0.093, n 71) |

## Paired mode differences in livesLost (A - B, seed-level, population; exploratory, NOT adjusted)

| A | B | seeds | mean diff | 95% CI | dz | p raw |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | static | 20 | 1.867 | [0.733, 3.158] | 0.65 | 0.0050 |
| adaptive | random | 20 | 0.398 | [-0.663, 1.597] | 0.15 | 0.5327 |
| adaptive2 | static | 20 | 0.391 | [-0.048, 0.858] | 0.38 | 0.1121 |
| adaptive2 | random | 20 | -1.079 | [-2.127, 0.016] | -0.42 | 0.0732 |
| adaptive2 | adaptive | 20 | -1.477 | [-2.873, -0.237] | -0.48 | 0.0399 |
| counter | static | 20 | 0.712 | [0.136, 1.448] | 0.46 | 0.0348 |
| counter | random | 20 | -0.758 | [-1.842, 0.352] | -0.29 | 0.2123 |
| counter | adaptive2 | 20 | 0.321 | [-0.136, 0.792] | 0.29 | 0.2117 |

## Paired mode differences in won (A - B, seed-level, population; exploratory, NOT adjusted)

| A | B | seeds | mean diff | 95% CI | dz | p raw |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | static | 20 | -0.190 | [-0.281, -0.105] | -0.91 | 0.0010 |
| adaptive | random | 20 | -0.092 | [-0.174, -0.018] | -0.50 | 0.0479 |
| adaptive2 | static | 20 | -0.081 | [-0.156, -0.010] | -0.47 | 0.0780 |
| adaptive2 | random | 20 | 0.018 | [-0.067, 0.099] | 0.09 | 0.7190 |
| adaptive2 | adaptive | 20 | 0.109 | [0.028, 0.191] | 0.56 | 0.0313 |
| counter | static | 20 | -0.099 | [-0.210, -0.007] | -0.42 | 0.1244 |
| counter | random | 20 | -0.001 | [-0.097, 0.079] | -0.00 | 1.0000 |
| counter | adaptive2 | 20 | -0.018 | [-0.093, 0.063] | -0.10 | 0.6566 |

## Paired mode differences in finalWave (A - B, seed-level, population; exploratory, NOT adjusted)

| A | B | seeds | mean diff | 95% CI | dz | p raw |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | static | 20 | -0.798 | [-1.300, -0.347] | -0.71 | 0.0042 |
| adaptive | random | 20 | -0.387 | [-0.826, 0.007] | -0.39 | 0.1004 |
| adaptive2 | static | 20 | -0.343 | [-0.678, -0.075] | -0.48 | 0.0396 |
| adaptive2 | random | 20 | 0.068 | [-0.367, 0.494] | 0.07 | 0.7927 |
| adaptive2 | adaptive | 20 | 0.455 | [0.037, 0.897] | 0.44 | 0.0649 |
| counter | static | 20 | -0.435 | [-0.913, -0.040] | -0.42 | 0.0704 |
| counter | random | 20 | -0.023 | [-0.529, 0.449] | -0.02 | 0.9377 |
| counter | adaptive2 | 20 | -0.092 | [-0.438, 0.240] | -0.12 | 0.6176 |

## Fixed-wave style contrast (final weight of a style on its predicted type minus the other styles; tilt taken from the wave itself)

| wave | mode | observed units | coverage | seeds | mean contrast | 95% CI | p raw |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | adaptive | 71/71 | 100% | 19 | 0.000 | [-0.058, 0.055] | 0.9954 |
| 5 | adaptive2 | 71/71 | 100% | 19 | 0.002 | [-0.036, 0.037] | 0.9275 |
| 5 | counter | 71/71 | 100% | 19 | 0.288 | [0.160, 0.400] | 0.0008 |
| 5 | prior | 71/71 | 100% | 19 | 0.000 | [0.000, 0.000] | 1.0000 |
| 5 | random | 71/71 | 100% | 19 | 0.000 | [0.000, 0.000] | 1.0000 |
| 7 | adaptive | 57/71 | 80% | 15 | -0.024 | [-0.122, 0.059] | 0.6455 |
| 7 | adaptive2 | 58/71 | 82% | 15 | -0.020 | [-0.072, 0.026] | 0.4583 |
| 7 | counter | 58/71 | 82% | 15 | 0.353 | [0.221, 0.487] | 0.0005 |
| 7 | prior | 60/71 | 85% | 16 | 0.000 | [0.000, 0.000] | 1.0000 |
| 7 | random | 59/71 | 83% | 15 | 0.000 | [0.000, 0.000] | 1.0000 |
| 9 | adaptive | 50/71 | 70% | 13 | 0.118 | [-0.025, 0.248] | 0.1296 |
| 9 | adaptive2 | 57/71 | 80% | 15 | 0.033 | [-0.049, 0.107] | 0.4286 |
| 9 | counter | 55/71 | 77% | 15 | 0.341 | [0.229, 0.465] | 0.0001 |
| 9 | prior | 52/71 | 73% | 14 | 0.000 | [0.000, 0.000] | 1.0000 |
| 9 | random | 54/71 | 76% | 15 | 0.000 | [0.000, 0.000] | 1.0000 |
| 11 | adaptive | 47/71 | 66% | 13 | 0.195 | [0.039, 0.341] | 0.0320 |
| 11 | adaptive2 | 50/71 | 70% | 12 | 0.066 | [-0.019, 0.137] | 0.1440 |
| 11 | counter | 49/71 | 69% | 12 | 0.416 | [0.310, 0.545] | 0.0005 |
| 11 | prior | 47/71 | 66% | 12 | 0.000 | [0.000, 0.000] | 1.0000 |
| 11 | random | 50/71 | 70% | 12 | 0.000 | [0.000, 0.000] | 1.0000 |
| 12 | adaptive | 46/71 | 65% | 12 | 0.259 | [0.123, 0.394] | 0.0049 |
| 12 | adaptive2 | 49/71 | 69% | 11 | 0.099 | [0.003, 0.186] | 0.0732 |
| 12 | counter | 49/71 | 69% | 12 | 0.427 | [0.318, 0.553] | 0.0005 |
| 12 | prior | 47/71 | 66% | 12 | 0.000 | [0.000, 0.000] | 1.0000 |
| 12 | random | 50/71 | 70% | 12 | 0.000 | [0.000, 0.000] | 1.0000 |
| 13 | adaptive | 46/71 | 65% | 12 | 0.294 | [0.150, 0.430] | 0.0039 |
| 13 | adaptive2 | 49/71 | 69% | 11 | 0.100 | [-0.016, 0.201] | 0.1182 |
| 13 | counter | 49/71 | 69% | 12 | 0.430 | [0.321, 0.561] | 0.0005 |
| 13 | prior | 47/71 | 66% | 12 | 0.000 | [0.000, 0.000] | 1.0000 |
| 13 | random | 50/71 | 70% | 12 | 0.000 | [0.000, 0.000] | 1.0000 |
| 14 | adaptive | 46/71 | 65% | 12 | 0.309 | [0.158, 0.446] | 0.0034 |
| 14 | adaptive2 | 49/71 | 69% | 11 | 0.097 | [-0.014, 0.194] | 0.1094 |
| 14 | counter | 49/71 | 69% | 12 | 0.425 | [0.309, 0.561] | 0.0005 |
| 14 | prior | 47/71 | 66% | 12 | 0.000 | [0.000, 0.000] | 1.0000 |
| 14 | random | 50/71 | 70% | 12 | 0.000 | [0.000, 0.000] | 1.0000 |
| 15 | adaptive | 40/71 | 56% | 8 | 0.251 | [0.193, 0.309] | 0.0078 |
| 15 | adaptive2 | 47/71 | 66% | 10 | 0.108 | [0.012, 0.205] | 0.0625 |
| 15 | counter | 47/71 | 66% | 10 | 0.419 | [0.328, 0.537] | 0.0020 |
| 15 | prior | 40/71 | 56% | 6 | 0.000 | [0.000, 0.000] | 1.0000 |
| 15 | random | 46/71 | 65% | 9 | 0.000 | [0.000, 0.000] | 1.0000 |

## Per (style, type) contrast at wave 5 (the wave with the best coverage)

| mode | style | type | n | mean contrast |
| --- | --- | --- | --- | --- |
| adaptive | noLance | armoredGrunt | 11 | -0.121 |
| adaptive | noMortar | swarmling | 16 | 0.131 |
| adaptive | noPoison | regenerator | 13 | 0.000 |
| adaptive | noSniper | shieldedBruiser | 17 | 0.000 |
| adaptive2 | noLance | armoredGrunt | 11 | -0.076 |
| adaptive2 | noMortar | swarmling | 16 | 0.091 |
| adaptive2 | noPoison | regenerator | 13 | 0.000 |
| adaptive2 | noSniper | shieldedBruiser | 17 | 0.000 |
| counter | noLance | armoredGrunt | 11 | 0.437 |
| counter | noMortar | swarmling | 16 | 0.376 |
| counter | noPoison | regenerator | 13 | 0.322 |
| counter | noSniper | shieldedBruiser | 17 | 0.189 |
| prior | noLance | armoredGrunt | 11 | 0.000 |
| prior | noMortar | swarmling | 16 | 0.000 |
| prior | noPoison | regenerator | 13 | 0.000 |
| prior | noSniper | shieldedBruiser | 17 | 0.000 |
| random | noLance | armoredGrunt | 11 | 0.000 |
| random | noMortar | swarmling | 16 | 0.000 |
| random | noPoison | regenerator | 13 | 0.000 |
| random | noSniper | shieldedBruiser | 17 | 0.000 |

## Attribution of livesLost (A - B, seed-level, population; exploratory, NOT adjusted)

| A | B | part of | seeds | mean diff | 95% CI | dz | p raw |
| --- | --- | --- | --- | --- | --- | --- | --- |
| random | static | composition variability | 20 | 1.470 | [0.484, 2.454] | 0.63 | 0.0105 |
| prior | random | enemy-durability bias | 20 | 0.228 | [-0.657, 1.144] | 0.11 | 0.6401 |
| adaptive | prior | learning on the prior | 20 | 0.169 | [-0.605, 1.043] | 0.09 | 0.7206 |
| adaptive | static | total (v1) | 20 | 1.867 | [0.733, 3.158] | 0.65 | 0.0050 |
| adaptive2 | prior |  | 20 | -1.308 | [-2.538, -0.220] | -0.48 | 0.0374 |
| adaptive2 | static |  | 20 | 0.391 | [-0.048, 0.858] | 0.38 | 0.1121 |
| counter | static |  | 20 | 0.712 | [0.136, 1.448] | 0.46 | 0.0348 |
| counter | prior |  | 20 | -0.987 | [-2.259, 0.147] | -0.35 | 0.1357 |

## Attribution of won (A - B, seed-level, population; exploratory, NOT adjusted)

| A | B | part of | seeds | mean diff | 95% CI | dz | p raw |
| --- | --- | --- | --- | --- | --- | --- | --- |
| random | static | composition variability | 20 | -0.098 | [-0.183, -0.019] | -0.50 | 0.0477 |
| prior | random | enemy-durability bias | 20 | -0.077 | [-0.158, -0.002] | -0.42 | 0.1093 |
| adaptive | prior | learning on the prior | 20 | -0.015 | [-0.090, 0.052] | -0.09 | 0.8763 |
| adaptive | static | total (v1) | 20 | -0.190 | [-0.281, -0.105] | -0.91 | 0.0010 |
| adaptive2 | prior |  | 20 | 0.094 | [0.037, 0.156] | 0.68 | 0.0155 |
| adaptive2 | static |  | 20 | -0.081 | [-0.156, -0.010] | -0.47 | 0.0780 |
| counter | static |  | 20 | -0.099 | [-0.210, -0.007] | -0.42 | 0.1244 |
| counter | prior |  | 20 | 0.076 | [0.005, 0.150] | 0.44 | 0.0617 |

## Attribution of finalWave (A - B, seed-level, population; exploratory, NOT adjusted)

| A | B | part of | seeds | mean diff | 95% CI | dz | p raw |
| --- | --- | --- | --- | --- | --- | --- | --- |
| random | static | composition variability | 20 | -0.412 | [-0.898, 0.063] | -0.36 | 0.1341 |
| prior | random | enemy-durability bias | 20 | -0.213 | [-0.736, 0.280] | -0.18 | 0.4340 |
| adaptive | prior | learning on the prior | 20 | -0.173 | [-0.486, 0.117] | -0.25 | 0.3321 |
| adaptive | static | total (v1) | 20 | -0.798 | [-1.300, -0.347] | -0.71 | 0.0042 |
| adaptive2 | prior |  | 20 | 0.282 | [-0.048, 0.670] | 0.33 | 0.1764 |
| adaptive2 | static |  | 20 | -0.343 | [-0.678, -0.075] | -0.48 | 0.0396 |
| counter | static |  | 20 | -0.435 | [-0.913, -0.040] | -0.42 | 0.0704 |
| counter | prior |  | 20 | 0.190 | [-0.154, 0.572] | 0.22 | 0.3419 |

## Attribution of leakFraction (A - B, seed-level, population; exploratory, NOT adjusted)

| A | B | part of | seeds | mean diff | 95% CI | dz | p raw |
| --- | --- | --- | --- | --- | --- | --- | --- |
| random | static | composition variability | 20 | 0.011 | [0.002, 0.019] | 0.51 | 0.0327 |
| prior | random | enemy-durability bias | 20 | -0.006 | [-0.018, 0.006] | -0.22 | 0.3468 |
| adaptive | prior | learning on the prior | 20 | 0.009 | [0.001, 0.018] | 0.46 | 0.0562 |
| adaptive | static | total (v1) | 20 | 0.014 | [0.002, 0.025] | 0.50 | 0.0398 |
| adaptive2 | prior |  | 20 | 0.003 | [-0.008, 0.013] | 0.10 | 0.6522 |
| adaptive2 | static |  | 20 | 0.007 | [0.002, 0.012] | 0.59 | 0.0160 |
| counter | static |  | 20 | 0.007 | [0.001, 0.014] | 0.48 | 0.0466 |
| counter | prior |  | 20 | 0.003 | [-0.006, 0.012] | 0.14 | 0.5396 |

## Attribution of penetration (A - B, seed-level, population; exploratory, NOT adjusted)

| A | B | part of | seeds | mean diff | 95% CI | dz | p raw |
| --- | --- | --- | --- | --- | --- | --- | --- |
| random | static | composition variability | 20 | 0.012 | [0.002, 0.023] | 0.51 | 0.0293 |
| prior | random | enemy-durability bias | 20 | 0.014 | [0.003, 0.025] | 0.56 | 0.0222 |
| adaptive | prior | learning on the prior | 20 | 0.003 | [-0.003, 0.010] | 0.22 | 0.3422 |
| adaptive | static | total (v1) | 20 | 0.030 | [0.018, 0.042] | 1.03 | 0.0001 |
| adaptive2 | prior |  | 20 | -0.016 | [-0.025, -0.007] | -0.74 | 0.0018 |
| adaptive2 | static |  | 20 | 0.011 | [0.005, 0.019] | 0.64 | 0.0008 |
| counter | static |  | 20 | 0.002 | [-0.008, 0.012] | 0.07 | 0.7675 |
| counter | prior |  | 20 | -0.025 | [-0.035, -0.016] | -1.13 | 0.0000 |

## Fixed-wave coverage of the population (counts only) and the pre-registered choice

| wave | adaptive | adaptive2 | counter | prior | random | minimum | candidate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 71/71 100% | 71/71 100% | 71/71 100% | 71/71 100% | 71/71 100% | - | no |
| 7 | 57/71 80% | 58/71 82% | 58/71 82% | 60/71 85% | 59/71 83% | - | no |
| 9 | 50/71 70% | 57/71 80% | 55/71 77% | 52/71 73% | 54/71 76% | 70% | chosen |
| 11 | 47/71 66% | 50/71 70% | 49/71 69% | 47/71 66% | 50/71 70% | 66% | yes |
| 12 | 46/71 65% | 49/71 69% | 49/71 69% | 47/71 66% | 50/71 70% | 65% | yes |
| 13 | 46/71 65% | 49/71 69% | 49/71 69% | 47/71 66% | 50/71 70% | 65% | yes |
| 14 | 46/71 65% | 49/71 69% | 49/71 69% | 47/71 66% | 50/71 70% | 65% | yes |
| 15 | 40/71 56% | 47/71 66% | 47/71 66% | 40/71 56% | 46/71 65% | 56% | yes |

## Tilt agreement: mean absolute tilt difference over the five types, units observed in both modes (pooled = all unit-wave cells)

| A | B | wave | units | mean |diff| |
| --- | --- | --- | --- | --- |
| adaptive | prior | 5 | 71 | 0.144 |
| adaptive | prior | 7 | 57 | 0.171 |
| adaptive | prior | 9 | 50 | 0.216 |
| adaptive | prior | 11 | 46 | 0.260 |
| adaptive | prior | 12 | 45 | 0.218 |
| adaptive | prior | 13 | 45 | 0.344 |
| adaptive | prior | 14 | 45 | 0.246 |
| adaptive | prior | 15 | 37 | 0.154 |
| adaptive | prior | pooled | 396 | 0.214 |
| adaptive2 | prior | 5 | 71 | 0.228 |
| adaptive2 | prior | 7 | 57 | 0.244 |
| adaptive2 | prior | 9 | 52 | 0.354 |
| adaptive2 | prior | 11 | 46 | 0.409 |
| adaptive2 | prior | 12 | 45 | 0.268 |
| adaptive2 | prior | 13 | 45 | 0.445 |
| adaptive2 | prior | 14 | 45 | 0.428 |
| adaptive2 | prior | 15 | 39 | 0.444 |
| adaptive2 | prior | pooled | 400 | 0.340 |
| adaptive | adaptive2 | 5 | 71 | 0.140 |
| adaptive | adaptive2 | 7 | 57 | 0.241 |
| adaptive | adaptive2 | 9 | 50 | 0.254 |
| adaptive | adaptive2 | 11 | 46 | 0.286 |
| adaptive | adaptive2 | 12 | 44 | 0.328 |
| adaptive | adaptive2 | 13 | 44 | 0.344 |
| adaptive | adaptive2 | 14 | 44 | 0.394 |
| adaptive | adaptive2 | 15 | 39 | 0.346 |
| adaptive | adaptive2 | pooled | 395 | 0.278 |
| random | prior | 5 | 71 | 0.885 |
| random | prior | 7 | 58 | 0.784 |
| random | prior | 9 | 51 | 0.909 |
| random | prior | 11 | 45 | 0.908 |
| random | prior | 12 | 45 | 0.740 |
| random | prior | 13 | 45 | 0.799 |
| random | prior | 14 | 45 | 0.980 |
| random | prior | 15 | 39 | 1.000 |
| random | prior | pooled | 399 | 0.872 |

## Mean applied tilt per enemy type, per eligible wave (units observed)

| mode | wave | units | armoredGrunt | swarmling | fastRunner | regenerator | shieldedBruiser |
| --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 5 | 71 | 0.80 | 1.34 | 0.81 | 1.00 | 1.00 |
| adaptive | 7 | 57 | 0.73 | 1.34 | 0.55 | 1.20 | 1.00 |
| adaptive | 9 | 50 | 0.77 | 1.21 | 0.53 | 1.31 | 1.15 |
| adaptive | 11 | 47 | 0.68 | 1.06 | 0.54 | 1.36 | 1.30 |
| adaptive | 12 | 46 | 0.73 | 0.88 | 0.45 | 1.42 | 1.30 |
| adaptive | 13 | 46 | 0.67 | 0.83 | 0.40 | 1.40 | 1.39 |
| adaptive | 14 | 46 | 0.67 | 0.76 | 0.46 | 1.42 | 1.44 |
| adaptive | 15 | 40 | 0.48 | 0.60 | 0.46 | 1.26 | 1.34 |
| adaptive2 | 5 | 71 | 0.97 | 1.03 | 1.02 | 1.00 | 1.00 |
| adaptive2 | 7 | 58 | 1.01 | 0.99 | 0.94 | 1.03 | 1.00 |
| adaptive2 | 9 | 57 | 1.00 | 0.98 | 0.91 | 1.02 | 1.02 |
| adaptive2 | 11 | 50 | 0.97 | 0.95 | 0.95 | 1.02 | 1.04 |
| adaptive2 | 12 | 49 | 0.99 | 0.92 | 0.99 | 1.01 | 1.01 |
| adaptive2 | 13 | 49 | 0.94 | 0.92 | 0.95 | 1.04 | 1.06 |
| adaptive2 | 14 | 49 | 1.00 | 0.84 | 1.01 | 0.98 | 1.02 |
| adaptive2 | 15 | 47 | 0.97 | 0.86 | 0.86 | 1.02 | 1.03 |
| prior | 5 | 71 | 0.63 | 1.29 | 0.48 | 1.00 | 1.00 |
| prior | 7 | 60 | 0.87 | 1.49 | 0.76 | 1.44 | 1.00 |
| prior | 9 | 52 | 0.79 | 1.14 | 0.52 | 1.52 | 1.44 |
| prior | 11 | 47 | 0.89 | 0.83 | 0.39 | 1.58 | 1.58 |
| prior | 12 | 47 | 0.98 | 0.99 | 0.63 | 1.39 | 1.26 |
| prior | 13 | 47 | 0.80 | 1.06 | 0.70 | 1.94 | 1.76 |
| prior | 14 | 47 | 0.48 | 0.44 | 0.45 | 1.27 | 1.35 |
| prior | 15 | 40 | 0.41 | 0.34 | 0.33 | 1.29 | 1.37 |
| counter | 5 | 71 | 0.67 | 1.35 | 1.38 | 0.72 | 1.10 |
| counter | 7 | 58 | 0.69 | 1.35 | 1.39 | 0.69 | 1.09 |
| counter | 9 | 55 | 0.67 | 1.35 | 1.39 | 0.69 | 1.09 |
| counter | 11 | 49 | 0.66 | 1.36 | 1.38 | 0.68 | 1.09 |
| counter | 12 | 49 | 0.65 | 1.35 | 1.38 | 0.69 | 1.09 |
| counter | 13 | 49 | 0.64 | 1.35 | 1.39 | 0.69 | 1.10 |
| counter | 14 | 49 | 0.65 | 1.34 | 1.39 | 0.69 | 1.10 |
| counter | 15 | 47 | 0.66 | 1.32 | 1.38 | 0.68 | 1.11 |

## Matched-set sensitivity: fixed-wave contrast restricted to units observed at W in ALL of adaptive, adaptive2 and counter

| wave | mode | matched units | seeds | mean contrast | 95% CI | p raw |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | adaptive | 71 | 19 | 0.000 | [-0.058, 0.055] | 0.9954 |
| 5 | adaptive2 | 71 | 19 | 0.002 | [-0.036, 0.037] | 0.9275 |
| 5 | counter | 71 | 19 | 0.288 | [0.160, 0.400] | 0.0008 |
| 7 | adaptive | 57 | 15 | -0.024 | [-0.122, 0.059] | 0.6455 |
| 7 | adaptive2 | 57 | 15 | -0.019 | [-0.070, 0.028] | 0.5019 |
| 7 | counter | 57 | 15 | 0.351 | [0.219, 0.486] | 0.0005 |
| 9 | adaptive | 49 | 13 | 0.096 | [-0.068, 0.243] | 0.2627 |
| 9 | adaptive2 | 49 | 13 | 0.039 | [-0.068, 0.135] | 0.4771 |
| 9 | counter | 49 | 13 | 0.314 | [0.197, 0.455] | 0.0002 |
| 11 | adaptive | 45 | 12 | 0.154 | [0.005, 0.282] | 0.0640 |
| 11 | adaptive2 | 45 | 12 | 0.079 | [-0.016, 0.167] | 0.1406 |
| 11 | counter | 45 | 12 | 0.408 | [0.294, 0.541] | 0.0005 |
| 12 | adaptive | 43 | 10 | 0.238 | [0.100, 0.363] | 0.0117 |
| 12 | adaptive2 | 43 | 10 | 0.169 | [0.068, 0.278] | 0.0098 |
| 12 | counter | 43 | 10 | 0.403 | [0.289, 0.547] | 0.0020 |
| 13 | adaptive | 43 | 10 | 0.282 | [0.142, 0.415] | 0.0078 |
| 13 | adaptive2 | 43 | 10 | 0.187 | [0.080, 0.311] | 0.0098 |
| 13 | counter | 43 | 10 | 0.410 | [0.292, 0.567] | 0.0020 |
| 14 | adaptive | 43 | 10 | 0.287 | [0.123, 0.435] | 0.0117 |
| 14 | adaptive2 | 43 | 10 | 0.180 | [0.070, 0.298] | 0.0117 |
| 14 | counter | 43 | 10 | 0.399 | [0.284, 0.548] | 0.0020 |
| 15 | adaptive | 38 | 7 | 0.229 | [0.179, 0.277] | 0.0156 |
| 15 | adaptive2 | 38 | 7 | 0.225 | [0.127, 0.318] | 0.0156 |
| 15 | counter | 38 | 7 | 0.457 | [0.363, 0.606] | 0.0156 |

## Units that ended before wave 5, by mode

| mode | units | ended early | won |
| --- | --- | --- | --- |
| adaptive | 100 | 29 | 38 |
| adaptive2 | 100 | 29 | 46 |
| counter | 100 | 29 | 45 |
| prior | 100 | 29 | 38 |
| random | 100 | 29 | 44 |
| static | 100 | 29 | 51 |

Identity check (livesLost, 20 seeds): (adaptive - static) = (random - static) + (prior - random) + (adaptive - prior), largest per-seed error 8.88e-16: holds.

Zero check: the fixed-wave contrast of the random and prior modes is exactly 0 at every wave (by construction).

Fixed wave chosen by the rule (smallest eligible wave >= 9 whose minimum coverage over adaptive, adaptive2, counter, prior and random is at least 0.75; otherwise the wave with the largest minimum coverage): wave 9 (the rule was NOT met: no candidate reached 75% minimum coverage).

Early-ends invariant holds: the same (style, seed) units ended before wave 5 in every mode.

## Notes

- These results are exploratory and on the TRAIN seeds (1001-1020); nothing was tuned and nothing is adjusted for multiple comparisons.
- The prior and random tilts cannot depend on the defense (the random tilts depend only on the seed and the wave, the prior tilts only on the wave), so their fixed-wave contrast is zero by construction.
- The counter arm reads the tower loadout and is a reference, not a fair comparison.
- The attribution chain splits the total effect of Director v1 (adaptive minus static) into three parts that add up exactly: composition variability (random minus static), enemy-durability bias beyond variability (prior minus random) and learning on top of the prior (adaptive minus prior).
- Director v1 and v2 use the same eligibility and fairness rules (same threat per wave, same enemy HP, composition only).
