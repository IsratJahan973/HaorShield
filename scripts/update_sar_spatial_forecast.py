
from pathlib import Path
from datetime import datetime, timedelta, timezone
import json, time, os, math

import pandas as pd
import numpy as np
import geopandas as gpd
import joblib
import requests

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
ML = ROOT / "ml"
DATA = ROOT / "frontend/public/data"

STATIC = SCRIPTS / "sar_spatial_terrain_306.csv"
CLIMATE = SCRIPTS / "glofas_monthly_climatology.json"

GEO_OUT = DATA / "haorshield_sar_future_candidates.geojson"
SUMMARY_OUT = DATA / "haorshield_sar_future_summary.json"

HORIZONS = (24, 48, 72)
TODAY = datetime.now(timezone.utc).date()
NOW = datetime.now(timezone.utc)

# ------------------------------------------------------------
# HTTP client with limited retries.
# ------------------------------------------------------------

def request_json(url, params):
    delays = (20, 60, 120)

    for attempt in range(4):
        try:
            response = requests.get(
                url, params=params, timeout=100
            )

            if response.status_code in (
                429, 500, 502, 503, 504
            ):
                if attempt == 3:
                    response.raise_for_status()

                wait = delays[attempt]

                header = response.headers.get("Retry-After")
                if header:
                    try:
                        wait = max(wait, float(header))
                    except ValueError:
                        pass

                wait = min(wait, 180)

                print(
                    f"HTTP {response.status_code}; "
                    f"waiting {wait:.0f}s",
                    flush=True
                )
                time.sleep(wait)
                continue

            response.raise_for_status()
            return response.json()

        except (requests.Timeout, requests.ConnectionError):
            if attempt == 3:
                raise
            time.sleep(delays[attempt])

    raise RuntimeError("API requests exhausted")

# ------------------------------------------------------------
# Load geographic reference.
# ------------------------------------------------------------

static = pd.read_csv(STATIC).sort_values("cell_id")
assert len(static) == 306
assert static.cell_id.is_unique

grid = gpd.read_file(
    DATA / "haorshield_cropland_cells.geojson"
)

# Cell IDs must be NUMERIC before sorting.
# Otherwise "10" comes before "2".
grid["cell_id"] = pd.to_numeric(
    grid["cell_id"], errors="raise"
).astype(int)

assert grid["cell_id"].is_unique
assert set(grid["cell_id"]) == set(range(306))

grid = grid.sort_values(
    "cell_id"
).reset_index(drop=True)

assert len(grid) == 306
assert np.array_equal(
    static.cell_id.to_numpy(),
    grid.cell_id.astype(int).to_numpy()
)

# ------------------------------------------------------------
# 4. Collect historical and upcoming daily rainfall.
#
# Date convention:
# - Model issue anchor: 00:00 UTC today.
# - Antecedent 7/30 days: complete days before today.
# - Future horizons: today's UTC day plus 1 or 2 more.
# - SAR target dates: today + 1/2/3 days.
#
# These are calendar-day research horizons, NOT rolling
# predictions beginning at the current minute.
# ------------------------------------------------------------

rain_features = {}

def day_values(response):
    daily = response["daily"]

    dates = daily["time"]
    values = daily["precipitation_sum"]

    assert len(dates) == len(values)

    result = {}

    for day, raw in zip(dates, values):
        if raw is None:
            continue

        value = float(raw)

        if not math.isfinite(value) or value < 0:
            continue

        result[day] = value

    return result

def date_sum(values, start, days):
    dates = [
        (start + timedelta(days=i)).isoformat()
        for i in range(days)
    ]

    if any(day not in values for day in dates):
        return np.nan

    return sum(values[day] for day in dates)

weather_url = "https://api.open-meteo.com/v1/forecast"

# Multiple locations per call, rather than 306 separate calls.
BATCH = 35

for start_index in range(0, len(static), BATCH):

    block = static.iloc[start_index:start_index + BATCH]

    params = {
        "latitude": ",".join(
            f"{v:.5f}" for v in block.latitude
        ),
        "longitude": ",".join(
            f"{v:.5f}" for v in block.longitude
        ),
        "daily": "precipitation_sum",
        "models": "ecmwf_ifs",
        "past_days": 32,
        "forecast_days": 5,
        "timezone": "GMT"
    }

    response = request_json(weather_url, params)

    if isinstance(response, dict):
        response = [response]

    assert len(response) == len(block), (
        "Unexpected weather batch response count"
    )

    for (_, row), packet in zip(
        block.iterrows(), response
    ):
        values = day_values(packet)

        cid = int(row.cell_id)

        features = {
            "past7_mm": date_sum(
                values, TODAY - timedelta(days=7), 7
            ),
            "past30_mm": date_sum(
                values, TODAY - timedelta(days=30), 30
            ),
        }

        for h in HORIZONS:
            features[f"future_rain_{h}h_mm"] = date_sum(
                values, TODAY, h // 24
            )

        rain_features[cid] = features

    print(
        "Rainfall cells processed:",
        min(start_index + BATCH, len(static)),
        "/306",
        flush=True
    )

    time.sleep(2)

