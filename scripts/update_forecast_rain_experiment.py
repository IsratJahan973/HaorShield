
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor
import json, os

import joblib
import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "scripts/experimental_future_rain_models.joblib"
OUT = ROOT / "frontend/public/data/haorshield_future_rain_experimental.json"
TZ = ZoneInfo("Asia/Dhaka")

STATIONS = {'SW267': ('Sunamganj', 25.0658, 91.395), 'SW174': ('Sylhet', 24.8949, 91.8687), 'KU01': ('Sherpur (Sylhet)', 24.6833, 91.8667), 'KU02': ('Amalshid', 24.8167, 92.2), 'NM01': ('Durgapur', 25.15, 90.7333), 'ME02': ('Bhairab Bazar', 24.05, 90.9833)}
TERRAIN = {'SW267': {'elevation_m': 12.6, 'hand_m': 4.0}, 'SW174': {'elevation_m': 19.3, 'hand_m': 2.4}, 'KU01': {'elevation_m': 9.8, 'hand_m': 1.4}, 'KU02': {'elevation_m': 12.8, 'hand_m': 0.0}, 'NM01': {'elevation_m': 16.7, 'hand_m': 1.8}, 'ME02': {'elevation_m': 7.7, 'hand_m': 0.0}}

HORIZONS = (24, 48, 72)
MODELS = joblib.load(MODEL)
NOW = datetime.now(TZ)
TODAY = NOW.date()
START = TODAY + timedelta(days=1)


# Respect temporary API limits; never fabricate missing rainfall.
def resilient_get(url, params, timeout=65):
    import time
    from email.utils import parsedate_to_datetime
    from datetime import datetime, timezone

    waits = [30, 90, 150]

    for attempt in range(len(waits) + 1):
        try:
            response = requests.get(
                url,
                params=params,
                timeout=timeout
            )

            if response.status_code == 429:
                if attempt == len(waits):
                    response.raise_for_status()

                delay = waits[attempt]
                retry_after = response.headers.get("Retry-After")

                if retry_after:
                    try:
                        delay = max(
                            delay, float(retry_after)
                        )
                    except ValueError:
                        try:
                            until = parsedate_to_datetime(
                                retry_after
                            )
                            if until.tzinfo is None:
                                until = until.replace(
                                    tzinfo=timezone.utc
                                )
                            delay = max(
                                delay,
                                (until - datetime.now(
                                    timezone.utc
                                )).total_seconds()
                            )
                        except Exception:
                            pass

                delay = min(max(delay, 1), 180)
                print(
                    f"Open-Meteo rate limited; "
                    f"retrying in {delay:.0f}s "
                    f"(attempt {attempt + 1}/3)",
                    flush=True
                )
                time.sleep(delay)
                continue

            # Retry temporary server errors, not all 4xx errors.
            if response.status_code in (
                500, 502, 503, 504
            ) and attempt < len(waits):
                delay = waits[attempt]
                print(
                    f"Open-Meteo HTTP {response.status_code}; "
                    f"retrying in {delay}s",
                    flush=True
                )
                time.sleep(delay)
                continue

            response.raise_for_status()
            return response

        except (
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout
        ):
            if attempt == len(waits):
                raise

            delay = waits[attempt]
            print(
                f"Temporary connection problem; "
                f"retrying in {delay}s",
                flush=True
            )
            time.sleep(delay)

    raise RuntimeError("Open-Meteo retries exhausted")


def request_weather(lat, lon, params):
    response = resilient_get(
        "https://api.open-meteo.com/v1/forecast",
        params={"latitude": lat, "longitude": lon, **params},
        timeout=65
    )
    import time
    time.sleep(2)
    return response.json()

def process(item):
    sid, (name, lat, lon) = item

    recent = request_weather(lat, lon, {
        "daily": "precipitation_sum",
        "past_days": 5,
        "forecast_days": 2,
        "timezone": "Asia/Dhaka"
    })["daily"]

    daily = pd.Series(
        recent["precipitation_sum"],
        index=pd.to_datetime(recent["time"]).date,
        dtype=float
    )

    forecast = request_weather(lat, lon, {
        "models": "ecmwf_ifs",
        "hourly": "precipitation",
        "forecast_days": 6,
        "timezone": "Asia/Dhaka"
    })

    hourly = pd.DataFrame(forecast["hourly"])
    hourly["time"] = pd.to_datetime(hourly["time"])
    hourly["precipitation"] = pd.to_numeric(
        hourly["precipitation"], errors="coerce"
    )

    assert not hourly.time.duplicated().any()

    features = dict(TERRAIN[sid])

    for lag in (1, 2, 3):
        day = TODAY - timedelta(days=lag)
        value = float(daily.loc[day])

        if not np.isfinite(value) or value < 0:
            raise ValueError(f"{sid}: bad historical rainfall")

        features[f"rainfall_local_mm_lag{lag}d"] = value

    output = {
        "station_id": sid,
        "station": name,
        "latitude": lat,
        "longitude": lon
    }

    first = pd.Timestamp(START)

    for h in HORIZONS:
        window = hourly.loc[
            (hourly.time >= first) &
            (hourly.time < first + pd.Timedelta(hours=h)),
            "precipitation"
        ]

        if (
            len(window) != h or
            window.isna().any() or
            (window < 0).any()
        ):
            raise ValueError(
                f"{sid}: incomplete {h}h ECMWF forecast"
            )

        features[f"forecast_rain_{h}h_mm"] = float(
            window.sum()
        )

        info = MODELS[h]
        row = pd.DataFrame(
            [features], columns=info["features"]
        )

        score = float(
            info["model"].predict_proba(row)[0, 1]
        )

        if not np.isfinite(score) or not 0 <= score <= 1:
            raise ValueError(f"{sid}: invalid {h}h score")

        output[f"forecast_rain_{h}h_mm"] = round(
            features[f"forecast_rain_{h}h_mm"], 2
        )
        output[f"experimental_{h}h_score_pct"] = round(
            score * 100, 2
        )

    return output

with ThreadPoolExecutor(max_workers=1) as pool:
    records = list(pool.map(process, STATIONS.items()))

assert len(records) == 6

payload = {
    "issued_at": NOW.isoformat(),
    "target_window_start_local": str(START),
    "target_window_end_local": {
        str(h): str(START + timedelta(days=h // 24))
        for h in HORIZONS
    },
    "forecast_horizons_hours": list(HORIZONS),
    "status": "EXPERIMENTAL_NOT_VALIDATED",
    "weather_model": "ECMWF IFS via Open-Meteo",
    "future_rainfall_used_as_predictor": True,
    "training_period": "2024",
    "evaluation_period": "2025 (limited positive samples)",
    "warning": (
        "Research model scores based on unverified flood labels. "
        "Not calibrated real-world flood probabilities, official "
        "warnings or predicted inundation. "
        "Forecast windows begin tomorrow at 00:00 Asia/Dhaka."
    ),
    "scores": records
}

OUT.parent.mkdir(parents=True, exist_ok=True)
tmp = OUT.with_suffix(".json.tmp")
tmp.write_text(
    json.dumps(payload, ensure_ascii=False, indent=2),
    encoding="utf-8"
)
os.replace(tmp, OUT)

print("PASS — Updated six stations with forecast rainfall")
print("Issue:", payload["issued_at"])
print("Forecast begins:", payload["target_window_start_local"])

for r in records:
    print(
        r["station"],
        "| forecast rain 24/48/72:",
        *(r[f"forecast_rain_{h}h_mm"] for h in HORIZONS),
        "| model scores:",
        *(r[f"experimental_{h}h_score_pct"] for h in HORIZONS)
    )
