"""Reproducible consistency audit for HaorShield's EXPERIMENTAL data.
Run: python tests/verify_horizon_consistency.py
Data arithmetic only; this does not validate flood forecast skill.
"""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'frontend/public/data'
g=json.loads((D/'haorshield_sar_future_candidates.geojson').read_text())
s=json.loads((D/'haorshield_sar_future_summary.json').read_text())
assert g['type']=='FeatureCollection'
features=g['features']; assert len(features)==306, len(features)
expected={'Brahmanbaria':35,'Habiganj':42,'Kishoreganj':40,'Moulvibazar':45,'Netrakona':42,'Sunamganj':52,'Sylhet':50}
from collections import Counter
counts=Counter(f['properties']['district'] for f in features)
assert counts==expected,(counts,expected)
assert s['cells']==306
seen=set()
for f in features:
 p=f['properties']; key=(p['district'],str(p['cell_id']))
 assert key not in seen,key
 seen.add(key)
 assert math.isfinite(p['cell_area_ha']) and p['cell_area_ha']>0
 assert math.isfinite(p['cropland_ha']) and 0<=p['cropland_ha']<=p['cell_area_ha']+1e-6
 for h in [24,48,72]:
  frac=p[f'sar_candidate_fraction_{h}h'];assert isinstance(frac,(int,float)) and 0<=frac<=1
  for field in ['research_land_proxy_ha','research_cropland_proxy_ha']:
   value=p[f'{field}_{h}h'];assert isinstance(value,(int,float)) and math.isfinite(value) and value>=0
for h in [24,48,72]:
 land=sum(f['properties'][f'research_land_proxy_ha_{h}h'] for f in features)
 crop=sum(f['properties'][f'research_cropland_proxy_ha_{h}h'] for f in features)
 flagged=[f['properties'] for f in features if f['properties'][f'sar_candidate_fraction_{h}h']>=.10]
 flagged_km2=sum(p['cell_area_ha']/100 for p in flagged)
 flagged_crop=sum(p['cropland_ha'] for p in flagged)
 print(f'{h}h: 306 cells, land proxy={land:.2f} ha, crop proxy={crop:.2f} ha, flagged={len(flagged)}, full-grid area={flagged_km2:.2f} km2, cropland in flagged cells={flagged_crop:.2f} ha')
assert not s.get('is_validated_flood_probability',False)
assert not s.get('is_validated_inundation_prediction',False)
print('PASS: Internal consistency only. No calibrated flood probability or inundation prediction was validated.')
