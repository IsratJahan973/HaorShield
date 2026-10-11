
import json
import time
import requests
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "frontend" / "public" / "data"

GEO_PATH = DATA / "haorshield_rainfall_risk.geojson"
SUMMARY_PATH = DATA / "haorshield_rainfall_summary.json"

TZ = ZoneInfo("Asia/Dhaka")

def classify(mm):
    if mm >= 100:
        return "Very Heavy Rainfall"
    if mm >= 50:
        return "Heavy Rainfall"
    if mm >= 20:
        return "Moderate Rainfall"
    return "Low Forecast Rainfall"

def main():
    with open(GEO_PATH, encoding="utf-8") as f:
        geo = json.load(f)

    features = geo["features"]
    assert len(features) > 0, "No geographic cells found"

    from shapely.geometry import shape
    from shapely.ops import transform
    from pyproj import Transformer

    to_area = Transformer.from_crs(
        "EPSG:4326", "EPSG:6933", always_xy=True
    ).transform

    from_area = Transformer.from_crs(
        "EPSG:6933", "EPSG:4326", always_xy=True
    ).transform

    coordinates = []

    for feature in features:
        polygon = shape(feature["geometry"])
        projected = transform(to_area, polygon)
        point = transform(
            from_area, projected.representative_point()
        )
        coordinates.append((point.y, point.x))

    now = datetime.now(TZ)
    batch_size = 20

    for start in range(0, len(features), batch_size):
        batch = features[start:start + batch_size]
        coords = coordinates[start:start + batch_size]

        for attempt in range(3):
            try:
                response = requests.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": ",".join(
                            str(lat) for lat, lon in coords
                        ),
                        "longitude": ",".join(
                            str(lon) for lat, lon in coords
                        ),
                        "hourly": "precipitation",
                        "forecast_days": 5,
                        "timezone": "Asia/Dhaka"
                    },
                    timeout=60
                )
                response.raise_for_status()
                forecasts = response.json()
                if isinstance(forecasts, dict):
                    forecasts = [forecasts]

                if len(forecasts) != len(batch):
                    raise ValueError("Forecast batch size mismatch")

                break

            except Exception:
                if attempt == 2:
                    raise
                time.sleep(5 * (attempt + 1))

        for feature, forecast in zip(batch, forecasts):
            times = forecast["hourly"]["time"]
            values = forecast["hourly"]["precipitation"]

            start_index = next(
                (
                    i for i, t in enumerate(times)
                    if datetime.fromisoformat(t).replace(
                        tzinfo=TZ
                    ) > now
                ),
                None
            )

            if start_index is None:
                raise ValueError("No future forecast hours")

            future = values[start_index:start_index + 72]

            if len(future) != 72 or any(
                value is None for value in future
            ):
                raise ValueError("Incomplete forecast data")

            p = feature["properties"]

            for hours in (24, 48, 72):
                total = round(sum(future[:hours]), 2)
                p[f"rain{hours}_mm"] = total
                p[f"alert{hours}"] = classify(total)

        print(
            f"Updated {min(start + batch_size, len(features))}"
            f"/{len(features)} cells"
        )
        time.sleep(0.4)

    summary = {
        "generated_at": now.isoformat(),
        "source": "Open-Meteo forecast API",
        "method": "10 km spatial rainfall-screening grid",
        "disclaimer": (
            "Rainfall screening only. Not a validated flood "
            "forecast, probability or inundation estimate."
        ),
        "total_cells": len(features),
        "successful_cells": len(features),
        "failed_cells": 0,
        "windows": {}
    }

    for hours in (24, 48, 72):
        overall = defaultdict(float)
        districts = defaultdict(lambda: defaultdict(float))

        for feature in features:
            p = feature["properties"]
            category = p[f"alert{hours}"]
            area = float(p["area_km2"])
            district = p["district"]

            overall[category] += area
            districts[district][category] += area

        summary["windows"][str(hours)] = {
            "total_area_by_category_km2": {
                k: round(v, 2)
                for k, v in overall.items()
            },
            "districts": {
                district: {
                    k: round(v, 2)
                    for k, v in categories.items()
                }
                for district, categories in districts.items()
            }
        }

    geo.setdefault("metadata", {})
    geo["metadata"]["generated_at"] = now.isoformat()
    geo["metadata"]["successful_cells"] = len(features)
    geo["metadata"]["total_cells"] = len(features)

    # Write only after every request and validation succeeded.
    GEO_PATH.write_text(
        json.dumps(geo, ensure_ascii=False),
        encoding="utf-8"
    )
    SUMMARY_PATH.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    print("SUCCESS — Fresh rainfall forecasts saved")

if __name__ == "__main__":
    main()
