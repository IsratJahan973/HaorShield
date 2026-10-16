"""Run: python tests/test_validation_readiness.py (stdlib only)."""
import importlib.util, tempfile, csv
from pathlib import Path
spec=importlib.util.spec_from_file_location('audit',Path(__file__).resolve().parents[1]/'scripts/audit_flood_validation_readiness.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp);(root/'docs').mkdir();(root/'research').mkdir()
    with (root/'docs/historical_flood_source_inventory.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['event_id','has_exact_observation_time','has_forward_non_flood_controls','usable_as_verified_24_48_72h_outcome']);w.writeheader();w.writerow(dict(event_id='X',has_exact_observation_time='False',has_forward_non_flood_controls='False',usable_as_verified_24_48_72h_outcome='False'))
    with (root/'research/sar_proxy_benchmark_inputs.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['acquisition_date','candidate_positive']);w.writeheader();w.writerow(dict(acquisition_date='2017-01-01',candidate_positive='1'))
    r=m.inspect(root)
    assert not r['independent_24_48_72_validation_ready']
    assert r['historical_event_rows']==1 and r['eligible_historical_event_rows']==0
    assert r['sar_candidate_rows']==1 and r['sar_candidate_dates']==1
    assert not m.inspect(Path(tmp)/'empty')['independent_24_48_72_validation_ready']
print('PASS validation readiness refuses proxy and event-wide MODIS as verified outcome')
