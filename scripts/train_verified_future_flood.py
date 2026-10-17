#!/usr/bin/env python3
"""Train a future-flood binary classifier ONLY on externally verified forward outcomes.

Input must be one row per (forecast_issue_utc, cell_id, horizon_hours), with a
verified outcome for (issue, issue+horizon], and features proven available at issue.
This does NOT accept the project's SAR proxy/candidate dataset as ground truth.

Example:
 python scripts/train_verified_future_flood.py --input private_data/verified_future_flood.csv --out-dir results/verified_flood

Outputs stay in out-dir; this NEVER edits production map data or backend models.
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import brier_score_loss, average_precision_score, roc_auc_score, precision_score, recall_score, confusion_matrix
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

REQUIRED = {'issue_utc','cell_id','horizon_hours','outcome_start_utc','outcome_end_utc',
            'observed_flood','outcome_verified','rain_past7_mm','rain_past30_mm',
            'elevation_m','slope_deg'}
# Add optional features only when each value was available at the forecast issue time.
OPTIONAL_FEATURES = ['soil_moisture_issue','river_level_issue','upstream_rain_forecast_issue']
BASE_FEATURES = ['rain_past7_mm','rain_past30_mm','elevation_m','slope_deg']

class EvidenceError(ValueError): pass

def audit(df: pd.DataFrame):
    missing=REQUIRED-set(df.columns)
    if missing: raise EvidenceError('Required verified-outcome columns absent: '+', '.join(sorted(missing)))
    for name in ('issue_utc','outcome_start_utc','outcome_end_utc'):
        df[name]=pd.to_datetime(df[name],utc=True,errors='coerce')
        if df[name].isna().any(): raise EvidenceError(f'{name} has invalid timestamps')
    if df[['issue_utc','cell_id','horizon_hours']].duplicated().any():
        raise EvidenceError('Duplicate issue/cell/horizon records')
    hours=pd.to_numeric(df['horizon_hours'],errors='coerce')
    if hours.isna().any() or not hours.isin([24,48,72]).all():
        raise EvidenceError('Only numeric horizons 24/48/72 supported')
    df['horizon_hours']=hours.astype(int)
    if not df['outcome_verified'].isin([True,1,'true','True']).all():
        raise EvidenceError('All supplied outcomes must be independently verified; reject unknown labels')
    if not df['observed_flood'].isin([0,1]).all():
        raise EvidenceError('observed_flood must be independently verified binary 0 or 1')
    if not ((df['outcome_start_utc']==df['issue_utc']) &
            (df['outcome_end_utc']==df['issue_utc']+pd.to_timedelta(df['horizon_hours'],unit='h'))).all():
        raise EvidenceError('Outcomes must describe exactly the future (issue, issue+horizon] interval')
    if 'feature_cutoff_utc' not in df.columns:
        raise EvidenceError('feature_cutoff_utc required to prove input availability at forecast time')
    cutoff=pd.to_datetime(df['feature_cutoff_utc'],utc=True,errors='coerce')
    if cutoff.isna().any() or (cutoff>df['issue_utc']).any():
        raise EvidenceError('Forecast inputs have invalid or future availability timestamps')
    if 'outcome_source' not in df.columns or df['outcome_source'].fillna('').astype(str).str.strip().eq('').any():
        raise EvidenceError('Independent observed outcome provenance required in outcome_source')
    if df['outcome_source'].astype(str).str.contains('sar_candidate|proxy|synthetic|unverified',case=False,regex=True).any():
        raise EvidenceError('Unverified or synthetic outcomes cannot be operational training evidence')
    feature_cols=BASE_FEATURES+[c for c in OPTIONAL_FEATURES if c in df.columns and df[c].notna().any()]
    for column in feature_cols:
        numeric=pd.to_numeric(df[column],errors='coerce')
        if numeric.isna().all() or (~np.isfinite(numeric.dropna())).any():
            raise EvidenceError(f'{column} needs finite numerical evidence')
        df[column]=numeric
    for column in OPTIONAL_FEATURES:
        if column not in feature_cols: continue
        timestamp_col=f'{column}_available_utc'
        if timestamp_col not in df.columns:
            raise EvidenceError(f'{timestamp_col} required to prove optional feature timing')
        available=pd.to_datetime(df[timestamp_col],utc=True,errors='coerce')
        if (available.isna() & df[column].notna()).any() or (available[df[column].notna()]>df.loc[df[column].notna(),'issue_utc']).any():
            raise EvidenceError(f'{column} contains information unavailable at forecast issue')
    return df

def split_unique_issue_times(frame):
    times=sorted(frame['issue_utc'].unique())
    if len(times)<30:
        raise EvidenceError('Need >=30 distinct issue timestamps for an initial chronological train/validation/test audit')
    n=len(times); a=int(n*.6); b=int(n*.8)
    # Purge horizon overlap between partitions: eliminate all records whose forward label windows cross boundaries.
    train=frame[frame['issue_utc'].isin(times[:a])].copy()
    val=frame[frame['issue_utc'].isin(times[a:b])].copy()
    test=frame[frame['issue_utc'].isin(times[b:])].copy()
    val=val[val.issue_utc>=train.outcome_end_utc.max()]
    test=test[test.issue_utc>=val.outcome_end_utc.max()] if len(val) else test.iloc[0:0]
    if min(len(train),len(val),len(test))<25:
        raise EvidenceError('Insufficient rows after purging crossing forecast-outcome windows')
    for s in (train,val,test):
        if s.observed_flood.nunique()!=2:
            raise EvidenceError('Each split needs actual flood and non-flood outcomes')
        if s.issue_utc.nunique()<3:
            raise EvidenceError('Each split requires >=3 independent issue timestamps')
    return train,val,test

def eval_stats(y,score,threshold):
    decision=(score>=threshold).astype(int)
    return {'n':int(len(y)),'positives':int(y.sum()),
      'brier':float(brier_score_loss(y,score)),
      'average_precision':float(average_precision_score(y,score)),
      'roc_auc':float(roc_auc_score(y,score)),
      'precision':float(precision_score(y,decision,zero_division=0)),
      'recall':float(recall_score(y,decision,zero_division=0)),
      'confusion_matrix':confusion_matrix(y,decision,labels=[0,1]).tolist()}

def run(path,out):
    raw=pd.read_csv(path)
    if {'candidate_positive','candidate_fraction_cell'} & set(raw.columns):
        raise EvidenceError('This is a SAR candidate/proxy dataset, not a verified future-flood outcome dataset')
    frame=audit(raw)
    out.mkdir(parents=True,exist_ok=True)
    report={'source_file':str(path),'operationally_validated':False,
            'warning':'Observational evidence and calibration must be independently audited before public probability use',
            'per_horizon':{}}
    for horizon in [24,48,72]:
        part=frame[frame.horizon_hours==horizon].copy()
        if part.empty: raise EvidenceError(f'Missing horizon {horizon}')
        tr,va,te=split_unique_issue_times(part)
        cols=BASE_FEATURES+[c for c in OPTIONAL_FEATURES if c in part.columns and part[c].notna().any()]
        candidates={
          'constant_prevalence_baseline':Pipeline([('impute',SimpleImputer(strategy='median')),('model',DummyClassifier(strategy='prior'))]),
          'random_forest':Pipeline([('impute',SimpleImputer(strategy='median')),('model',RandomForestClassifier(n_estimators=200,min_samples_leaf=5,random_state=42,n_jobs=2))]),
          'hist_gradient_boosting':Pipeline([('impute',SimpleImputer(strategy='median')),('model',HistGradientBoostingClassifier(max_iter=150,max_leaf_nodes=12,learning_rate=.04,random_state=42))])
        }
        r={}; validation=[]
        for name,model in candidates.items():
            model.fit(tr[cols],tr.observed_flood.astype(int))
            prob=model.predict_proba(va[cols])[:,1]
            # no probability calibration from arbitrary small candidate labels
            validation.append((brier_score_loss(va.observed_flood,prob),name))
            r[name]={'validation':eval_stats(va.observed_flood.to_numpy(),prob,.5)}
        best=min(validation)[1]
        # Score the untouched test partition ONLY for the model selected on validation.
        # Never inspect all candidate test scores while deciding which model to report.
        chosen=candidates[best]
        chosen_test=eval_stats(te.observed_flood.to_numpy(),chosen.predict_proba(te[cols])[:,1],.5)
        report['per_horizon'][str(horizon)]={'features':cols,'selected_on_validation':best,
          'split_issue_dates':{'train':int(tr.issue_utc.nunique()),'validation':int(va.issue_utc.nunique()),'test':int(te.issue_utc.nunique())},
          'latest_train_outcome':tr.outcome_end_utc.max().isoformat(),
          'earliest_validation_issue':va.issue_utc.min().isoformat(),
          'latest_validation_outcome':va.outcome_end_utc.max().isoformat(),
          'earliest_test_issue':te.issue_utc.min().isoformat(),
          'candidate_models_validation_only':r,
          'selected_model_test':chosen_test}
    (out/'verified_future_flood_diagnostic.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('DIAGNOSTIC ONLY:',out/'verified_future_flood_diagnostic.json')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--out-dir',type=Path,default=Path('results/future_flood_audit'))
    args=parser.parse_args()
    try:run(args.input,args.out_dir)
    except (EvidenceError,FileNotFoundError) as exc:
        print('EVIDENCE GATE BLOCKED:',exc,file=sys.stderr);return 2
    return 0
if __name__=='__main__':sys.exit(main())
