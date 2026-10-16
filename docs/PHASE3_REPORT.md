# HaorShield — Phase 3: independent future-flood validation feasibility

## Decision: independently validated flood-prediction accuracy remains **not established**

This package contains **offline research and testing utilities only**. No UI files, flood warning thresholds, or live data sources are changed. Keep historical data **out of the main farmer interface**.

### Project evidence reviewed

- `docs/historical_flood_source_inventory.csv`: three MODIS historical events (4382, 4459, 4508). The inventory states exact forward observation windows and verified negative controls are absent. Event-wide maximum inundation does not identify exactly which 24/48/72-hour forecast was correct.
- `research/sar_proxy_benchmark_inputs.csv`: SAR candidate labels are research screening results, not ground truth for predicted future flooding.
- `scripts/train_verified_future_flood.py`: existing evidence gate refuses candidate/proxy labels, checks chronology, and produces diagnostic results without deploying a trained model. It has synthetic-test coverage, **not a verified-outcome accuracy result**.

### Independent source options (verified public documentation)

1. [Global Flood Database / Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/GLOBAL_FLOOD_DB_MODIS_EVENTS_V1): provides flood-event extent, duration, and clear-view coverage, but maximum flooded area and three-day MODIS composites cannot on their own establish exact 24/48/72-hour lead-time labels.
2. [Copernicus GloFAS Reforecast](https://ewds.climate.copernicus.eu/datasets/cems-glofas-reforecast?tab=download): genuine historical forecast-issue series useful for reconstructing what was predictable. Reforecasts may differ from the present operational forecast configuration; document model version and issue times.
3. Independent observed event and control locations with timestamps (e.g., agency gauge observations supplemented by documented inundation observations) are required to label the exact forecast outcome. A high discharge alone cannot automatically be declared observed flooding.

### Work completed here

- Audited availability and **blocked** any false claim of independent accuracy.
- Added a reproducible inventory audit producing machine-readable JSON.
- Added a stdlib-only regression test.
- No alteration to the farmer-facing interface or current prototype classifications.

### Steps needed to finish scientific validation

1. Obtain timestamped independent inundation observations **and observed non-flood controls** covering the same 7 districts, with observation provenance and cloud/visibility checks.
2. Obtain historical forecast issue-time meteorological inputs and corresponding GloFAS reforecast values; ensure identical temporal definitions for 24/48/72 hours. Reforecast archives alone do not reproduce all past live warnings.
3. Join observed outcomes to forecast-issue/cell pairs with exact windows and verify no post-issue feature leakage.
4. Reserve flood events/years as strictly held-out periods; evaluate POD/recall, false alarm ratio, precision, confusion matrix and lead-time performance by district and horizon, with uncertainty intervals and a persistence baseline.
5. Tune threshold values only on training/validation dates, then freeze and evaluate on the untouched test period. If records are too sparse, report 'insufficient evidence' rather than accuracy estimates.

### Installation and commands

Copy `scripts/audit_flood_validation_readiness.py` and `tests/test_validation_readiness.py` to the matching paths in the repo. Run from repository root:

```powershell
python tests/test_validation_readiness.py
python scripts/audit_flood_validation_readiness.py --root . --out docs/FR06_VALIDATION_READINESS.json
python tests/test_verified_future_flood_gate.py
```

This package deliberately does **not** install extra dependencies, schedule background jobs, train a production model, or change the live site.
