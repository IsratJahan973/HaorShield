from pathlib import Path
import json
p = Path(__file__).resolve().parents[1]
data = json.loads((p/'frontend/public/data/haorshield_official_station_research.json').read_text())
assert data['status'] == 'RESEARCH_ONLY_NOT_VALIDATED'
assert data['deployment_approved'] is False
assert len(data['benchmarks']) == 3
assert {r['horizon_hours'] for r in data['benchmarks']} == {24,48,72}
assert len(data['station_evidence']) == 6
assert sum(s['peak_level_2017_mPWD'] > s['danger_level_2017_mPWD'] for s in data['station_evidence']) == 5
for r in data['benchmarks']:
    assert 0 <= r['precision_at_05_proxy'] <= 1
    assert r['brier_proxy'] > r['baseline_brier']
assert 'CompetitionEvidence' in (p/'frontend/src/ModelEvidence.jsx').read_text()
assert 'Know before you act:' in (p/'frontend/src/App.jsx').read_text()
assert 'Research methods and evidence' in (p/'frontend/src/App.jsx').read_text()
assert '{ id: "model-evidence"' not in (p/'frontend/src/App.jsx').read_text()
print('PASS: 2026 research evidence remains visibly experimental')
