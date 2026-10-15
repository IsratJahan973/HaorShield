"""Actual HaorShield public-data safety gates for CI; no external APIs."""
from pathlib import Path
from datetime import datetime
from collections import Counter
import json, math

DATA = Path(__file__).resolve().parents[1] / "frontend/public/data"

def read(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))

DISTRICTS = {
    "Brahmanbaria", "Habiganj", "Kishoreganj", "Moulvibazar",
    "Netrakona", "Sunamganj", "Sylhet"
}
H = [24, 48, 72]

sar = read("haorshield_sar_future_candidates.geojson")
sar_sum = read("haorshield_sar_future_summary.json")
assert sar.get("type") == "FeatureCollection" and len(sar.get("features", [])) == 306
assert sar_sum["cells"] == 306 and sar_sum["is_validated_inundation_prediction"] is False
assert sar_sum["is_validated_flood_probability"] is False
assert sar_sum["predicted_flooded_land_ha"] is None
assert sar_sum["predicted_flooded_cropland_ha"] is None
assert set(sar_sum["horizons"]) == {"24", "48", "72"}
assert {f["properties"]["district"] for f in sar["features"]} == DISTRICTS
assert len({int(f["properties"]["cell_id"]) for f in sar["features"]}) == 306
for h in H:
    land, crop = 0., 0.
    for f in sar["features"]:
        p = f["properties"]
        fraction = float(p[f"sar_candidate_fraction_{h}h"])
        a = float(p[f"research_land_proxy_ha_{h}h"])
        c = float(p[f"research_cropland_proxy_ha_{h}h"])
        assert all(math.isfinite(x) for x in [fraction, a, c])
        assert 0 <= fraction <= 1 and 0 <= a <= float(p["cell_area_ha"]) + .1
        assert 0 <= c <= float(p["cropland_ha"]) + .1
        land += a; crop += c
    assert abs(land - sar_sum["horizons"][str(h)]["research_land_proxy_ha"]) < 2
    assert abs(crop - sar_sum["horizons"][str(h)]["research_cropland_proxy_ha"]) < 2

screen = read("haorshield_cropland_rainfall_screening.geojson")
summary = read("haorshield_cropland_rainfall_screening_summary.json")
assert screen["type"] == "FeatureCollection" and len(screen["features"]) == 306
assert summary["is_flood_inundation_prediction"] is False
assert summary["predicted_flooded_cropland_ha"] is None
assert "horizons" in summary
assert summary["generated_at"] == screen["metadata"]["generated_at"]
assert {f["properties"]["district"] for f in screen["features"]} == DISTRICTS
for f in screen["features"]:
    p = f["properties"]
    assert math.isfinite(float(p["mapped_cropland_ha"]))
    for h in H:
        assert type(p[f"elevated_rainfall_{h}h"]) is bool
        assert math.isfinite(float(p[f"rain{h}_mm"]))

ffwc = read("haorshield_ffwc_stations.json")
assert ffwc["station_count"] == len(ffwc["stations"]) and ffwc["station_count"] >= 1
assert ffwc["contains_live_water_levels"] is False
assert ffwc["contains_live_official_forecasts"] is False

model = read("haorshield_model_evidence.json")
assert len(model["rows"]) == 24
assert model["protocol"]["independent_operational_test"] is False

for path in DATA.iterdir():
    if path.suffix in (".json", ".geojson"):
        read(path.name)

print("PASS: 306-cell SAR candidate map, 7 districts, 24/48/72h area-proxy conservation")
print("PASS: linked rainfall/cropland map and synchronized summary")
print("PASS: honest FFWC station reference; no invented official forecasts")
print("PASS: preserved 24 research evaluations and explicit independent-test warning")
print("PASS: all public JSON and GeoJSON files are readable")
