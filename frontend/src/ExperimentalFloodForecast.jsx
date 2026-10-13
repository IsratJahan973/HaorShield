
import React, { useEffect, useState } from "react";

const URL = "/data/haorshield_experimental_flood_forecasts.json";
const HORIZONS = [24, 48, 72];

export default function ExperimentalFloodForecast() {
  const [data, setData] = useState(null);
  const [stationId, setStationId] = useState("SW267");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${URL}?t=${Date.now()}`, {
      signal: controller.signal,
      cache: "no-store"
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Station forecast data unavailable");
        }
        return response.json();
      })
      .then((json) => {
        if (
          json.status !== "EXPERIMENTAL_NOT_VALIDATED" ||
          !Array.isArray(json.scores) ||
          json.scores.length !== 6
        ) {
          throw new Error("Unexpected forecast data format");
        }

        for (const station of json.scores) {
          for (const hours of HORIZONS) {
            const score = station[`experimental_${hours}h_score_pct`];
            if (
              typeof score !== "number" ||
              !Number.isFinite(score) ||
              score < 0 || score > 100
            ) {
              throw new Error("Invalid experimental model score");
            }
          }
        }

        setData(json);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load forecast");
        }
      });

    return () => controller.abort();
  }, []);

  const issued = data ? new Date(data.issued_at) : null;
  const ageHours = issued
    ? (Date.now() - issued.getTime()) / 3600000
    : Infinity;
  const stale =
    !Number.isFinite(ageHours) ||
    ageHours < -1 ||
    ageHours > 12;

  const selected = data?.scores.find(
    (item) => item.station_id === stationId
  ) || data?.scores[0];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Experimental 24/48/72-hour flood forecast
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Research model estimates for six river reference stations.
          This is separate from the location-specific rainfall screening
          result above.
        </p>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Experimental — not a validated flood probability.</strong>
        {" "}These model scores estimate future flood-label occurrence
        in an external research dataset. They are not official warnings,
        measured inundation, or confirmation that an area is safe.
        Upcoming forecast rainfall and live river levels are not yet
        included in this model.
      </div>

      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}

      {!data && !error && (
        <p className="text-slate-500">Loading station forecasts...</p>
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="reference-station"
              className="font-semibold text-sm"
            >
              Reference river station
            </label>

            <select
              id="reference-station"
              value={selected.station_id}
              onChange={(event) => setStationId(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              {data.scores.map((item) => (
                <option
                  key={item.station_id}
                  value={item.station_id}
                >
                  {item.station}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-slate-500">
            Selected reference coordinates:{" "}
            {Number(selected.latitude).toFixed(4)},{" "}
            {Number(selected.longitude).toFixed(4)}.
            This station is not automatically matched to your
            selected village or GPS location.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {HORIZONS.map((hours) => (
              <div
                key={hours}
                className="rounded-xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-sm text-slate-600">
                  Next {hours} hours
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {selected[
                    `experimental_${hours}h_score_pct`
                  ].toFixed(2)}%
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Experimental model score, not verified flood probability
                </p>
              </div>
            ))}
          </div>

          <p className="text-sm text-slate-600">
            Model update:{" "}
            {Number.isNaN(issued.getTime())
              ? "Invalid timestamp"
              : issued.toLocaleString("en-BD", {
                  timeZone: "Asia/Dhaka",
                  dateStyle: "medium",
                  timeStyle: "short"
                })}
          </p>

          {stale && (
            <p
              role="alert"
              className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900"
            >
              This forecast is stale or its timestamp is invalid.
              Do not rely on these scores for current conditions.
            </p>
          )}
        </>
      )}

      <p className="text-sm text-slate-600">
        For operational flood and river-level warnings, consult the{" "}
        <a
          href="https://ffwc.gov.bd/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-blue-700"
        >
          Bangladesh Flood Forecasting & Warning Centre
        </a>.
      </p>
    </section>
  );
}
