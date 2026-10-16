# HaorShield V2 — Competition submission brief

**Submission date:** 17 October 2026  
**Website:** https://haorshield.pages.dev  
**Repository:** https://github.com/IsratJahan973/HaorShield

## Problem and intended user

Farmers in northeastern Bangladesh need accessible weather, rainfall, river-flow context and practical preparation information. HaorShield provides an easy-to-navigate experimental tool that brings those signals together in a location-specific interface. It is *not* an official or validated flood-warning service.

## Deliverable

A responsive web prototype covering seven northeastern districts, with four farmer-facing sections: Flood Check, Weather, Rain Map and Crop Advice. Flood Check presents three horizons (24/48/72 hours) and a geographic monitoring map. Crop guidance distinguishes Boro/Aman/Aus rice and responds to crop growth stage and observed field conditions.

## How the 3-minute demo should go

1. **0:00–0:30 — Select location.** Open the live website and choose Sunamganj or another supported district.
2. **0:30–1:15 — Flood Check.** Show the 24/48/72-hour experimental concern messages and forecast rainfall. Emphasize that low local rain does *not* guarantee no flooding due to upstream water and imperfect river mapping.
3. **1:15–1:55 — Map.** Show the light-blue mapped district area when no heightened signal is identified. Explain that, for a period with increased experimental concern, the separate geographic screening can highlight candidate cells in orange. Never simulate a live warning by altering real data.
4. **1:55–2:30 — Crops.** Choose Aman rice, young plants and standing water. Show the resulting practical steps. Changing to Boro/Aus or river-rise conditions changes the instructions.
5. **2:30–3:00 — Reliability and limitations.** Summarize tested code, scheduled data refresh, and the lack of independently validated flood-occurrence labels. Direct users to official FFWC alerts for urgent decisions.

## Observed verification, as reported during final testing

- Nine JavaScript test files passed (`node --test`: 9 pass, 0 fail) on the user's Windows project checkout.
- Frontend production build completed with Vite 6.4.4 and 1,633 transformed modules, on that checkout.
- The user confirmed desktop and mobile navigation behavior.
- A manual GitHub Actions spatial-refresh workflow run was shown as successful, and the next map was visible; success of future scheduled runs remains unverified.
- The final map-color display was user-observed to show light blue in no-elevated-concern periods, with a visible legend.

**Verification caveat:** Earlier local test/build results do not by themselves prove that the deployed GitHub commit contains every subsequent map patch; compare deployment commit to the final GitHub branch and rerun tests on the final checkout if necessary.

## Functional requirements — honest status

| Requirement | Competition-prototype status |
|---|---|
| FR-01–05 | Implemented weather/location/rainfall functions; comprehensive acceptance tests not documented |
| FR-06 | Experimental 24/48/72-hour flood-concern screening; independently validated flood-occurrence prediction **not delivered** |
| FR-07 | Research concern categories; independently verified probability-calibrated risk classes **not delivered** |
| FR-08–10 | Experimental mapped cells and mapped cropland/land-area context; **not** predicted flooded hectares or km² |
| FR-11 | Crop-stage and field-condition-specific advice implemented |
| FR-12 | Dated forecast and land data, freshness guard and manual refresh demonstrated; recurring automated operation still to verify |
| FR-13–14 | Plain-language factors/limitations and unavailable-data messages implemented in tested views |
| FR-15 | Desktop/mobile user review reported as working; broader accessibility/device audit not yet conducted |

## Sources and limitations to state to judges

- Weather and GloFAS modeled discharge are external forecast inputs; a model cell may not be hydrologically matched to the selected farmer's actual river.
- GloFAS daily dates are not identical to exact rolling 24/48/72-hour rainfall windows.
- Geographic shading reflects a research screening indicator, not a measured/current flood footprint or validated flood probability.
- The historical research RF used proxy labels with incomplete observed positives/negatives. Public calibrated flood probabilities and validated risk ranks are scientifically unsupported. Do not quote proxy ROC-AUC as deployed prediction accuracy.
- FFWC/BWDB station danger levels must not be directly compared to GloFAS modeled discharge.
- The model, rain and exposure data may occasionally be stale or missing; the website should not turn missing information into a low-risk result.

## Final pre-submit actions

- [ ] Confirm latest GitHub `main` commit matches the successful Cloudflare deployment and website behavior.
- [ ] Run `node --test` and `npm run build` on the latest repository code (not an older downloaded ZIP).
- [ ] Check one 24h, 48h and 72h outlook and the corresponding map on the actual live site.
- [ ] Verify the spatial workflow schedule exists; a future scheduled run is the test of recurring refresh reliability.
- [ ] Take a final source ZIP backup and keep the competition submission link, demo and limitations text together.

## Suggested one-sentence pitch

“HaorShield is an accessible, experimental flood-concern and crop-preparedness platform for seven northeastern Bangladesh districts, combining short-term weather, modeled river-flow context and geographic screening to help farmers decide what to monitor next.”
