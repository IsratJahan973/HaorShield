"""Unit tests for evidence safeguards; synthetic data is test-only, never forecast evidence."""
from pathlib import Path
import importlib.util
import tempfile
import numpy as np
import pandas as pd

spec=importlib.util.spec_from_file_location('verified_model',Path(__file__).resolve().parents[1]/'scripts/train_verified_future_flood.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def fixture():
    rows=[]
    for h in (24,48,72):
        for n in range(55):
            issue=pd.Timestamp('2018-01-01',tz='UTC')+pd.Timedelta(days=5*n)
            for cell in (0,1,2,3):
                y=int((n+cell)%4 in (0,1))
                rows.append({'issue_utc':issue.isoformat(), 'cell_id':cell,
                  'horizon_hours':h,'outcome_start_utc':issue.isoformat(),
                  'outcome_end_utc':(issue+pd.Timedelta(hours=h)).isoformat(),
                  'outcome_verified':True,'observed_flood':y,'outcome_source':'unit_test_external_review_only',
                  'feature_cutoff_utc':issue.isoformat(),
                  'rain_past7_mm':float(n%11)*5,'rain_past30_mm':float(n%23)*8,
                  'elevation_m':5.0+cell,'slope_deg':0.1+cell*.2})
    return pd.DataFrame(rows)

def main():
    with tempfile.TemporaryDirectory() as tmp:
        p=Path(tmp)/'example.csv';out=Path(tmp)/'results'
        fixture().to_csv(p,index=False)
        assert m.run(p,out) is None
        assert (out/'verified_future_flood_diagnostic.json').exists()
        pxy=Path(tmp)/'proxy.csv';fixture().assign(candidate_positive=1).to_csv(pxy,index=False)
        try:m.run(pxy,out);raise AssertionError('Proxy label was accepted')
        except m.EvidenceError:pass
        future=fixture();future['feature_cutoff_utc']=(pd.to_datetime(future.issue_utc,utc=True)+pd.Timedelta(hours=2)).astype(str)
        future.to_csv(p,index=False)
        try:m.run(p,out);raise AssertionError('Future feature timestamps accepted')
        except m.EvidenceError:pass
        print('PASS: synthetic-only pipeline execution, proxy-label rejection, future-feature rejection')
if __name__=='__main__':main()
