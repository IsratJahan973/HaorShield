"""Publish preserved experimental evaluation results verbatim, without retraining."""
from pathlib import Path
from datetime import datetime, timezone
import csv, json, os

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "frontend" / "public" / "data"
ML = ROOT / "ml"

rows = []
with (ML / "sar_spatial_corrected_heldout_validation.csv").open(newline="") as stream:
    for record in csv.DictReader(stream):
        rows.append({
            "horizon_hours": int(record["horizon"]),
            "test_year": int(record["test_year"]),
            "variant": record["variant"],
            "mae_sar_candidate_fraction": float(record["mae"]),
            "average_precision_detection_ranking": float(record["AP"]),
            "test_records": int(record["test_records"]),
            "test_satellite_dates": int(record["test_dates"])
        })
assert len(rows) == 24
assert {r['test_year'] for r in rows} == {2024, 2025}
assert {r['horizon_hours'] for r in rows} == {24,48,72}

with (ML / "spatial_extent_model_comparison.csv").open(newline="") as stream:
    event_summary = [{k: (float(v) if k != 'model' else v) for k, v in row.items()}
                     for row in csv.DictReader(stream)]

payload = {
    "data_type": "existing_experimental_research_evaluation",
    "source_file": "ml/sar_spatial_corrected_heldout_validation.csv",
    "generated_for_presentation_at": datetime.now(timezone.utc).isoformat(),
    "metrics": {
        "mae": "Mean absolute error against derived SAR candidate fractions; lower is better.",
        "AP": "Average precision for ranking derived SAR candidate detection labels; higher is better. Not flood forecast accuracy."
    },
    "protocol": {
        "development_period": "2024 time-held-out research evaluation; used in research decisions",
        "reused_diagnostic_period": "2025 research diagnostic examined during model development; NOT an untouched final holdout",
        "train_period_reported_in_research": "2016–2023",
        "independent_operational_test": False,
        "ground_truth_independently_validated": False,
        "future_ecmwf_hindcast_matched_to_training_inputs": False,
        "model_selection_leakage_proven_absent": False,
        "uncertainty": "Sparse satellite dates (four test dates per year), derived change labels and unmatched observation-versus-forecast rainfall. Independent operational performance remains unknown."
    },
    "research_variants": {
        "historical_baseline": "Historical candidate-frequency baseline",
        "core": "SAR research model: weather, terrain and spatial features",
        "antecedent": "SAR research model adding antecedent rainfall",
        "antecedent_flow": "SAR research model adding antecedent rainfall and GloFAS proxy"
    },
    "requested_architecture_comparison": [
        {"model": "Random Forest", "evidence": "An earlier retrospective Random Forest classifier is available, but it uses a different target and 14-feature task; its metrics are not directly comparable to the 306-cell future SAR research task.", "same_task_leakage_safe_benchmark": False},
        {"model": "XGBoost", "evidence": "No reproducible, matching benchmark on a newly untouched test period is included in this checkpoint.", "same_task_leakage_safe_benchmark": False},
        {"model": "HaorShieldNet", "evidence": "The matching trained architecture and common independent evaluation artifact are not included in this checkpoint.", "same_task_leakage_safe_benchmark": False}
    ],
    "rows": rows,
    "separate_event_extent_experiment": event_summary,
    "claims_prohibited": ["validated flood probability", "measured crop damage", "independently verified future inundation accuracy"]
}
DATA.mkdir(parents=True, exist_ok=True)
path = DATA / "haorshield_model_evidence.json"
tmp = path.with_suffix('.json.tmp')
tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')
os.replace(tmp, path)
print('PUBLISHED 24 preserved research evaluation rows; no new evaluation claims:', path)
