import React, { useEffect, useMemo, useState } from "react";

const DATA_URL = "/data/haorshield_ffwc_stations.json";

const curveLabel = (value) => {
  if (value === true) return "Curve noted in source";
  if (value === false) return "No curve recorded";
  return "Not specified";
};

export default function FFWCStationExplorer() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [river, setRiver] = useState("All Rivers");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(DATA_URL, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("FFWC station references unavailable.");
        }

        const result = await response.json();

        if (
          !Array.isArray(result.stations) ||
          result.stations.length === 0 ||
          result.contains_live_water_levels !== false ||
          result.contains_live_official_forecasts !== false
        ) {
          throw new Error("Invalid FFWC station reference data.");
        }

        setData(result);
        setError("");
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Unable to load references.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => controller.abort();
  }, []);

  const rivers = useMemo(() => {
    if (!data) return [];

    return [...new Set(
      data.stations.map((item) => item.river).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];

    const text = query.trim().toLowerCase();

    return data.stations.filter((station) => {
      const matchesRiver =
        river === "All Rivers" || station.river === river;

      const searchable = [
        station.official_station_code,
        station.station_location,
        station.river,
        station.ffwc_issue_date,
        station.ffwc_experimental_label
      ].filter(Boolean).join(" ").toLowerCase();

      return matchesRiver &&
        (!text || searchable.includes(text));
    });
  }, [data, query, river]);

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          FFWC Station Reference Explorer
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Explore station locations, river names and station
          codes recorded in the project's FFWC bulletin inventory.
          This is historical reference information, not a live
          water-level or flood-forecast monitoring service.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-slate-600">
          Loading FFWC station references...
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Search station location or code
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search location, river or station code"
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              River
              <select
                value={river}
                onChange={(event) => setRiver(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3"
              >
                <option value="All Rivers">All Rivers</option>
                {rivers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-sm text-slate-600">
            Showing {filtered.length} of {data.station_count}
            {" "}station references.
          </p>

          <div className="grid max-h-[500px] gap-3 overflow-y-auto md:grid-cols-2">
            {filtered.map((station, index) => (
              <article
                key={`${station.official_station_code || "station"}-${index}`}
                className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <h3 className="font-semibold text-slate-900">
                  {station.station_location ||
                    station.official_station_code ||
                    "Unnamed station"}
                </h3>

                {station.official_station_code && (
                  <p className="text-sm text-slate-600">
                    Station code: {station.official_station_code}
                  </p>
                )}

                {station.river && (
                  <p className="text-sm text-slate-600">
                    River: {station.river}
                  </p>
                )}

                {station.ffwc_issue_date && (
                  <p className="text-sm text-slate-600">
                    Source bulletin date: {station.ffwc_issue_date}
                  </p>
                )}

                <p className="text-sm text-slate-600">
                  Forecast curve:{" "}
                  {curveLabel(
                    station.contains_future_forecast_curve
                  )}
                </p>

                {station.ffwc_experimental_label && (
                  <p className="text-sm text-slate-600">
                    Source label: {station.ffwc_experimental_label}
                  </p>
                )}

                {station.source_type && (
                  <p className="text-xs text-slate-500">
                    Source type: {station.source_type}
                  </p>
                )}
              </article>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-slate-600">
              No matching records were found in this inventory.
            </p>
          )}

          <div
            role="note"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
          >
            <strong>Reference information only.</strong>{" "}
            FFWC station codes, locations and bulletin dates are
            reproduced from the attached inventory. No current
            station readings, verified district assignments or
            live official numeric forecasts are included.
          </div>

          <a
            href="https://ffwc.gov.bd/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-medium text-blue-700 underline"
          >
            Visit Bangladesh FFWC for current official information
          </a>
        </>
      )}
    </section>
  );
}