assert len(rain_features) == 306

rain = pd.DataFrame.from_dict(
    rain_features, orient="index"
)

rain.index.name = "cell_id"
rain = rain.reset_index()

data = static.merge(
    rain, on="cell_id",
    validate="one_to_one"
)

rain_cols = [
    "past7_mm", "past30_mm",
    "future_rain_24h_mm",
    "future_rain_48h_mm",
    "future_rain_72h_mm"
]

# An incomplete rainfall feed must not produce a prediction.
assert data[rain_cols].notna().all().all(), (
    "Incomplete rainfall observations/forecasts"
)

# ------------------------------------------------------------
# 5. Obtain the PREVIOUS day's GloFAS discharge.
# Match the historical model's issue-time feature.
# ------------------------------------------------------------

climate = json.loads(CLIMATE.read_text())
sites = climate["stations"]
site_ids = list(sites)

hydro = request_json(
    "https://flood-api.open-meteo.com/v1/flood",
    {
        "latitude": ",".join(
            str(sites[sid]["requested_lat"])
            for sid in site_ids
        ),
        "longitude": ",".join(
            str(sites[sid]["requested_lon"])
            for sid in site_ids
        ),
        "daily": "river_discharge",
        "models": "seamless_v4",
        "past_days": 5,
        "forecast_days": 5,
        "timezone": "GMT"
    }
)

if isinstance(hydro, dict):
    hydro = [hydro]

assert len(hydro) == len(site_ids)

yesterday = (
    TODAY - timedelta(days=1)
).isoformat()

flow_ratio = {}

for sid, response in zip(site_ids, hydro):

    readings = dict(zip(
        response["daily"]["time"],
        response["daily"]["river_discharge"]
    ))

    value = readings.get(yesterday)

    q95 = sites[sid]["monthly"][
        str((TODAY - timedelta(days=1)).month)
    ]["p95"]

    if (
        value is None
        or q95 is None
        or float(q95) <= 0
    ):
        raise RuntimeError(
            f"Previous-day GloFAS data missing: {sid}"
        )

    flow_ratio[sid] = float(value) / float(q95)

# Nearest-reference-point proxy.
# This does NOT establish river-network connectivity.
lat = np.radians(
    data.latitude.to_numpy()
)[:, None]

lon = np.radians(
    data.longitude.to_numpy()
)[:, None]

site_lat = np.radians([
    sites[s]["requested_lat"] for s in site_ids
])[None, :]

site_lon = np.radians([
    sites[s]["requested_lon"] for s in site_ids
])[None, :]

a = (
    np.sin((lat - site_lat) / 2) ** 2
    + np.cos(lat) * np.cos(site_lat)
    * np.sin((lon - site_lon) / 2) ** 2
)

distance = (
    6371.0088 * 2
    * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
)

nearest = distance.argmin(axis=1)
distance_min = distance.min(axis=1)

data["river_reference_id"] = [
    site_ids[i] for i in nearest
]

data["river_reference_distance_km"] = distance_min

data["past_flow_issue_ratio"] = [
    flow_ratio[site_ids[i]]
    if distance_min[j] <= 120
    else np.nan
    for j, i in enumerate(nearest)
]

# ------------------------------------------------------------
# 6. Run the validated-as-RESEARCH models.
# Every feature must have exactly the same meaning and
# ordering used in Cell 103.
# ------------------------------------------------------------

results = {}

