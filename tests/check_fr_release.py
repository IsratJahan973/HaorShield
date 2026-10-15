"""Offline, dependency-free acceptance checks for the HaorShield research UI.
Run from repository root: python tests/check_fr_release.py
Scientific accuracy is NOT established by these engineering checks.
"""
from pathlib import Path
from collections import Counter
import json
import csv

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'frontend/public/data'
SRC=ROOT/'frontend/src'
GEO=json.loads((DATA/'haorshield_sar_future_candidates.geojson').read_text())
SUMMARY=json.loads((DATA/'haorshield_sar_future_summary.json').read_text())
BENCH=json.loads((DATA/'haorshield_model_benchmark.json').read_text())
CROP=json.loads((DATA/'haorshield_cropland_rainfall_screening.geojson').read_text())
FFWC=json.loads((DATA/'haorshield_ffwc_stations.json').read_text())
assert GEO['type']=='FeatureCollection' and len(GEO['features'])==306
assert len({f['properties']['cell_id'] for f in GEO['features']})==306
assert len({f['properties']['district'] for f in GEO['features']})==7
assert len(CROP['features'])==306
assert SUMMARY['is_validated_flood_probability'] is False
assert SUMMARY['is_validated_inundation_prediction'] is False
assert SUMMARY['predicted_flooded_cropland_ha'] is None
for h in [24,48,72]:
    for f in GEO['features']:
        p=f['properties']; frac=p[f'sar_candidate_fraction_{h}h']
        assert isinstance(frac,(int,float)) and 0<=frac<=1
        assert p['cell_area_ha']>0 and p['cropland_ha']>=0
        assert p[f'research_cropland_proxy_ha_{h}h']>=0
        assert p[f'research_land_proxy_ha_{h}h']>=0
assert BENCH['fair_same_split_research_comparison'] is True
assert BENCH['independent_operational_test'] is False
assert BENCH['original_haorshieldnet_architecture_or_weights_recovered'] is False
assert len(BENCH['results'])==24
assert {x['model'] for x in BENCH['results']}=={
 'Historical cell baseline','Random Forest','XGBoost',
 'HaorShieldNet-style MLP (reconstructed)'
}
assert len(FFWC['stations'])==21
checker=(SRC/'FloodRiskChecker.jsx').read_text()
app=(SRC/'App.jsx').read_text()
future=(SRC/'FutureSpatialOutlook.jsx').read_text()
for term in ['precipitation_probability','CropEarlyAction','currentOutdated','onOpenForecast']:
    assert term in checker,term
for term in ['Very Heavy','Heavy','Moderate','Light','No Rain']:
    assert term in checker,term
assert 'onOpenForecast=' in app and 'initialDistrict={forecastDistrict}' in app
assert 'concernAreaKm2' in future and 'concernCroplandHa' in future
assert 'CONCERN_CUTOFF = 0.10' in future
assert 'বাংলা' in (SRC/'CropEarlyAction.jsx').read_text()
print('PASS: 306-cell/7-district SAR and cropland schema')
print('PASS: 24/48/72 horizon inputs and scientific-null flags')
print('PASS: 21 FFWC station references')
print('PASS: 24-row same-split research benchmark metadata')
print('PASS: crop guidance, weather probability, categories and district link in source')
print('NOT TESTED: actual browser rendering, network weather response, mobile interaction')
print('NOT CLAIMED: calibrated future flood probabilities or verified inundation')
