# Bot calibration (static mode, calibration seeds)

Rule: mean win rate in [0.5, 0.9], every style at least 0.2, closest to 0.7; ties: larger tilePool, smaller focusWeight, smaller upgradeAfter.

| tilePool | focusWeight | upgradeAfter | balancedR | lanceHeavy | mortarHeavy | poisonHeavy | sniperHeavy | mean win | mean lives lost | qualifies |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.3 | 6 | 0.50 | 0.70 | 0.70 | 0.90 | 0.40 | 0.640 | 11.36 | yes |
| 1 | 0.4 | 6 | 0.50 | 0.70 | 0.60 | 0.60 | 0.40 | 0.560 | 10.84 | yes |
| 1 | 0.5 | 6 | 0.50 | 0.70 | 0.40 | 0.60 | 0.20 | 0.480 | 13.42 | no |
| 3 | 0.3 | 6 | 0.50 | 0.60 | 0.60 | 0.80 | 0.60 | 0.620 | 11.84 | yes |
| 3 | 0.4 | 6 | 0.50 | 0.90 | 0.40 | 0.60 | 0.30 | 0.540 | 12.76 | yes |
| 3 | 0.5 | 6 | 0.50 | 0.60 | 0.30 | 0.40 | 0.30 | 0.420 | 14.78 | no |
| 6 | 0.3 | 6 | 0.40 | 0.50 | 0.80 | 0.90 | 0.40 | 0.600 | 11.90 | yes |
| 6 | 0.4 | 6 | 0.40 | 0.80 | 0.70 | 0.50 | 0.30 | 0.540 | 12.02 | yes |
| 6 | 0.5 | 6 | 0.40 | 0.70 | 0.30 | 0.60 | 0.50 | 0.500 | 12.92 | yes |

Chosen: {"tilePool":1,"focusWeight":0.3,"upgradeAfter":6} (mean win rate 0.640).