for h in HORIZONS:

    # Training month corresponds to the SAR target date,
    # not the earlier forecast issue date.
    month = (
        TODAY + timedelta(days=h // 24)
    ).month

    bundle = joblib.load(
        SCRIPTS / f"sar_corrected_{h}h_antecedent_flow_research.joblib"
    )

    assert (
        bundle["decision"]["passes_research_gate"]
        is True
    )

    assert bundle["operationally_validated"] is False

    X = pd.DataFrame({
        "future_rain_mm": data[f"future_rain_{h}h_mm"],
        "elevation_m": data["elevation_m"],
        "slope_deg": data["slope_deg"],
        "latitude": data["latitude"],
        "longitude": data["longitude"],
        "month_sin": np.sin(
            2 * np.pi * (month - 1) / 12
        ),
        "month_cos": np.cos(
            2 * np.pi * (month - 1) / 12
        ),
        "past7_mm": data["past7_mm"],
        "past30_mm": data["past30_mm"],
        "past_flow_issue_ratio": data[
            "past_flow_issue_ratio"
        ]
    })

    assert X.columns.tolist() == (
        bundle["feature_columns"]
    ), f"{h}h training/inference feature mismatch"

    assert np.isfinite(
        X.drop(columns=[
            "elevation_m",
            "slope_deg",
            "past_flow_issue_ratio"
        ]).to_numpy()
    ).all()

    prediction = np.clip(
        bundle["model"].predict(X),
        0, 1
    )

    assert np.isfinite(prediction).all()

    name = f"sar_candidate_fraction_{h}h"
    data[name] = np.round(prediction, 6)

    # Hypothetical area proxy. This assumes modeled
    # candidate fractions apply uniformly within each
    # cell and to cropland. NOT inundation prediction.
    data[f"research_land_proxy_ha_{h}h"] = (
        prediction * data.cell_area_ha
    )

    data[f"research_cropland_proxy_ha_{h}h"] = (
        prediction * data.cropland_ha
    )

    results[str(h)] = {
        "target_satellite_date_utc": str(
            TODAY + timedelta(days=h // 24)
        ),
        "research_land_proxy_ha": round(
            float(
                data[f"research_land_proxy_ha_{h}h"].sum()
            ), 2
        ),
        "research_cropland_proxy_ha": round(
            float(
                data[
                    f"research_cropland_proxy_ha_{h}h"
                ].sum()
            ), 2
        ),
        "cells": 306,
        "model_variant": "antecedent_flow",
        "model_output": (
            "experimental_SAR_candidate_fraction"
        )
    }

# ------------------------------------------------------------
# 7. Save atomic JSON and GeoJSON outputs.
# ------------------------------------------------------------

issued = NOW.isoformat()

summary = {
    "generated_at": issued,
    "issue_anchor_date_utc": TODAY.isoformat(),
    "horizons_hours": list(HORIZONS),
    "cells": 306,
    "source": (
        "Sentinel-1 SAR research models; Open-Meteo ECMWF "
        "rainfall and Copernicus GloFAS discharge"
    ),
    "status": "EXPERIMENTAL_NOT_VALIDATED",
    "is_validated_flood_probability": False,
    "is_validated_inundation_prediction": False,
    "predicted_flooded_land_ha": None,
    "predicted_flooded_cropland_ha": None,
    "time_window_warning": (
        "Calendar-day experiments anchored at 00:00 UTC, "
        "not rolling forecasts from the current minute."
    ),
    "input_shift_warning": (
        "Training used historical CHIRPS observed rainfall. "
        "Live inference uses Open-Meteo ECMWF rainfall "
        "and modeled GloFAS discharge. "
        "Input-domain and forecast errors are not calibrated."
    ),
    "spatial_warning": (
        "Nearby GloFAS points are geographic proxies, "
        "not proven hydrological catchments."
    ),
    "area_warning": (
        "Research land and cropland hectare proxies assume "
        "SAR-candidate fractions apply uniformly to "
        "geographic cells and cropland. "
        "They are NOT estimated actual flooded hectares."
    ),
    "horizons": results
}

output = grid[["cell_id", "district", "geometry"]].merge(
    data.drop(columns=["district"]),
    on="cell_id",
    validate="one_to_one"
)

geo_temp = GEO_OUT.with_suffix(".geojson.tmp")
json_temp = SUMMARY_OUT.with_suffix(".json.tmp")

geo_temp.write_text(
    output.to_json(na="null"),
    encoding="utf-8"
)

json_temp.write_text(
    json.dumps(summary, indent=2),
    encoding="utf-8"
)

assert len(json.loads(
    geo_temp.read_text()
)["features"]) == 306

os.replace(geo_temp, GEO_OUT)
os.replace(json_temp, SUMMARY_OUT)

print("\nSPATIAL SAR RESEARCH FORECAST")
print("Issue anchor:", TODAY)
print("Cells:", len(data))

for h in HORIZONS:
    row = results[str(h)]
    print(
        h, "hours",
        "| research land proxy:",
        row["research_land_proxy_ha"], "ha",
        "| research cropland proxy:",
        row["research_cropland_proxy_ha"], "ha"
    )

print("\nNOT VALIDATED INUNDATION OR FLOOD PROBABILITIES")
