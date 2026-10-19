# Amendment A1: final tilt measured at the last eligible wave

Phase 8A measured the final tilt at the last wave record (random: its applied tilt; adaptive: the held weights). A1 uses the applied tilt of the last ELIGIBLE record for both modes. The amendment was made after the tuning results had been seen and before any held-out run.

## (a) The artifact in the legacy definition

Legacy random rows whose five tilts are all exactly 1.0 (the last record was not eligible): 42 of 150.

| style | legacy random rows with all tilts 1.0 |
| --- | --- |
| balancedR | 10 |
| lanceHeavy | 7 |
| mortarHeavy | 12 |
| poisonHeavy | 4 |
| sniperHeavy | 9 |

## (b) T1 under both definitions (tilt alignment, final weight at least the threshold on a predicted type)

| style | predicted | legacy adaptive | legacy random | A1 adaptive | A1 random |
| --- | --- | --- | --- | --- | --- |
| lanceHeavy | swarmling | 17% [0.073, 0.336] (n 30) | 47% [0.302, 0.639] (n 30) | 15% [0.059, 0.325] (n 27) | 67% [0.478, 0.814] (n 27) |
| mortarHeavy | fastRunner | 0% [0.000, 0.114] (n 30) | 43% [0.274, 0.608] (n 30) | 0% [0.000, 0.125] (n 27) | 78% [0.592, 0.894] (n 27) |
| poisonHeavy | fastRunner+shieldedBruiser | 73% [0.556, 0.858] (n 30) | 83% [0.664, 0.927] (n 30) | 67% [0.488, 0.808] (n 30) | 97% [0.833, 0.994] (n 30) |
| sniperHeavy | swarmling+fastRunner | 20% [0.095, 0.373] (n 30) | 60% [0.423, 0.754] (n 30) | 26% [0.132, 0.447] (n 27) | 89% [0.719, 0.961] (n 27) |

Pooled T1 (adaptive minus random, mean over seeds): legacy -0.308 [-0.417, -0.200] (30 seeds); A1 -0.556 [-0.647, -0.464] (30 seeds).

## (c) Rows without an observed tilt under A1 (tiltObserved 0)

| mode | rows |
| --- | --- |
| static | 150 |
| adaptive | 15 |
| random | 15 |

## (d) Mean final weight per style, adaptive mode (legacy / A1)

| style | armoredGrunt | swarmling | fastRunner | regenerator | shieldedBruiser |
| --- | --- | --- | --- | --- | --- |
| balancedR | 0.76 / 0.68 | 0.84 / 0.83 | 0.64 / 0.57 | 1.19 / 1.24 | 1.19 / 1.24 |
| lanceHeavy | 0.66 / 0.64 | 0.83 / 0.82 | 0.55 / 0.52 | 1.30 / 1.33 | 1.25 / 1.25 |
| mortarHeavy | 0.68 / 0.66 | 0.84 / 0.84 | 0.56 / 0.53 | 1.27 / 1.30 | 1.22 / 1.20 |
| poisonHeavy | 0.63 / 0.65 | 0.73 / 0.74 | 0.54 / 0.55 | 1.31 / 1.30 | 1.30 / 1.27 |
| sniperHeavy | 0.70 / 0.67 | 0.90 / 0.89 | 0.56 / 0.52 | 1.28 / 1.33 | 1.14 / 1.15 |
