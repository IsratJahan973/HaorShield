
from pathlib import Path
from datetime import datetime, timedelta, timezone
import json, os, time, math

import requests
import numpy as np
import pandas as pd
import geopandas as gpd

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
DATA = ROOT / "frontend/public/data"

CLIMATE = SCRIPTS / "glofas_monthly_climatology.json"
ENVELOPE = SCRIPTS / "historical_flood_cell_envelope.csv"

GLOFAS_JSON = DATA / "haorshield_glofas_forecast.json"
SPATIAL_JSON = DATA / "haorshield_future_exposure_screening.geojson"
SUMMARY_JSON = DATA / "haorshield_future_exposure_summary.json"

STATIONS = [
    ("SW267", "Sunamganj", 25.0658, 91.3950),
    ("SW174", "Sylhet", 24.8949, 91.8687),
    ("KU01", "Sherpur (Sylhet)", 24.6833, 91.8667),
    ("KU02", "Amalshid", 24.8167, 92.2000),
    ("NM01", "Durgapur", 25.1500, 90.7333),
    ("ME02", "Bhairab Bazar", 24.0500, 90.9833)
]

HORIZONS = (24, 48, 72)
RAIN_MONITOR = {24: 25, 48: 40, 72: 60}
RAIN_ELEVATED = {24: 50, 48: 80, 72: 100}

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    os.replace(tmp, path)

def fetch(params):
    url = "https://flood-api.open-meteo.com/v1/flood"

    for attempt in range(4):
        try:
            r = requests.get(url, params=params, timeout=90)

            if r.status_code in (429, 500, 502, 503, 504):
                if attempt == 3:
                    r.raise_for_status()

                wait = [15, 35, 70][attempt]

                header = r.headers.get("Retry-After")
                if header:
                    try:
                        wait = max(wait, float(header))
                    except ValueError:
                        pass

                print(
                    f"GloFAS API HTTP {r.status_code}; "
                    f"waiting {wait:.0f}s",
                    flush=True
                )
                time.sleep(min(wait, 180))
                continue

            r.raise_for_status()
            return r.json()

        except (requests.ConnectionError, requests.Timeout):
            if attempt == 3:
                raise
            time.sleep([15, 35, 70][attempt])

    raise RuntimeError("GloFAS API unavailable")

def fetch_stations(extra):
    params = {
        "latitude": ",".join(
            str(s[2]) for s in STATIONS
        ),
        "longitude": ",".join(
            str(s[3]) for s in STATIONS
        ),
        "daily": "river_discharge",
        "timezone": "GMT",
        **extra
    }

    data = fetch(params)

    if isinstance(data, dict):
        data = [data]

    if not isinstance(data, list) or len(data) != len(STATIONS):
        raise RuntimeError(
            "Unexpected GloFAS multi-location response"
        )

    return data

def build_climatology():
    print("Fetching GloFAS historical discharge: 1984–2021")

    history = fetch_stations({
        "models": "consolidated_v4",
        "start_date": "1984-01-01",
        "end_date": "2021-12-31"
    })

    reference = {
        "source": "Copernicus GloFAS v4 via Open-Meteo",
        "kind": "historical_modeled_discharge_climatology",
        "historical_period": "1984-2021",
        "not_observed_station_data": True,
        "not_official_danger_levels": True,
        "stations": {}
    }

    for station, response in zip(STATIONS, history):
        sid, name, lat, lon = station

        dates = pd.to_datetime(
            response["daily"]["time"]
        )

        values = pd.to_numeric(
            pd.Series(
                response["daily"]["river_discharge"]
            ),
            errors="coerce"
        )

        assert len(dates) == len(values)

        record = {
            "name": name,
            "requested_lat": lat,
            "requested_lon": lon,
            "model_lat": float(response["latitude"]),
            "model_lon": float(response["longitude"]),
            "monthly": {}
        }

        for month in range(1, 13):
            sample = values[
                (dates.month == month) &
                values.notna() &
                (values >= 0)
            ]

            if len(sample) < 300:
                raise RuntimeError(
                    f"Insufficient historical GloFAS "
                    f"data: {name}, month {month}"
                )

            record["monthly"][str(month)] = {
                "p50": float(sample.quantile(0.50)),
                "p90": float(sample.quantile(0.90)),
                "p95": float(sample.quantile(0.95)),
                "p99": float(sample.quantile(0.99)),
                "sample_days": int(len(sample))
            }

        reference["stations"][sid] = record

    save_json(CLIMATE, reference)
    return reference

