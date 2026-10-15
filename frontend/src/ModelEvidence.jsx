import React, { useEffect, useMemo, useState } from "react";

const URL = "/data/haorshield_model_evidence.json";
const BENCHMARK_URL = "/data/haorshield_model_benchmark.json";

export default function ModelEvidence() {
  const [data, setData] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [benchmarkError, setBenchmarkError] = useState("");
  const [error, setError] = useState("");
  const [hours, setHours] = useState("all");
  const [year, setYear] = useState("all");

  useEffect(() => {
    fetch(URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Model evidence unavailable.");
        }
        return response.json();
      })
      .then((result) => {
        if (
          !Array.isArray(result.rows) ||
          result.protocol?.independent_operational_test !== false
        ) {
          throw new Error("Invalid model evidence.");
        }
        setData(result);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    fetch(BENCHMARK_URL)
      .then(response => {
        if (!response.ok) throw new Error("Comparable research metrics unavailable.");
        return response.json();
      })
      .then(value => {
        if (
          value.fair_same_split_research_comparison !== true ||
          value.independent_operational_test !== false ||
          !Array.isArray(value.results) || value.results.length !== 24
        ) {
          throw new Error("Research benchmark failed validation.");
        }
        setBenchmark(value);
      })
      .catch(err => setBenchmarkError(err.message));
  }, []);

  const rows = useMemo(() => {
    return (data?.rows || []).filter(
      (r) =>
        (hours === "all" || String(r.horizon) === hours) &&
        (year === "all" || String(r.test_year) === year)
    );
  }, [data, hours, year]);

  return (
    <section className="space-y-5">
      <div className="rounded-xl border bg-white p-5">
        <h2 className="text-2xl font-bold">
          Model Evidence and Limitations
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Actual saved research diagnostics for SAR candidate
          targets. They do not establish independently verified
          24/48/72-hour flood forecasting accuracy.
        </p>
      </div>

      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading model evidence...</p>}

      {data && (
        <>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            <strong>Independent accuracy not established.</strong>
            {" "}The evaluation years were reviewed during model
            development. The same-split research comparison below
            compares RF, XGBoost and a reconstructed HaorShieldNet-style
            neural network, but it is NOT untouched independent testing
            and does NOT establish actual future flood accuracy.
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="text-lg font-bold">Reproducible research comparison — same time split</h3>
            <p className="text-sm text-slate-700">
              2016–2022 training, 2023 model selection, 2024 and 2025 diagnostic evaluation.
              All four methods use the same date-based partitions and surrogate SAR candidate target.
              A historical-cell baseline, Random Forest, XGBoost and a reconstructed
              HaorShieldNet-style network are compared. Original HaorShieldNet weights were unavailable.
              <strong> These are not operational flood-prediction accuracy scores.</strong>
            </p>
            {benchmarkError && <p role="status" className="text-amber-900">{benchmarkError}</p>}
            {benchmark ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead><tr className="border-b bg-slate-50">
                    <th className="p-2">Horizon</th><th className="p-2">Evaluation year</th>
                    <th className="p-2">Research method</th><th className="p-2">MAE ↓</th>
                    <th className="p-2">Records</th>
                  </tr></thead>
                  <tbody>
                    {benchmark.results.map((r, i) => (
                      <tr className="border-b" key={i}>
                        <td className="p-2">{r.horizon_hours}h</td>
                        <td className="p-2">{r.evaluation_year}</td>
                        <td className="p-2">{r.model}</td>
                        <td className="p-2">{r.mae.toFixed(4)}</td>
                        <td className="p-2">{r.records}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !benchmarkError && <p className="text-sm">Loading research benchmark…</p>}
            <p className="text-xs text-amber-900">
              Dataset labels are unverified SAR change candidates, not observed future inundation;
              earlier research already examined these test years. Same-split research comparison
              is not independent or calibrated validation. Reproduction files are stored under
              <code>research/</code> and <code>scripts/reproduce_sar_proxy_benchmark.py</code>.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <label>
              Horizon{" "}
              <select
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="rounded border p-2"
              >
                <option value="all">All</option>
                {[24, 48, 72].map((h) => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>
            </label>

            <label>
              Research test year{" "}
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="rounded border p-2"
              >
                <option value="all">All</option>
                {[2024, 2025].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white p-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  {[
                    "Horizon", "Year", "Variant", "MAE",
                    "AP", "Records", "Dates"
                  ].map((heading) => (
                    <th key={heading} className="p-2">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{r.horizon}h</td>
                    <td className="p-2">{r.test_year}</td>
                    <td className="p-2">{r.variant}</td>
                    <td className="p-2">{r.mae.toFixed(4)}</td>
                    <td className="p-2">{r.ap.toFixed(4)}</td>
                    <td className="p-2">{r.test_records}</td>
                    <td className="p-2">{r.test_dates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-white p-5 text-sm">
            <p><strong>Source:</strong> {data.source_file}</p>
            {data.warnings?.map((warning, i) => (
              <p className="mt-2" key={i}>{warning}</p>
            ))}
            <p className="mt-3">
              The retrospective MODIS Random Forest classifier
              elsewhere on this website uses a different target.
              Its results cannot be directly ranked against
              SAR candidate research scores.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
