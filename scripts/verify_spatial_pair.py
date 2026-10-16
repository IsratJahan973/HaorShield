"""Validate the spatial forecast pair before either file is committed."""
from datetime import datetime, timezone
from pathlib import Path
import json, math

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'frontend/public/data'
summary = json.loads((DATA/'haorshield_sar_future_summary.json').read_text(encoding='utf-8'))
geo = json.loads((DATA/'haorshield_sar_future_candidates.geojson').read_text(encoding='utf-8'))
now = datetime.now(timezone.utc)
issued = datetime.fromisoformat(summary['generated_at'].replace('Z','+00:00'))
assert issued.tzinfo is not None and -3600 <= (now-issued).total_seconds() <= 3600*2, 'Spatial data not freshly regenerated'
assert summary['issue_anchor_date_utc'] == now.date().isoformat(), 'Spatial issue day mismatch'
assert summary['cells'] == 306 and geo['type'] == 'FeatureCollection' and len(geo['features']) == 306
assert summary['is_validated_flood_probability'] is False
assert summary['is_validated_inundation_prediction'] is False
ids = set()
for f in geo['features']:
    p = f['properties']
    cid = str(p['cell_id'])
    assert cid not in ids, 'Duplicate geographic cell'
    ids.add(cid)
    assert math.isfinite(float(p['cell_area_ha'])) and float(p['cell_area_ha']) > 0
    assert math.isfinite(float(p['cropland_ha'])) and 0 <= float(p['cropland_ha']) <= float(p['cell_area_ha'])
    for h in (24,48,72):
        v = float(p[f'sar_candidate_fraction_{h}h'])
        assert math.isfinite(v) and 0 <= v <= 1
print('PASS: matched fresh spatial files, 306 cells, all 3 periods, research-only flags')