if CLIMATE.exists():
    climate = json.loads(
        CLIMATE.read_text(encoding="utf-8")
    )
    print("Using saved historical GloFAS climatology")
else:
    climate = build_climatology()

assert len(climate["stations"]) == 6

# ------------------------------------------------------------
# 3. Fetch actual future river discharge.
# Forecast days = upcoming complete UTC model days.
# ------------------------------------------------------------

now = datetime.now(timezone.utc)
first_day = now.date() + timedelta(days=1)

forecast = fetch_stations({
    "models": "forecast_v4",
    "forecast_days": 6
})

hydro = []

def historical_band(flow, q):
    # These are model-discharge anomalies, NOT flood probabilities.
    if q["p99"] > 0 and flow >= q["p99"]:
        return 3
    if q["p95"] > 0 and flow >= q["p95"]:
        return 2
    if q["p90"] > 0 and flow >= q["p90"]:
        return 1
    return 0

BAND_NAMES = [
    "Below historical high-flow threshold",
    "High modeled river flow (P90+)",
    "Very high modeled river flow (P95+)",
    "Exceptional modeled river flow (P99+)"
]

for station, response in zip(STATIONS, forecast):
    sid, name, lat, lon = station

    daily = response["daily"]
    values = dict(zip(
        daily["time"],
        daily["river_discharge"]
    ))

    row = {
        "station_id": sid,
        "station": name,
        "requested_latitude": lat,
        "requested_longitude": lon,
        "model_latitude": float(response["latitude"]),
        "model_longitude": float(response["longitude"])
    }

    bands = []

    for days, hours in enumerate(HORIZONS, start=1):
        forecast_days = [
            first_day + timedelta(days=d)
            for d in range(days)
        ]

        entries = []

        for date in forecast_days:
            key = date.isoformat()
            flow = values.get(key)

            if flow is None:
                raise RuntimeError(
                    f"Missing GloFAS forecast: {name} {key}"
                )

            flow = float(flow)

            if not math.isfinite(flow) or flow < 0:
                raise RuntimeError(
                    f"Invalid discharge: {name} {key}"
                )

            q = climate["stations"][sid]["monthly"][
                str(date.month)
            ]

            entries.append({
                "date_utc": key,
                "discharge_m3_s": round(flow, 3),
                "flow_band": historical_band(flow, q),
                "historical_p95_m3_s": round(q["p95"], 3),
                "historical_p99_m3_s": round(q["p99"], 3)
            })

        band = max(x["flow_band"] for x in entries)

        row[f"flow_band_{hours}"] = band
        row[f"flow_label_{hours}"] = BAND_NAMES[band]
        row[f"peak_discharge_{hours}_m3_s"] = max(
            x["discharge_m3_s"] for x in entries
        )
        row[f"daily_forecasts_{hours}"] = entries

        bands.append(band)

    hydro.append(row)

assert len(hydro) == 6

# ------------------------------------------------------------
# 4. Load geographic grid, historical flood evidence
# and current rainfall. Match using cell_id + geometry.
# ------------------------------------------------------------

crop = gpd.read_file(
    DATA / "haorshield_cropland_cells.geojson"
)

screen = gpd.read_file(
    DATA / "haorshield_flood_screening.geojson"
)

assert len(crop) == len(screen) == 306
assert crop.cell_id.is_unique
assert screen.cell_id.is_unique

crop["cell_id"] = crop.cell_id.astype(int)
screen["cell_id"] = screen.cell_id.astype(int)

crop = crop.sort_values("cell_id").reset_index(drop=True)

screen = (
    screen.set_index("cell_id")
    .loc[crop.cell_id]
    .reset_index()
)

ca = crop.to_crs("EPSG:6933")
sa = screen.to_crs("EPSG:6933")

overlap = ca.geometry.intersection(sa.geometry).area
ratio = overlap / ca.geometry.area

if not (ratio >= 0.99).all():
    raise RuntimeError(
        "Cropland and rainfall geographic cells "
        "do not align sufficiently"
    )

prior = pd.read_csv(ENVELOPE)
prior["cell_id"] = prior["cell_id"].astype(int)

crop = crop.merge(
    prior,
    on="cell_id",
    how="left",
    validate="one_to_one"
)

assert crop.historical_peak_event_fraction.notna().all()

