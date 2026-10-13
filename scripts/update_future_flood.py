
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor
import json, os, requests, joblib
import numpy as np
import pandas as pd

from forecast_station_reference import (
    upstream_points, STATIC_TERRAIN
)

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
OUT = ROOT / "frontend/public/data/haorshield_experimental_flood_forecasts.json"

STATIONS = {
    "SW267": ("Sunamganj", 25.0658, 91.3950),
    "SW174": ("Sylhet", 24.8949, 91.8687),
    "KU01": ("Sherpur (Sylhet)", 24.6833, 91.8667),
    "KU02": ("Amalshid", 24.8167, 92.2000),
    "NM01": ("Durgapur (Netrakona)", 25.1500, 90.7333),
    "ME02": ("Bhairab Bazar", 24.0500, 90.9833),
}

MODELS = joblib.load(
    SCRIPTS / "experimental_multi_horizon_rf.joblib"
)

now = datetime.now(ZoneInfo("Asia/Dhaka"))
today = now.date()
upstream_grid = upstream_points("meghna", n=3)
assert len(upstream_grid) == 9

def fetch_rain(point):
    lat, lon = point
    response = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lat,
            "longitude": lon,
            "daily": "precipitation_sum",
            "past_days": 5,
            "forecast_days": 4,
            "timezone": "Asia/Dhaka"
        },
        timeout=50
    )
    response.raise_for_status()
    daily = response.json()["daily"]

    values = pd.Series(
        daily["precipitation_sum"],
        index=pd.to_datetime(daily["time"]).date,
        dtype=float
    )
    return values

locations = (
    [(v[1], v[2]) for v in STATIONS.values()]
    + upstream_grid
)

with ThreadPoolExecutor(max_workers=6) as pool:
    weather = list(pool.map(fetch_rain, locations))

upstream = pd.concat(
    weather[len(STATIONS):], axis=1
).mean(axis=1)

def logit(probability):
    p = np.clip(
        np.asarray(probability, dtype=float),
        1e-6, 1 - 1e-6
    )
    return np.log(p / (1-p)).reshape(-1, 1)

records = []

for idx, (sid, (name, lat, lon)) in enumerate(
    STATIONS.items()
):
    local = weather[idx]
    inputs = {}

    for lag in (1, 2, 3):
        date = today - timedelta(days=lag)

        a = float(local.loc[date])
        b = float(upstream.loc[date])

        if not np.isfinite(a) or not np.isfinite(b):
            raise ValueError(f"Missing rainfall: {sid} {date}")

        inputs[f"rainfall_local_mm_lag{lag}d"] = a
        inputs[f"rainfall_upstream_mm_lag{lag}d"] = b

    elevation, hand = STATIC_TERRAIN[sid]
    inputs["elevation_m"] = float(elevation)
    inputs["hand_m"] = float(hand)

    row = {
        "station_id": sid,
        "station": name,
        "latitude": lat,
        "longitude": lon,
    }

    for hours in (24, 48, 72):
        bundle = MODELS[hours]
        X = pd.DataFrame(
            [inputs], columns=bundle["features"]
        )

        p_raw = bundle["model"].predict_proba(X)[:, 1]
        p_cal = bundle["calibrator"].predict_proba(
            logit(p_raw)
        )[0, 1]

        row[f"experimental_{hours}h_score_pct"] = round(
            float(p_cal) * 100, 2
        )

    records.append(row)

assert len(records) == 6

# Do not publish incomplete or non-finite results.
for row in records:
    for hours in (24, 48, 72):
        value = row[f"experimental_{hours}h_score_pct"]
        assert np.isfinite(value) and 0 <= value <= 100

payload = {
    "issued_at": now.isoformat(),
    "coverage": "Six northeast-region river stations",
    "forecast_horizons_hours": [24, 48, 72],
    "status": "EXPERIMENTAL_NOT_VALIDATED",
    "warning": (
        "Experimental future flood-label model scores. "
        "NOT validated flood probabilities, inundation "
        "forecasts, or official safety warnings."
    ),
    "future_rainfall_used_as_predictor": False,
    "predictor_note": (
        "Lagged rainfall and static terrain inputs; "
        "upstream grid is an approximate catchment proxy."
    ),
    "scores": records
}

OUT.parent.mkdir(parents=True, exist_ok=True)
temporary = OUT.with_suffix(".json.tmp")
temporary.write_text(
    json.dumps(payload, indent=2),
    encoding="utf-8"
)
os.replace(temporary, OUT)

print("ISSUED:", now.isoformat())
print(pd.DataFrame(records)[[
    "station",
    "experimental_24h_score_pct",
    "experimental_48h_score_pct",
    "experimental_72h_score_pct"
]].to_string(index=False))
print("JSON:", OUT)
print("UPDATED SUCCESSFULLY")
