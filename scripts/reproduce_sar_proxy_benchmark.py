#!/usr/bin/env python3
"""Reproducible chronology-separated *SAR candidate proxy* comparison.

IMPORTANT: targets are unvalidated Sentinel-1 change-detection candidate fractions,
NOT independently verified flood observations; 2024 and 2025 were used in earlier
research, so this is NOT an untouched independent operational evaluation.

Run: python scripts/reproduce_sar_proxy_benchmark.py
Input: research/sar_proxy_benchmark_inputs.csv
Output: frontend/public/data/haorshield_model_benchmark.json
"""
from __future__ import annotations
from pathlib import Path
from datetime import datetime, timezone
import json, random
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, average_precision_score, mean_squared_error
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'research/sar_proxy_benchmark_inputs.csv'
OUTPUT = ROOT / 'frontend/public/data/haorshield_model_benchmark.json'
SEED=42
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)
torch.set_num_threads(2)

class Net(nn.Module):
    """Explicitly reconstructed HaorShieldNet-style MLP, not original C6 weights."""
    def __init__(self, n):
        super().__init__()
        self.layers=nn.Sequential(nn.Linear(n,32),nn.ReLU(),nn.Linear(32,16),nn.ReLU(),nn.Linear(16,1),nn.Sigmoid())
    def forward(self,x):return self.layers(x).squeeze(-1)


def train_mlp(x_train,y_train,x_val,y_val):
    model=Net(x_train.shape[1]); opt=torch.optim.Adam(model.parameters(),lr=0.003,weight_decay=1e-4)
    criterion=nn.L1Loss()
    tr_x=torch.from_numpy(x_train.astype('float32')); tr_y=torch.from_numpy(y_train.astype('float32'))
    va_x=torch.from_numpy(x_val.astype('float32')); va_y=torch.from_numpy(y_val.astype('float32'))
    generator=torch.Generator().manual_seed(SEED)
    best=float('inf'); best_state=None; best_epoch=0; stale=0
    for epoch in range(1,121):
        model.train()
        order=torch.randperm(len(tr_x),generator=generator)
        for chunk in order.split(128):
            opt.zero_grad()
            loss=criterion(model(tr_x[chunk]),tr_y[chunk]);loss.backward();opt.step()
        model.eval()
        with torch.no_grad(): val=float(criterion(model(va_x),va_y).item())
        if val<best-0.0001:
            best=val;best_epoch=epoch
            best_state={k:v.detach().clone() for k,v in model.state_dict().items()};stale=0
        else: stale+=1
        if stale>=15:break
    model.load_state_dict(best_state)
    model.eval()
    return model,best_epoch,best


def metrics(y, pred, positives):
    clipped=np.clip(np.asarray(pred,dtype=float),0,1)
    return {
        'mae':round(float(mean_absolute_error(y,clipped)),6),
        'rmse':round(float(np.sqrt(mean_squared_error(y,clipped))),6),
        'average_precision_for_unvalidated_candidate_flag':round(float(average_precision_score(positives,clipped)),6)
            if len(np.unique(positives))==2 else None,
        'candidate_flag_prevalence':round(float(np.mean(positives)),6),
        'records':int(len(y))
    }


