
import React, { useEffect, useState } from "react";

const NEW_URL =
  "/data/haorshield_future_rain_experimental.json";
const OLD_URL =
  "/data/haorshield_experimental_flood_forecasts.json";

const HORIZONS = [24, 48, 72];

export default function ExperimentalFloodForecast() {
  const [data, setData] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [stationId, setStationId] = useState("SW267");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(
      () => setRefreshKey(Date.now()),
      15 * 60 * 1000
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      for (const [url, fallback] of [
        [NEW_URL, false],
        [OLD_URL, true]
      ]) {
        try {
          const response = await fetch(
            `${url}?refresh=${refreshKey}`,
            { cache: "no-store", signal: controller.signal }
          );

          if (!response.ok) {
            throw new Error("Forecast file unavailable");
          }

          const json = await response.json();

          if (
            json.status !== "EXPERIMENTAL_NOT_VALIDATED" ||
            !Array.isArray(json.scores) ||
            json.scores.length !== 6
          ) {
            throw new Error("Invalid forecast structure");
          }

          if (
            !fallback &&
            json.future_rainfall_used_as_predictor !== true
          ) {
            throw new Error("Forecast rainfall not included");
          }

          for (const station of json.scores) {
            for (const hours of HORIZONS) {
              const value =
                station[`experimental_${hours}h_score_pct`];
              if (
                typeof value !== "number" ||
                !Number.isFinite(value) ||
                value < 0 || value > 100
              ) {
                throw new Error("Invalid model score");
              }

              if (!fallback) {
                const rain = station[`forecast_rain_${hours}h_mm`];
                if (
                  typeof rain !== "number" ||
                  !Number.isFinite(rain) ||
                  rain < 0
                ) {
                  throw new Error("Invalid forecast rainfall");
                }
              }
            }
          }

          setData(json);
          setUsingFallback(fallback);
          setError("");
          return;

        } catch (err) {
          if (err.name === "AbortError") return;
        }
      }

      setData(null);
      setError("Forecast station data unavailable.");
    }

    load();

    return () => controller.abort();
  }, [refreshKey]);

  const selected = data?.scores.find(
    s => s.station_id === stationId
  ) || data?.scores[0];

  const issued = data ? new Date(data.issued_at) : null;
  const issueValid =
    issued && Number.isFinite(issued.getTime());

  const age = issueValid
    ? (Date.now() - issued.getTime()) / 3600000
    : Infinity;

  const stale = age < -1 || age > 12;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold">
          Experimental Flood-Risk Model
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Research estimates for six river reference stations,
          separate from your selected location's rainfall forecast.
        </p>
      </div>

      <div
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      >
        <strong>Research model — not validated flood probability.</strong>
        {" "}Its flood labels and probability calibration have
        important limitations. These scores are not official warnings,
        inundation forecasts or confirmation of safety.
      </div>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!data && !error && <p>Loading experimental forecasts...</p>}

      {data && (
        <>
          {usingFallback ? (
            <p className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm">
              Showing the earlier past-rainfall experimental model.
              The forecast-rainfall-enhanced model is unavailable.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              This experimental model includes upcoming ECMWF rainfall.
              Its forecast period begins at 00:00 Bangladesh time on{" "}
              <strong>{data.target_window_start_local}</strong>.
              It does not represent rolling windows beginning now.
            </p>
          )}

          {(stale || !issueValid) && (
            <p role="alert" className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm">
              These model scores are outdated or their timestamp
              cannot be verified. Do not rely on them for current conditions.
            </p>
          )}

          <label className="block space-y-2 text-sm font-semibold">
            Reference river station
            <select
              value={selected.station_id}
              onChange={e => setStationId(e.target.value)}
              className="block rounded-lg border border-slate-300 bg-white px-4 py-3"
            >
              {data.scores.map(s => (
                <option key={s.station_id} value={s.station_id}>
                  {s.station}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-slate-500">
            Station reference:{" "}
            {Number(selected.latitude).toFixed(4)},{" "}
            {Number(selected.longitude).toFixed(4)}.
            This station is not automatically matched to your GPS
            location or village.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {HORIZONS.map(hours => (
              <div
                key={hours}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm font-semibold">
                  {hours}-hour research horizon
                </p>
                {!usingFallback && (
                  <p className="mt-2 text-sm text-slate-600">
                    Forecast rainfall:{" "}
                    <strong>
                      {selected[`forecast_rain_${hours}h_mm`].toFixed(1)}
                      {" "}mm
                    </strong>
                  </p>
                )}
                <p className="mt-3 text-3xl font-bold">
                  {selected[
                    `experimental_${hours}h_score_pct`
                  ].toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Experimental model score — not a verified
                  real-world flood probability
                </p>
              </div>
            ))}
          </div>

          <p className="text-sm text-slate-600">
            Last model update:{" "}
            {issueValid
              ? issued.toLocaleString("en-BD", {
                  timeZone: "Asia/Dhaka",
                  dateStyle: "medium",
                  timeStyle: "short"
                })
              : "Unavailable"}
          </p>

          <p className="text-sm">
            For operational warnings, consult{" "}
            <a
              href="https://ffwc.gov.bd/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline"
            >
              Bangladesh FFWC
            </a>.
          </p>
        </>
      )}
    </section>
  );
}
