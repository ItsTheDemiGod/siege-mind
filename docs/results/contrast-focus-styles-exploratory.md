# Style contrast on archived data

Exploratory and post-hoc: this statistic was designed after seeing these data; it is a sanity check of the statistic on archived data, not a result.

| mode | seeds | mean contrast | 95% CI | sign-flip p | rows used | rows excluded |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 30 | 0.028 | [-0.006, 0.065] | 0.1366 | 135 | 15 |
| random | 30 | 0.005 | [-0.074, 0.080] | 0.9053 | 135 | 15 |

Paired difference, adaptive minus random: 30 seeds, mean 0.023, 95% CI [-0.051, 0.109], sign-flip p 0.6114.

| style | predicted type | mean contrast (adaptive) | n | mean contrast (random) |
| --- | --- | --- | --- | --- |
| lanceHeavy | swarmling | -0.006 | 27 | 0.072 |
| mortarHeavy | fastRunner | 0.002 | 27 | 0.158 |
| poisonHeavy | fastRunner | 0.029 | 30 | 0.012 |
| poisonHeavy | shieldedBruiser | 0.070 | 30 | -0.029 |
| sniperHeavy | fastRunner | -0.025 | 27 | -0.036 |
| sniperHeavy | swarmling | 0.101 | 27 | -0.095 |
