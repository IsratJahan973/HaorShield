# HaorShield FR-06/FR-07: Forecast-model evidence status (October 16, 2026)

## Work done in this package

- Audited `research/sar_proxy_benchmark_inputs.csv`: 3,497 cell-date records, 26 SAR acquisition dates, 304 represented cell IDs; target is an **unverified SAR candidate**, not independently observed flood occurrence in subsequent 24/48/72 hours.
- Audited three historical MODIS event polygons (`frontend/public/data/haorshield_flood_{4382,4459,4508}.geojson`): they have event labels such as `2016 Jul-Aug` and historical extents, **not exact forward observation times and verified flood/non-flood pairs**.
- Built `scripts/train_verified_future_flood.py`: a **non-production** time-purged, horizon-separated comparison of a prevalence baseline, Random Forest and histogram gradient boosting on *verified future-outcome inputs only*. Scores include precision, recall, Brier score and average precision. Training output is a *diagnostic* JSON only, never a production model or displayed flood probability.
- Tested rejection of the actual proxy CSV and rejection of feature timestamps after the forecast issue, plus successful execution on **synthetic test-only** data. Synthetic-test metrics are not scientific evidence.

## What real data must be gathered

One verified record per `(issue_utc, cell_id, horizon_hours)`, with:

`issue_utc, cell_id, horizon_hours, feature_cutoff_utc, outcome_start_utc, outcome_end_utc, observed_flood, outcome_verified, outcome_source, rain_past7_mm, rain_past30_mm, elevation_m, slope_deg`.

Optional **if recorded at or before the issue time**: `soil_moisture_issue, river_level_issue, upstream_rain_forecast_issue`.

A valid **negative** requires an observed non-flood during the entire forward interval, not merely a missing satellite detection. The outcome_source must document independent ground/satellite/agency verification at sufficient temporal resolution. Input data timing and satellite obscuration/missingness need an external audit. Add historical forecast archives for realistic deployment-domain comparisons; historical observed precipitation alone does not substitute for archived issue-time rainfall predictions. The scripts do **not** fabricate those records or download live datasets.

## Current limitations

FR-06: NO scientifically validated 24/48/72-hour future flood probability. FR-07: NO validated Low/Moderate/High/Very High flood-risk thresholds. Do not imply that experimental SAR scenario fractions, geographic grid areas, or cropland proxies measure these quantities. The existing live weather and screening pages are unchanged.

`python scripts/train_verified_future_flood.py --input research/sar_proxy_benchmark_inputs.csv` should return **EVIDENCE GATE BLOCKED** and exit 2. That is the correct safety behavior. When a genuine verified dataset becomes available, supply it using the schema and inspect diagnostic JSON before considering any live model release.

## Further scientific verification required even after this script runs

Independently audit ground truth, geospatial matching, predictor availability, model selection, unseen flood events, probability calibration, uncertainty by district and horizon, and calibration/risk thresholds on untouched data. Successful execution alone does not establish operational reliability.
