
from pathlib import Path
from datetime import datetime, timezone
import json, os, math, collections
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "frontend/public/data"

def read(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))

def save(name, payload):
    target = DATA / name
    tmp = target.with_suffix(target.suffix + ".tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )
    os.replace(tmp, target)

def geom(feature):
    return shape(feature["geometry"])

rain = read("haorshield_rainfall_risk.geojson")
crop = read("haorshield_cropland_cells.geojson")
old = read("haorshield_flood_screening.geojson")
rain_summary = read("haorshield_rainfall_summary.json")

rfeatures = rain.get("features", [])
cfeatures = crop.get("features", [])
oldfeatures = old.get("features", [])

assert len(rfeatures) == len(cfeatures) == len(oldfeatures) == 306

# Do not join geographic cells by list position unless
# actual geometry and district values agree.
rain_geoms = [geom(f) for f in rfeatures]
crop_geoms = [geom(f) for f in cfeatures]


# Cell identifiers are the primary cropland join key.
crop_by_id = {
    str(f["properties"]["cell_id"]): i
    for i, f in enumerate(cfeatures)
}
assert len(crop_by_id) == 306

def overlap_quality(a, b):
    """Fractional intersection relative to BOTH polygons."""
    if not a.intersects(b):
        return 0.0
    intersection = a.intersection(b).area
    if a.area <= 0 or b.area <= 0:
        return 0.0
    return min(intersection / a.area, intersection / b.area)

def match_rain(source, index_hint=None):
    source_geometry = geom(source)
    district = source["properties"]["district"]

    # Fast path: original grid ordering, if geometrically valid.
    if index_hint is not None and index_hint < len(rfeatures):
        candidate = rfeatures[index_hint]
        if (
            candidate["properties"].get("district") == district
            and overlap_quality(
                source_geometry, rain_geoms[index_hint]
            ) >= 0.99
        ):
            return index_hint

    candidates = []
    for j, feature in enumerate(rfeatures):
        if feature["properties"].get("district") != district:
            continue

        quality = overlap_quality(source_geometry, rain_geoms[j])
        if quality >= 0.99:
            candidates.append((j, quality))

    if len(candidates) != 1:
        raise ValueError(
            f"Rainfall match failed for {district}: "
            f"{len(candidates)} matches at >=99% overlap"
        )

    return candidates[0][0]

def match_crop(source):
    identifier = str(source["properties"]["cell_id"])

    if identifier not in crop_by_id:
        raise ValueError(f"Missing cropland cell_id: {identifier}")

    j = crop_by_id[identifier]
    quality = overlap_quality(
        geom(source), crop_geoms[j]
    )

    if quality < 0.99:
        raise ValueError(
            f"Crop geometry mismatch for {identifier}: "
            f"{quality:.4f} overlap"
        )

    return j

new_features = []
used_rain = set()
used_crop = set()

for i, original in enumerate(oldfeatures):
    original["_index_hint"] = i

    ri = match_rain(original, i)
    ci = match_crop(original)

    if ri in used_rain or ci in used_crop:
        raise ValueError("Duplicate spatial matching")
    used_rain.add(ri)
    used_crop.add(ci)

    base = dict(original["properties"])
    incoming = rfeatures[ri]["properties"]
    cropland = cfeatures[ci]["properties"]

    hectares = float(cropland["cropland_ha"])
    if not math.isfinite(hectares) or hectares < 0:
        raise ValueError("Invalid cropland hectares")

    base["mapped_cropland_ha"] = round(hectares, 2)

    for h in (24, 48, 72):
        rainfall = float(incoming[f"rain{h}_mm"])
        category = str(incoming[f"alert{h}"])

        if not math.isfinite(rainfall) or rainfall < 0:
            raise ValueError("Invalid rainfall")

        base[f"rain{h}_mm"] = round(rainfall, 2)
        base[f"alert{h}"] = category

        # Rainfall-screening categories only.
        # No flood probability or inundation inference.
        elevated = category not in (
            "Low Forecast Rainfall",
            "No Elevated Rainfall Signal",
            "None",
            "No Rainfall",
        )

        base[f"screening{h}"] = (
            "Elevated Rainfall Signal — " + category
            if elevated else "No Elevated Rainfall Signal"
        )
        base[f"elevated_rainfall_{h}h"] = bool(elevated)

    new_features.append({
        "type": "Feature",
        "properties": base,
        "geometry": original["geometry"]
    })

assert len(used_rain) == len(used_crop) == 306

timestamp = rain_summary.get("generated_at")
if not timestamp:
    raise ValueError("Rainfall updater timestamp missing")

issued = datetime.fromisoformat(
    timestamp.replace("Z", "+00:00")
)
if issued.tzinfo is None:
    raise ValueError("Rainfall timestamp missing timezone")

age_hours = (
    datetime.now(timezone.utc)
    - issued.astimezone(timezone.utc)
).total_seconds() / 3600

if age_hours < -1:
    raise ValueError("Rainfall timestamp is in the future")

spatial = {
    "type": "FeatureCollection",
    "metadata": {
        "generated_at": timestamp,
        "data_type": "rainfall_screening_not_flood_inundation",
        "cropland_source": "ESA WorldCover 2021 class 40",
        "method": "Geometry-matched 306-cell cropland overlap",
        "warning": (
            "Elevated rainfall screening is not a flooded-area "
            "prediction and does not indicate river flood safety."
        )
    },
    "features": new_features
}

screen_summary = {
    "generated_at": timestamp,
    "cells": 306,
    "is_flood_inundation_prediction": False,
    "counts": {},
    "screened_geographic_area_km2": {}
}

crop_summary = {
    "generated_at": timestamp,
    "cropland_source": "ESA WorldCover 2021",
    "data_type": "cropland_within_rainfall_screening_cells",
    "is_flood_inundation_prediction": False,
    "predicted_flooded_cropland_ha": None,
    "horizons": {}
}

for h in (24, 48, 72):
    counts = collections.Counter()
    areas = collections.defaultdict(float)
    districts = collections.defaultdict(
        lambda: {"screened_cropland_ha": 0.0, "cells": 0}
    )

    for feature in new_features:
        p = feature["properties"]
        cat = p[f"screening{h}"]
        counts[cat] += 1
        areas[cat] += float(p["area_km2"])

        if p[f"elevated_rainfall_{h}h"]:
            d = districts[p["district"]]
            d["screened_cropland_ha"] += float(
                p["mapped_cropland_ha"]
            )
            d["cells"] += 1

    screen_summary["counts"][str(h)] = dict(counts)
    screen_summary["screened_geographic_area_km2"][str(h)] = {
        key: round(value, 2) for key, value in areas.items()
    }

    crop_summary["horizons"][str(h)] = {
        "screened_cropland_ha": round(
            sum(
                value["screened_cropland_ha"]
                for value in districts.values()
            ), 2
        ),
        "districts": {
            key: {
                "screened_cropland_ha": round(
                    value["screened_cropland_ha"], 2
                ),
                "screened_cells": value["cells"]
            }
            for key, value in sorted(districts.items())
        },
    }

# Only write after all spatial and numerical checks pass.
save("haorshield_flood_screening.geojson", spatial)
# This exact 306-cell layer is consumed by both the agricultural
# guidance panel and the Flood Exposure page. Keep it synchronized
# with the summary on EVERY successful rainfall refresh.
save("haorshield_cropland_rainfall_screening.geojson", spatial)
save("haorshield_flood_screening_summary.json", screen_summary)
save("haorshield_cropland_rainfall_screening_summary.json", crop_summary)

print("PASS: 306 rainfall/cropland cells spatially matched")
print("Rainfall generated at:", timestamp)
print("Rainfall age:", round(age_hours, 2), "hours")

if age_hours > 12:
    print("WARNING: source forecast is stale in this run")

for h in (24, 48, 72):
    item = crop_summary["horizons"][str(h)]
    print(
        f"{h}h: {item['screened_cropland_ha']:,.2f} ha "
        "inside elevated-rainfall screening cells"
    )

print("NOT a predicted flood inundation map.")