# ------------------------------------------------------------
# 5. Check rainfall freshness.
# Never mix stale rainfall with current river forecasts.
# ------------------------------------------------------------

rain_fresh = False
rain_issued = None

rain_meta = DATA / "haorshield_flood_screening_summary.json"

if rain_meta.exists():
    info = json.loads(
        rain_meta.read_text(encoding="utf-8")
    )

    rain_issued = info.get("generated_at")

    if rain_issued:
        stamp = pd.to_datetime(
            rain_issued, utc=True, errors="coerce"
        )

        if pd.notna(stamp):
            age_hours = (
                pd.Timestamp.now(tz="UTC") - stamp
            ).total_seconds() / 3600

            rain_fresh = 0 <= age_hours <= 12

print("Rainfall feed fresh:", rain_fresh)

# ------------------------------------------------------------
# 6. Match cells to nearby reference model points.
# This is a geographical proxy, NOT river-network routing.
# ------------------------------------------------------------

centroids = (
    ca.geometry.centroid
    .to_crs("EPSG:4326")
)

lat = np.radians(centroids.y.to_numpy())[:, None]
lon = np.radians(centroids.x.to_numpy())[:, None]

station_lat = np.radians(
    np.array([s[2] for s in STATIONS])
)[None, :]

station_lon = np.radians(
    np.array([s[3] for s in STATIONS])
)[None, :]

a = (
    np.sin((lat - station_lat) / 2) ** 2 +
    np.cos(lat) * np.cos(station_lat) *
    np.sin((lon - station_lon) / 2) ** 2
)

distance_km = (
    6371.0088 *
    2 *
    np.arcsin(
        np.sqrt(np.clip(a, 0, 1))
    )
)

nearest = np.argmin(distance_km, axis=1)
nearest_distance = np.min(distance_km, axis=1)

# Beyond 120 km, river-discharge proxy is not assigned.
covered = nearest_distance <= 120

crop["reference_station"] = [
    STATIONS[i][1] if valid else "Not covered"
    for i, valid in zip(nearest, covered)
]

crop["reference_distance_km"] = np.round(
    nearest_distance, 2
)

crop["historical_peak_event_fraction"] = (
    crop["historical_peak_event_fraction"].clip(0, 1)
)

crop["cell_area_ha"] = (
    ca.geometry.area.to_numpy() / 10000
)

for h in HORIZONS:
    flow = np.array([
        hydro[i][f"flow_band_{h}"]
        for i in nearest
    ])

    flow[~covered] = 0

    rain_col = f"rain{h}_mm"

    rain = pd.to_numeric(
        screen[rain_col],
        errors="coerce"
    ).to_numpy()

    # Stale rainfall contributes nothing.
    if not rain_fresh:
        rain = np.full(len(crop), np.nan)

    rain_valid = np.isfinite(rain) & (rain >= 0)

    rain_band = np.zeros(len(crop), dtype=int)

    rain_band[
        rain_valid & (rain >= RAIN_MONITOR[h])
    ] = 1

    rain_band[
        rain_valid & (rain >= RAIN_ELEVATED[h])
    ] = 2

    # Both are screening indicators, not probabilities.
    signal = np.maximum(flow, rain_band)

    historical = (
        crop.historical_peak_event_fraction.to_numpy() > 0.01
    )

    # Do not suppress forecast signals in cells without flood records from just three historical events.

    labels = [
        "No elevated screening signal",
        "Monitor historical flood-exposure zone",
        "Elevated exposure screening",
        "Very elevated exposure screening"
    ]

    crop[f"screening{h}"] = [
        labels[x] for x in signal
    ]

    crop[f"screening_code{h}"] = signal

    crop[f"model_flow_band{h}"] = flow

    crop[f"forecast_rain{h}_mm"] = (
        np.round(rain, 2)
    )

    elevated = signal >= 2

    # Historical event-maximum footprint area within
    # currently screened cells. NOT predicted inundation.
    crop[f"screened_historical_land_ha_{h}"] = (
        np.where(
            elevated,
            crop["cell_area_ha"].to_numpy() *
            crop["historical_peak_event_fraction"].to_numpy(),
            0
        )
    )

    # All mapped cropland inside flagged cells.
    # NOT an exact cropland/flood polygon intersection.
    crop[f"screened_cropland_ha_{h}"] = (
        np.where(
            elevated,
            crop["cropland_ha"].to_numpy(),
            0
        )
    )

