import React, { useEffect, useMemo, useState } from "react";

const URL = "/data/haorshield_model_evidence.json";

export default function ModelEvidence() {
  const [data, setData] = useState(null);
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
            development. A fair, untouched same-split benchmark
            across Random Forest, HaorShieldNet and XGBoost is
            not verified by these saved records.
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
