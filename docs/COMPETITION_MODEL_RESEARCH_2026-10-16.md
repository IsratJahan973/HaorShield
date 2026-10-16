# HaorShield V2 — 16 October 2026 research status and deployment boundary

## What is new

- Kaggle Cell 3 trained retrospective six-station Random Forest classifiers for research labels at 24, 48 and 72 hours (historical period 2013–2025, chronological split around 8 May 2024).
- Holdout proxy AUC: **0.872**, **0.832**, **0.815** respectively.
- At the research score threshold 0.5, precision: **9.1%**, **10.5%**, **13.3%**; recall **70.5%**, **76.2%**, **82.4%**; false positives **618**, **926**, **1033**.
- Brier score (model vs prevalence baseline): 24h **0.1045 vs 0.0253**, 48h **0.1407 vs 0.0415**, 72h **0.1605 vs 0.0565**. Therefore scores should **not** be advertised as calibrated probabilities.
- Research predictors rank upstream and local rainfall highly. Some discharge features are missing for up to 83.3% of test rows.
- Kaggle Cell 4 assessed 0.3–0.9 alert thresholds on the same holdout. This exploration cannot be used to claim independently validated threshold selection.

## FFWC cross-check

2017 FFWC annual report evidence at six river stations reports historical danger levels and annual peak levels. Five stations show annual peak danger exceedance. The candidate research Parquet has zero nonmissing `flood_byStor` measurements in 2017 for these six stations; Durgapur additionally has zero future proxy positives, despite five reported days of station danger-level exceedance. This demonstrates a data-definition mismatch, **not** an automatic proof that a particular daily label is wrong. Annual station summaries cannot construct verified daily negatives or 24/48/72h outcomes.

## Strict presentation rules

- Do **not** show Kaggle classifier output as verified flood probability.
- Do **not** imply the displayed SAR candidate maps represent predicted inundation.
- Do **not** interpret full grid-cell cropland as expected crop loss.
- Do **not** integrate research RF joblib files into the operational backend.
- Present operational weather from the existing forecast service, dated experimental scenario maps, and clear limitations. Refer users to official FFWC/BWDB warnings.

## Remaining requirements

FR-06 calibrated future flood probability and FR-07 verified categorical flood risk are **NOT satisfied** by these results. An independently timestamped set of both flood and non-flood observational outcomes, archived issue-time predictors, out-of-time and out-of-station evaluation, and calibration are required.

## Source trace

The public research evidence page carries the data file `frontend/public/data/haorshield_official_station_research.json`, transcribed from the *user-reported Kaggle Cell 2, Cell 3 and Cell 4 outputs*. The original report and Kaggle research artifacts are separate and are not included in this source backup. This is **documented user-run research**, not independently reproduced training in this package.