def main():
    source=pd.read_csv(INPUT)
    needed={'year','acquisition_date','cell_id','candidate_fraction_cell','candidate_positive','latitude','longitude','elevation_m','slope_deg','crop_ha','cell_area_ha'}
    assert needed.issubset(source.columns), sorted(needed-source.columns)
    assert len(source)==3497, len(source)
    assert source['acquisition_date'].nunique()==26
    assert not source.duplicated(['acquisition_date','cell_id']).any()
    assert (source['candidate_fraction_cell'].between(0,1)).all()
    assert set(source['year'].unique())=={2016,2017,2018,2020,2022,2023,2024,2025}
    tr=source.year<=2022;va=source.year==2023;te=source.year.isin([2024,2025]);
    assert tr.sum()>1000 and va.sum()>100 and te.sum()>1000
    train_dates=set(source.loc[tr,'acquisition_date']); val_dates=set(source.loc[va,'acquisition_date']); eval_dates=set(source.loc[te,'acquisition_date'])
    assert not (train_dates&val_dates or train_dates&eval_dates or val_dates&eval_dates)
    static_cols=['latitude','longitude','elevation_m','slope_deg','cropland_share','month_sin','month_cos']
    month=pd.to_datetime(source['acquisition_date']).dt.month
    source=source.copy()
    source['cropland_share']=(source['crop_ha']/source['cell_area_ha']).clip(0,1)
    source['month_sin']=np.sin(2*np.pi*(month-1)/12)
    source['month_cos']=np.cos(2*np.pi*(month-1)/12)
    scores=[]; candidates={};
    for h in [24,48,72]:
        cols=static_cols+[f'past7_issue{h}_mm',f'past30_issue{h}_mm']
        assert set(cols).issubset(source.columns)
        frame=source[cols].replace([np.inf,-np.inf],np.nan)
        imputer=SimpleImputer(strategy='median').fit(frame.loc[tr])
        all_x=imputer.transform(frame)
        xtr,xva,xte=all_x[tr],all_x[va],all_x[te]
        scaler=StandardScaler().fit(xtr)
        xtr_nn=scaler.transform(xtr); xva_nn=scaler.transform(xva);xte_nn=scaler.transform(xte)
        target=source['candidate_fraction_cell'].values.astype(float)
        ytr,yva,yte=target[tr],target[va],target[te]
        labels=source.loc[te,'candidate_positive'].astype(int).to_numpy()
        # Same training, validation and evaluation dates, target and features for all models.
        rf_candidates=[]
        for trees in (120,240):
            rf=RandomForestRegressor(n_estimators=trees,min_samples_leaf=3,max_features=0.9,n_jobs=2,random_state=SEED)
            rf.fit(xtr,ytr)
            score=mean_absolute_error(yva,rf.predict(xva));rf_candidates.append((score,trees,rf))
        _,trees,rf=min(rf_candidates,key=lambda item:item[0])
        xgb_candidates=[]
        for trees_xgb in (120,240):
            xgb=XGBRegressor(n_estimators=trees_xgb,max_depth=3,learning_rate=0.045,subsample=0.85,colsample_bytree=0.9,reg_lambda=3,objective='reg:squarederror',tree_method='hist',n_jobs=2,random_state=SEED)
            xgb.fit(xtr,ytr)
            score=mean_absolute_error(yva,xgb.predict(xva));xgb_candidates.append((score,trees_xgb,xgb))
        _,trees_xgb,xgb=min(xgb_candidates,key=lambda item:item[0])
        net,best_epoch,net_val=train_mlp(xtr_nn,ytr,xva_nn,yva)
        with torch.no_grad(): net_pred=net(torch.from_numpy(xte_nn.astype('float32'))).numpy()
        # Mean by training cell, never fitted using a validation/test date.
        baseline_lookup=source.loc[tr].groupby('cell_id')['candidate_fraction_cell'].mean()
        global_mean=float(ytr.mean())
        baseline=source.loc[te,'cell_id'].map(baseline_lookup).fillna(global_mean).to_numpy()
        predictions={
            'Historical cell baseline':baseline,
            'Random Forest':rf.predict(xte),
            'XGBoost':xgb.predict(xte),
            'HaorShieldNet-style MLP (reconstructed)':net_pred
        }
        for model_name,pred in predictions.items():
            for yr in (2024,2025):
                ix=(source.loc[te,'year'].to_numpy()==yr)
                record={'horizon_hours':h,'evaluation_year':yr,'model':model_name,'proxy_target':'unvalidated_sar_candidate_fraction',
                        'split':'2016-2022 train / 2023 validation / 2024-2025 reused diagnostic years',
                        'evaluation_dates':int(source.loc[te].loc[source.loc[te,'year']==yr,'acquisition_date'].nunique()),
                        **metrics(yte[ix],pred[ix],labels[ix])}
                scores.append(record)
        candidates[str(h)]={'features':cols,'selected_rf_trees':trees,'selected_xgb_trees':trees_xgb,'net_selected_epoch':best_epoch,
                            'mlp_architecture':'9 inputs -> 32 ReLU -> 16 ReLU -> sigmoid output, trained with Adam/MAE',
                            'selection_validation_year':2023}
        print(f'{h}h: RF={trees}, XGB={trees_xgb}, MLP best epoch={best_epoch}',flush=True)
    result={
      'title':'Same-split research benchmark: unvalidated SAR candidate fraction',
      'generated_utc':datetime.now(timezone.utc).isoformat(),
      'source':'research/sar_proxy_benchmark_inputs.csv',
      'experimental_only':True,
      'independent_operational_test':False,
      'fair_same_split_research_comparison':True,
      'original_haorshieldnet_architecture_or_weights_recovered':False,
      'target_type':'unvalidated Sentinel-1 change-detection candidate_fraction_cell, NOT observed future flood extent',
      'rows_total':len(source),'train_rows':int(tr.sum()),'validation_rows':int(va.sum()),'evaluation_rows':int(te.sum()),
      'unique_training_dates':len(train_dates),'unique_validation_dates':len(val_dates),'unique_evaluation_dates':len(eval_dates),
      'evaluation_years_previously_inspected':True,
      'historical_rainfall_domain_shift':'Antecedent training variables from historical rainfall; live operational ECMWF forecast and GloFAS domain mismatch not assessed in this benchmark.',
      'validation_warnings':[
          '2024 and 2025 data were repeatedly inspected in earlier research. These scores are NOT untouched independent evaluation.',
          'The SAR target labels are NOT independently corroborated inundation ground truth.',
          'HaorShieldNet-style MLP is a documented reconstruction; original HaorShieldNet architecture and model weights were not supplied.',
          'Feature timing and archived weather provenance were not independently audited. Only antecedent-labelled rainfall and static covariates were used; future-realized rainfall and SAR-derived labels are excluded as predictors.',
          'The same geographic cells can appear in different years; the split prevents cross-date temporal leakage but does not test spatial transfer to entirely unseen cells.',
          'Model comparison is on a surrogate SAR fraction, NOT observed flood probabilities, flood losses or real-world forecast skill.'
      ],
      'protocol':{'train_years':'2016–2022','validation_year':2023,'evaluation_years':[2024,2025],
                  'group_isolation':'nonoverlapping acquisition dates across splits; identical feature set, target and test rows for all models',
                  'hyperparameter_selection':'RF and XGBoost tree counts selected on 2023; MLP epoch early stopped on 2023; no reported 2024/2025 scores used for tuning in this reproduction',
                  'metrics':'MAE, RMSE on candidate fraction; AP on dataset candidate_positive (unvalidated label)',
                  'random_seed':SEED},
      'per_horizon_model_setup':candidates,'results':scores
    }
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(result,indent=2),encoding='utf8')
    print('Wrote',OUTPUT,'results',len(scores))

if __name__=='__main__':main()
