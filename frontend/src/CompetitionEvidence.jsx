import React, { useEffect, useState } from "react";

const EVIDENCE_URL = "/data/haorshield_official_station_research.json";
const pct = (value) => `${(100 * value).toFixed(1)}%`;

export default function CompetitionEvidence() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(EVIDENCE_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Research evidence file unavailable");
        return response.json();
      })
      .then((value) => {
        if (value.status !== "RESEARCH_ONLY_NOT_VALIDATED" ||
            value.deployment_approved !== false ||
            value.benchmarks?.length !== 3 ||
            value.station_evidence?.length !== 6) {
          throw new Error("Research evidence failed integrity checks");
        }
        setData(value);
      })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4" aria-label="2026 research benchmark and official historical context">
      <div>
        <h3 className="font-bold text-xl text-slate-900">2026 Research Update: 24/48/72-hour Models</h3>
        <p className="text-sm text-slate-700 mt-2">
          Three Random Forest models were trained with chronological holdouts. The results below
          are measured against <strong>unverified research labels</strong>, not observed future floods.
          These models are not connected to the public warning service.
        </p>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-500">Loading research results…</p>}
      {data && <>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="text-left text-slate-600 pb-2">Out-of-time research proxy results (not real flood forecast skill)</caption>
            <thead><tr className="border-b bg-slate-50">
              <th className="p-2">Horizon</th><th className="p-2">AUC</th><th className="p-2">Precision</th>
              <th className="p-2">Recall</th><th className="p-2">False alerts</th><th className="p-2">Brier (model / baseline)</th>
            </tr></thead>
            <tbody>{data.benchmarks.map((r) => <tr key={r.horizon_hours} className="border-b">
              <td className="p-2 font-semibold">{r.horizon_hours}h</td><td className="p-2">{r.roc_auc_proxy.toFixed(3)}</td>
              <td className="p-2">{pct(r.precision_at_05_proxy)}</td><td className="p-2">{pct(r.recall_at_05_proxy)}</td>
              <td className="p-2">{r.FP_proxy.toLocaleString("en-US")}</td>
              <td className="p-2">{r.brier_proxy.toFixed(3)} / {r.baseline_brier.toFixed(3)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-xl">
          The model Brier score is worse than the prevalence baseline for every horizon.
          AUC and recall alone do not demonstrate a calibrated flood probability.
          Some research discharge features are missing for most test samples.
        </p>
        <div>
          <h4 className="font-semibold text-slate-900">FFWC 2017 river-station context</h4>
          <p className="text-sm text-slate-700 mt-1">Five of six stations had annual peaks above their reported danger levels. Those summaries do not provide dates for verified future flood/non-flood labels.</p>
          <div className="overflow-x-auto mt-2"><table className="text-sm w-full text-left">
            <thead><tr className="border-b bg-slate-50"><th className="p-2">Station</th><th className="p-2">Danger level (mPWD)</th><th className="p-2">2017 peak (mPWD)</th><th className="p-2">Days above danger</th></tr></thead>
            <tbody>{data.station_evidence.map((s) => <tr className="border-b" key={s.station_id}>
              <td className="p-2">{s.station_name}</td><td className="p-2">{s.danger_level_2017_mPWD.toFixed(2)}</td>
              <td className="p-2">{s.peak_level_2017_mPWD.toFixed(2)}</td>
              <td className="p-2">{s.days_above_danger_2017 ?? "Not reported"}</td>
            </tr>)}</tbody>
          </table></div>
          <p className="text-xs text-slate-500 mt-2">{data.source_note} {data.station_warning}</p>
        </div>
      </>}
    </section>
  );
}
