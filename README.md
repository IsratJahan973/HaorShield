HaorShield FR-17 — CONSOLIDATED LOCATION / FLOOD MAP / CROPLAND PATCH

This is ONE ZIP containing ALL FR-17 replacement/new files. No extra ZIP needed.

Copy from this package into your existing repository, preserving folders:
  frontend/src/FloodRiskChecker.jsx            REPLACE
  frontend/src/LandAttentionMap.jsx             REPLACE
  frontend/src/upazilaForecastLocation.js      ADD
  tests/fr17Location.test.mjs                   ADD

Keep existing districtLocator.js, areaChoices.js, landAttention.js and all other files.

What changes:
- Choosing an upazila requests a point for that named locality (first Open-Meteo geocoding,
  then Nominatim). The returned point must be inside the chosen supported district.
  If neither service can verify a valid location, the website displays an error.
  It never silently substitutes the district centre for a selected upazila.
- Rainfall, current weather, and flood-concern inputs use that selected point.
  River model evidence can cover a larger basin and is not upazila-specific.
- The research map shows complete screening cells whose coordinate-center is
  within 20 km of the verified upazila point. This is an APPROXIMATE VICINITY,
  not the upazila polygon or a flood inundation prediction.
- Nearby research-cell land / cropland screening figures come from those same cells.
  They are NOT actual predicted flooded areas or upazila-wide crop losses.
- For District overview the original district map and area totals are preserved.
- GPS remains click-to-use and optional; no historical data added to the interface.

Run from HaorShield-main ROOT folder, not frontend:
  node --test
  cd frontend
  npm.cmd run build

Only commit after both succeed. Cloudflare then deploys from GitHub.

Validation locally: FR-17's 7 behavior assertions passed. Full current
repository suite and Vite production build must be run on the user's machine.

Known scientific/data limits:
- These geocoders may fail to resolve some named upazilas. In that case the
  interface explicitly reports no verified local point; try District overview.
- Accurate upazila boundaries and independent flood observations are not
  currently integrated, so true upazila-wide flood and cropland predictions
  cannot be claimed.
