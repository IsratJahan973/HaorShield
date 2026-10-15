# HaorShield V2 — Final acceptance status

**Scope:** Experimental agriculture-first flood-related screening for Brahmanbaria, Habiganj, Kishoreganj, Moulvibazar, Netrakona, Sunamganj and Sylhet. This report is based on the October 15 GitHub backup snapshot, prior user-confirmed browser/mobile tests, and repeatable dataset checks. It is **not** an independent validation of a flood forecasting model.

## Requirements

| ID | State | Evidence / remaining limitation |
|---|---|---|
| FR-01 | Implemented, tested examples | District selector; locality search/autocomplete and boundary rejection; GPS tested outside coverage. Not an exhaustive location test. |
| FR-02 | Implemented, tested example | Supported date and 72h selection; date availability logic tested. Check edge hours/DST-independent Asia/Dhaka calculations. |
| FR-03 | Implemented, tested example | Weather current temperature, relative humidity, precipitation, wind and timestamps shown on live site. |
| FR-04 | Implemented, tested example | Weather forecast rainfall amount in mm and available hourly probability. Hourly maximum is not whole-day rain chance. |
| FR-05 | Implemented | No Rain, Light, Moderate, Heavy and Very Heavy categories, based on *project-defined* 24h-equivalent rates. Not official BMD categories. |
| FR-06 | **NOT SATISFIED** | There is no independently verified future flood-outcome reference, held-out test or calibrated flood occurrence probability. SAR candidate fractions are not flood probabilities. |
| FR-07 | **NOT SATISFIED** | No defensible verified flood probability exists to convert to official-looking Low/Moderate/High/Very High flood risk. Map colours label research candidate fractions only. |
| FR-08 | Partial | The map renders research candidate fractions across 306 cells / 7 districts / 3 horizons; NOT validated future flood-risk level mapping. |
| FR-09 | Partial | Entire flagged-grid-cell area in km² is computed and labeled, NOT predicted inundation. |
| FR-10 | Partial | WorldCover cropland in flagged grid cells (ha) is computed; this is not predicted affected cropland. |
| FR-11 | Implemented, tested examples | Crop type, growth stage and observed field condition alter advice. General precaution, not verified crop loss or official directive. |
| FR-12 | Implemented, one run verified | GitHub Actions regenerated 306-cell data and Cloudflare reflected new issue date. Continued schedule reliability needs monitoring. |
| FR-13 | Partial | Rain, antecedent-rain and modeled discharge contextual inputs shown; these are not measured model feature attribution. |
| FR-14 | Substantially implemented | Timestamp, staleness and experimental disclaimers; missing value handling and reader comprehension need ongoing checks. |
| FR-15 | Working in tested cases | English-only responsive site tested on real phone, including location search, GPS and spatial map appearance. Full device/browser matrix not tested. |

## Data QA (snapshot, NOT forecast skill)

- 306 unique cells with expected district allocations; three horizon attributes per cell.
- 24h land/cropland research proxies: 101152.48 / 65366.96 ha; flagged grid 3612.85 km².
- 48h land/cropland research proxies: 79336.57 / 49740.39 ha; flagged grid 3206.11 km².
- 72h land/cropland research proxies: 87569.38 / 56795.21 ha; flagged grid 3353.33 km².
- All flagged areas count **entire cells**, even when only the candidate fraction exceeds 10%.

## Scientific acceptance gate for FR-06 and FR-07

Do not label a percentage **flood probability** or any cell **Low / Moderate / High / Very High flood risk** unless independently observed future flood/non-flood outcomes and issue-time covariates permit leakage-safe evaluation, proper calibration (reliability curves/Brier score), spatial and temporal out-of-sample checks and a justified threshold policy. Model accuracy measured on SAR-derived proxy labels does not satisfy this gate.

## Demo walkthrough (3–5 min)

1. Open Check My Risk. Search a supported district/locality; demonstrate that unsupported GPS is rejected.
2. Choose a supported date. Show current weather and next-72-hour rainfall, noting that rain chance is NOT flood probability.
3. Select a crop, growth stage and field condition. Show advice and official warnings.
4. Show experimental flagged grid areas and cropland within them, pointing out that these are entire **screening cells**, not expected inundation.
5. Open 24/48/72h Spatial Outlook. Change district and horizon; show map, table, issue time and uncertainty.
6. Explain GitHub Actions automated refresh and final scientific limitation: validated flood probabilities and inundation remain future development.

## Deployment instructions

This delivery contains **one frontend component** and **one QA test**, plus this report. Copy `frontend/src/FutureSpatialOutlook.jsx` into the existing GitHub repo. Copy `tests/verify_horizon_consistency.py` to `tests/`. Do **not** upload data fixtures from the internal test run over newer GitHub Actions forecast outputs. Wait for Cloudflare Success and check one horizon/district manually. No backend or model changes.

**Backups:** GitHub repo ZIP saved by user. Preserve a fresh final GitHub ZIP after deployment. If using Kaggle again, save notebook version, create project ZIP and persist it before an idle session.
