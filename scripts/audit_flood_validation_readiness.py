#!/usr/bin/env python3
"""Nonproduction: inventory independently observed future flood labels.
No candidate/SAR labels are converted to observed flood outcomes.
Run: python scripts/audit_flood_validation_readiness.py --root . --out docs/FR06_VALIDATION_READINESS.json
"""
import argparse, csv, json
from pathlib import Path

BAD = ('sar_candidate','proxy','synthetic','unverified')

def inspect(root):
    source = root/'docs/historical_flood_source_inventory.csv'
    sar = root/'research/sar_proxy_benchmark_inputs.csv'
    report = {'independent_24_48_72_validation_ready':False,'reason':'No independently verified issue-time forecast/observation pairs found','historical_event_rows':0,'eligible_historical_event_rows':0,'sar_candidate_rows':0,'sar_candidate_dates':0,'data_sources':{},'next_data_requirements':[
       'Independently documented timestamped flooded AND observed non-flood cases with coordinates/cell IDs',
       'Exact observed period matching (forecast issue, issue+24/48/72h]',
       'Archived forecast issued at each chosen timestamp, never observed future rainfall',
       'Source ID and reviewer checks for both flood and non-flood labels',
       'Separate chronological held-out evaluation by issue date, season and event']}
    if source.is_file():
        with source.open(newline='',encoding='utf-8-sig') as f: events=list(csv.DictReader(f))
        report['historical_event_rows']=len(events)
        needed={'has_exact_observation_time','has_forward_non_flood_controls','usable_as_verified_24_48_72h_outcome'}
        for e in events:
            if all(str(e.get(k,'')).lower()=='true' for k in needed):
                report['eligible_historical_event_rows']+=1
        report['data_sources']['modis_events']='Event maximum flood extent; not verified 24–72h forecast outcomes'
    if sar.is_file():
        with sar.open(newline='',encoding='utf-8-sig') as f:
            reader=csv.DictReader(f); cols=reader.fieldnames or []
            dates=set()
            for row in reader:
                report['sar_candidate_rows']+=1
                for key in ('acquisition_date','date','sar_date','image_date'):
                    if key in row and row[key]:dates.add(row[key]);break
            report['sar_candidate_dates']=len(dates)
        report['data_sources']['sar_candidates']='Research candidates only; no independent observed-flood labels'
        if not any('candidate' in c or 'proxy' in c for c in cols):
            report['data_sources']['sar_candidates']='Historical SAR research table; provenance not independently verified'
    # No CSV value or claim of verification becomes trusted simply because it says verified.
    return report

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path('.'))
    ap.add_argument('--out',type=Path,default=Path('docs/FR06_VALIDATION_READINESS.json'))
    args=ap.parse_args()
    result=inspect(args.root)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))
    print('STATUS:', 'INDEPENDENT VALIDATION NOT READY' if not result['independent_24_48_72_validation_ready'] else 'REVIEW REQUIRED')
if __name__=='__main__':main()
