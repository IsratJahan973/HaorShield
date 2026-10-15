"""Validate the experimental map & area accounting without asserting flood accuracy.
Usage: python tests/check_spatial_data.py [path-to-frontend/public/data]
"""
import json
import math
import sys
from collections import Counter
from pathlib import Path

folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('frontend/public/data')
geo = json.loads((folder / 'haorshield_sar_future_candidates.geojson').read_text())
summary = json.loads((folder / 'haorshield_sar_future_summary.json').read_text())
features = geo['features']
expected = {'Brahmanbaria','Habiganj','Kishoreganj','Moulvibazar','Netrakona','Sunamganj','Sylhet'}
assert len(features) == summary['cells'] == 306
assert set(f['properties']['district'] for f in features) == expected
assert len(set(str(f['properties']['cell_id']) for f in features)) == 306
assert summary['is_validated_flood_probability'] is False
assert summary['is_validated_inundation_prediction'] is False
for horizon in (24,48,72):
    land_total = crop_total = concern_km2 = concern_crop_ha = 0.0
    for feature in features:
        p = feature['properties']; area = float(p['cell_area_ha']); crop = float(p['cropland_ha'])
        fraction = float(p[f'sar_candidate_fraction_{horizon}h'])
        land = float(p[f'research_land_proxy_ha_{horizon}h']); exposed_crop = float(p[f'research_cropland_proxy_ha_{horizon}h'])
        rain = float(p[f'future_rain_{horizon}h_mm'])
        assert all(map(math.isfinite, (area,crop,fraction,land,exposed_crop,rain)))
        assert area > 0 and 0 <= crop <= area + .01
        assert 0 <= fraction <= 1 and 0 <= land <= area + .01 and 0 <= exposed_crop <= crop + .01 and rain >= 0
        assert abs(land - area*fraction) < .02
        assert abs(exposed_crop - crop*fraction) < .02
        land_total += land; crop_total += exposed_crop
        if fraction >= .10:
            concern_km2 += area / 100
            concern_crop_ha += crop
    expected_h = summary['horizons'][str(horizon)]
    assert abs(land_total-expected_h['research_land_proxy_ha']) < 1
    assert abs(crop_total-expected_h['research_cropland_proxy_ha']) < 1
    print(f'{horizon}h: 306 cells; land proxy {land_total:,.1f} ha; cropland proxy {crop_total:,.1f} ha; full concern-cell area {concern_km2:,.1f} km²; cropland in concern cells {concern_crop_ha:,.1f} ha')
print('PASS: seven districts, three horizons, arithmetic, and unvalidated-model disclosures.')