# ------------------------------------------------------------
# 7. Publish model outputs, audit and screening summaries.
# ------------------------------------------------------------

issued = now.isoformat()

glofas_output = {
    "retrieved_at": issued,
    "source": "Copernicus GloFAS v4 via Open-Meteo",
    "hydrology_model": "forecast_v4",
    "historical_reference": "1984-2021 consolidated_v4",
    "forecast_start_utc": first_day.isoformat(),
    "horizons": [24, 48, 72],
    "horizon_definition": (
        "Next 1, 2 or 3 complete UTC model days beginning "
        "on forecast_start_utc; not rolling hourly predictions."
    ),
    "status": "EXPERIMENTAL_HYDROLOGICAL_SCREENING",
    "not_official_bwdb_water_levels": True,
    "not_flood_probability": True,
    "not_inundation_prediction": True,
    "warning": (
        "GloFAS is modeled river discharge, not local measured "
        "water level or an official danger-level forecast. "
        "Model grid points have not been verified against "
        "local river routing or gauge observations."
    ),
    "stations": hydro
}

summary = {
    "generated_at": issued,
    "data_type": "forecast_conditioned_historical_exposure_screening",
    "forecast_start_utc": first_day.isoformat(),
    "river_forecast_source": "Copernicus GloFAS v4",
    "rainfall_forecast_fresh": bool(rain_fresh),
    "rainfall_data_issued_at": rain_issued,
    "historic_flood_events": [4382, 4459, 4508],
    "cell_count": int(len(crop)),
    "is_validated_flood_prediction": False,
    "is_future_inundation_prediction": False,
    "predicted_flooded_cropland_ha": None,
    "predicted_flooded_land_ha": None,
    "geographic_assignment": (
        "Nearest one of six GloFAS reference locations "
        "within 120 km; not hydrological catchment routing"
    ),
    "rainfall_thresholds_mm": {
        str(h): {
            "monitor": RAIN_MONITOR[h],
            "elevated": RAIN_ELEVATED[h]
        }
        for h in HORIZONS
    },
    "warning": (
        "Screened land represents historical event-maximum "
        "flood footprints in cells with elevated future "
        "river-discharge/rainfall signals. Screened cropland "
        "is total mapped cropland inside those cells. "
        "Neither quantity is predicted flooded hectares."
    ),
    "horizons": {}
}

for h in HORIZONS:
    elevated = crop[f"screening_code{h}"] >= 2
    monitor = crop[f"screening_code{h}"] >= 1

    districts = {}

    for district, group in crop[elevated].groupby("district"):
        districts[str(district)] = {
            "cells": int(len(group)),
            "screened_cropland_ha": round(
                float(group.cropland_ha.sum()), 2
            )
        }

    summary["horizons"][str(h)] = {
        "monitor_cells": int(monitor.sum()),
        "elevated_cells": int(elevated.sum()),
        "screened_historical_land_ha": round(
            float(
                crop[f"screened_historical_land_ha_{h}"].sum()
            ), 2
        ),
        "screened_cropland_ha": round(
            float(
                crop[f"screened_cropland_ha_{h}"].sum()
            ), 2
        ),
        "districts": districts
    }

# Remove auxiliary columns if not appropriate for public map.
crop = crop.to_crs("EPSG:4326")

save_json(GLOFAS_JSON, glofas_output)
save_json(SUMMARY_JSON, summary)

tmp = SPATIAL_JSON.with_name(
    SPATIAL_JSON.name + ".tmp"
)

tmp.write_text(
    crop.to_json(na="null"),
    encoding="utf-8"
)

os.replace(tmp, SPATIAL_JSON)

print("\nGLOFAS FUTURE RIVER SIGNALS")

for station in hydro:
    print(
        station["station"],
        "| flow bands 24/48/72:",
        *[
            station[f"flow_band_{h}"]
            for h in HORIZONS
        ]
    )

print("\nFUTURE GEOGRAPHIC EXPOSURE SCREENING")

for h in HORIZONS:
    result = summary["horizons"][str(h)]

    print(
        f"{h}h:",
        result["elevated_cells"],
        "elevated cells;",
        f"{result['screened_cropland_ha']:,.1f}",
        "ha cropland inside screened cells"
    )

print("\nAll 306 geographic cells processed")
print("River data: MODELED, NOT OBSERVED")
print("Inundation forecast: NOT CLAIMED")
print("Cropland flooding prediction: NOT CLAIMED")
