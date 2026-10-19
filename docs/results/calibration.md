# Bot calibration (static mode, calibration seeds, ablation styles)

Stage 1: mean win rate in [0.5, 0.9], every style at least 0.2, closest to 0.7. Stage 2: the same with every style at least 0.1. Stage 3: styles below 0.1 are dropped (balancedR may not be; at least 4 styles remain) and the mean is recomputed over the rest. Ties: larger tilePool, then smaller upgradeAfter. focusWeight is fixed (the ablation styles ignore it).

| tilePool | upgradeAfter | balancedR | noLance | noMortar | noFrost | noPoison | noSniper | mean win | mean lives lost | qualifies in stage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 | 0.60 | 0.20 | 0.60 | 0.00 | 0.30 | 0.20 | 0.317 | 16.05 | - |
| 1 | 6 | 0.50 | 0.20 | 0.70 | 0.00 | 0.40 | 0.40 | 0.367 | 15.55 | - |
| 1 | 8 | 0.50 | 0.20 | 0.70 | 0.00 | 0.30 | 0.40 | 0.350 | 15.80 | - |
| 3 | 4 | 0.50 | 0.10 | 0.80 | 0.10 | 0.30 | 0.60 | 0.400 | 14.72 | - |
| 3 | 6 | 0.50 | 0.10 | 0.50 | 0.10 | 0.40 | 0.60 | 0.367 | 15.45 | - |
| 3 | 8 | 0.40 | 0.20 | 0.50 | 0.00 | 0.30 | 0.50 | 0.317 | 15.63 | - |
| 6 | 4 | 0.70 | 0.20 | 0.80 | 0.00 | 0.50 | 0.40 | 0.433 | 14.83 | 3 |
| 6 | 6 | 0.40 | 0.10 | 0.70 | 0.00 | 0.50 | 0.40 | 0.350 | 15.35 | - |
| 6 | 8 | 0.50 | 0.30 | 0.70 | 0.00 | 0.50 | 0.30 | 0.383 | 15.30 | - |

Chosen in stage 3: {"tilePool":6,"focusWeight":0.3,"upgradeAfter":4} (mean win rate 0.520 over the kept styles).

**Dropped styles: noFrost** (static win rate below 0.1).
