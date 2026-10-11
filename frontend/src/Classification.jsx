import React, { useEffect, useState } from "react";
import {
  BrainCircuit,
  AlertCircle,
  CheckCircle2,
  RotateCcw
} from "lucide-react";

const FEATURE_GROUPS = [
  {
    title: "Sentinel-1 Radar",
    description: "Radar observations before and during the event",
    fields: [
      ["VV_pre", "VV Before"],
      ["VH_pre", "VH Before"],
      ["VV_during", "VV During"],
      ["VH_during", "VH During"],
      ["VV_change", "VV Change"],
      ["VH_change", "VH Change"]
    ]
  },
  {
    title: "Weather and Soil",
    description: "Historical environmental measurements",
    fields: [
      ["rain_1d_mm", "Rainfall — 1 day (mm)"],
      ["rain_3d_mm", "Rainfall — 3 days (mm)"],
      ["rain_7d_mm", "Rainfall — 7 days (mm)"],
      ["rain_30d_mm", "Rainfall — 30 days (mm)"],
      ["temperature_24h_c", "Temperature (°C)"],
      ["soil_moisture_24h", "Soil Moisture"]
    ]
  },
  {
    title: "Terrain",
    description: "Elevation and slope",
    fields: [
      ["elevation_m", "Elevation (m)"],
      ["slope_deg", "Slope (degrees)"]
    ]
  }
];

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const initialValues = Object.fromEntries(
  FEATURE_GROUPS.flatMap((group) =>
    group.fields.map(([name]) => [name, ""])
  )
);

export default function Classification() {
  const [values, setValues] = useState(initialValues);
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/data/demo_samples.json")
      .then((res) => {
        if (!res.ok) throw new Error("Demo samples unavailable");
        return res.json();
      })
      .then(setSamples)
      .catch((err) => setError(err.message));
  }, []);

  const loadSample = (index) => {
    setSelectedSample(index);

    if (index === "") {
      setValues(initialValues);
    } else {
      const sample = samples[Number(index)];

      setValues(
        Object.fromEntries(
          Object.entries(sample.features).map(
            ([key, value]) => [key, String(value)]
          )
        )
      );
    }

    setResult(null);
    setError("");
  };

  const updateValue = (name, value) => {
    setValues((previous) => ({
      ...previous,
      [name]: value
    }));
    setSelectedSample("");
    setResult(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    const payload = {};

    for (const [name, value] of Object.entries(values)) {
      if (value.trim() === "") {
        setError(`Please provide a value for ${name}.`);
        return;
      }

      const parsed = Number(value);

      if (!Number.isFinite(parsed)) {
        setError(`${name} must be a finite number.`);
        return;
      }

      payload[name] = parsed;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "The API rejected the input."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        `${err.message} Check that the HaorShield API is running.`
      );
    } finally {
      setLoading(false);
    }
  };

  const probability = result
    ? Number(result.flood_detection_probability) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <BrainCircuit className="text-cyan-700" size={30} />
          <h2 className="text-2xl font-bold">
            Historical Flood Classification
          </h2>
        </div>
        <p className="text-slate-500 text-sm mt-3">
          Classify historical observations using the trained
          HaorShield Random Forest model.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertCircle size={19} className="shrink-0 mt-0.5" />
          <p>
            This is retrospective classification, not flood
            forecasting. During-event radar observations are
            required. A negative result means MODIS flood
            was not detected, not that the location was
            confirmed dry.
          </p>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_340px] gap-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <label className="block text-sm font-semibold mb-2">
              Try a Historical Example
            </label>
            <select
              value={selectedSample}
              onChange={(e) => loadSample(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 bg-white text-sm"
            >
              <option value="">Enter values manually</option>
              {samples.map((sample, index) => (
                <option key={index} value={String(index)}>
                  {sample.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              Examples come from the historical dataset
              used to train the final model. They are
              demonstrations, not independent test cases.
            </p>
          </div>

          {FEATURE_GROUPS.map((group) => (
            <div
              key={group.title}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
            >
              <h3 className="font-semibold">{group.title}</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                {group.description}
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {group.fields.map(([name, label]) => (
                  <label key={name} className="block">
                    <span className="block text-sm text-slate-600 mb-2">
                      {label}
                    </span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={values[name]}
                      onChange={(e) =>
                        updateValue(name, e.target.value)
                      }
                      placeholder={name}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-cyan-700 text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-60"
            >
              {loading ? "Classifying..." : "Run Classification"}
            </button>

            <button
              type="button"
              onClick={() => {
                setValues(initialValues);
                setSelectedSample("");
                setResult(null);
                setError("");
              }}
              className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Clear
            </button>
          </div>
        </form>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h3 className="font-semibold text-lg">
              Classification Result
            </h3>

            {result ? (
              <div className="mt-6 space-y-5">
                <div className="flex items-center gap-2 text-cyan-700">
                  <CheckCircle2 size={20} />
                  <span className="text-sm font-medium">
                    Classification completed
                  </span>
                </div>

                <p className="text-lg font-bold">
                  {result.classification}
                </p>

                <div>
                  <p className="text-sm text-slate-500">
                    Model-estimated flood-detection probability
                  </p>
                  <p className="text-4xl font-bold mt-2">
                    {probability.toFixed(2)}%
                  </p>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden mt-4">
                    <div
                      className="h-full bg-cyan-600 rounded-full"
                      style={{
                        width: `${Math.max(
                          0, Math.min(100, probability)
                        )}%`
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Model: {result.model}
                  <br />
                  Classification threshold: {result.threshold}
                </p>

                <p className="text-xs text-slate-500 leading-relaxed">
                  {result.interpretation}
                  The probability is a model score and is
                  not independently validated as a calibrated
                  real-world flood likelihood.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-5">
                Enter all 14 features or select a historical
                example, then run classification.
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          <div className="bg-slate-100 rounded-2xl p-5">
            <h3 className="font-semibold text-sm">
              Model Information
            </h3>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Random Forest trained on 6,000 historical
              samples from three flood events. The final
              exported model has no independent held-out
              test evaluation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
