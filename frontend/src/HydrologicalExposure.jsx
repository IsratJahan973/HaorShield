
import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const BASE = "/data/";
const HORIZONS = [24, 48, 72];

const LABELS = [
  "No elevated signal / not fully assessed",
  "Monitor historical exposure zone",
  "Elevated exposure screening",
  "Very elevated exposure screening"
];

const COLORS = ["#cbd5e1", "#fde68a", "#fb923c", "#ef4444"];

const fmt = value => {
  const n = Number(value);
  return value != null && Number.isFinite(n)
    ? n.toLocaleString("en-BD", { maximumFractionDigits: 1 })
    : "Unavailable";
};

function FitMap({ collection }) {
  const map = useMap();

  useEffect(() => {
    if (!collection?.features?.length) return;

    const bounds = L.geoJSON(collection).getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [18, 18] });
    }
  }, [collection, map]);

  return null;
}

export default function HydrologicalExposure() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [horizon, setHorizon] = useState(24);
  const [district, setDistrict] = useState("All districts");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setRefresh(v => v + 1),
      15 * 60 * 1000
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const names = [
          "haorshield_future_exposure_summary.json",
          "haorshield_future_exposure_screening.geojson",
          "haorshield_glofas_forecast.json"
        ];

        const responses = await Promise.all(
          names.map(name =>
            fetch(`${BASE}${name}?v=${refresh}`, {
              cache: "no-store",
              signal: controller.signal
            })
          )
        );

        if (responses.some(r => !r.ok)) {
          throw new Error("Forecast screening files unavailable");
        }

        const [summary, geography, hydro] =
          await Promise.all(responses.map(r => r.json()));

        if (
          summary.cell_count !== 306 ||
          geography.features?.length !== 306 ||
          hydro.stations?.length !== 6 ||
          summary.is_future_inundation_prediction !== false ||
          summary.predicted_flooded_cropland_ha !== null
        ) {
          throw new Error("Unexpected forecast data structure");
        }

        setData({ summary, geography, hydro });
        setError("");
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      }
    }

    load();
    return () => controller.abort();
  }, [refresh]);

  const districts = useMemo(() => {
    if (!data) return [];

    return [...new Set(
      data.geography.features.map(f => f.properties.district)
    )].filter(Boolean).sort();
  }, [data]);

  const selected = useMemo(() => {
    if (!data) return null;

    return {
      type: "FeatureCollection",
      features: data.geography.features.filter(
        f => district === "All districts" ||
          f.properties.district === district
      )
    };
  }, [data, district]);

  const exposure = useMemo(() => {
    if (!selected) return { cells: 0, crop: 0, land: 0 };

    const elevated = selected.features.filter(
      f => Number(f.properties[`screening_code${horizon}`]) >= 2
    );

    return {
      cells: elevated.length,
      crop: elevated.reduce(
        (sum, f) => sum + (Number(f.properties.cropland_ha) || 0),
        0
      ),
      land: elevated.reduce(
        (sum, f) =>
          sum + (
            Number(
              f.properties[`screened_historical_land_ha_${horizon}`]
            ) || 0
          ),
        0
      )
    };
  }, [selected, horizon]);

  const issued = data
    ? new Date(data.summary.generated_at)
    : null;

  const age = issued && Number.isFinite(issued.getTime())
    ? (Date.now() - issued.getTime()) / 3600000
    : Infinity;

  const stale = age < -1 || age > 12;
  const rainFresh = data?.summary.rainfall_forecast_fresh === true;

  const style = feature => {
    const value = Number(
      feature.properties[`screening_code${horizon}`]
    ) || 0;

    const band = Math.max(0, Math.min(3, value));

    return {
      color: "#64748b",
      weight: 0.5,
      fillColor: COLORS[band],
      fillOpacity: 0.65
    };
  };

  const showPopup = (feature, layer) => {
    const p = feature.properties;

    const band = Math.max(0, Math.min(3,
      Number(p[`screening_code${horizon}`]) || 0
    ));

    const rain = p[`forecast_rain${horizon}_mm`];

    layer.bindPopup(`
      <strong>${String(p.district || "Study area")}</strong>
      <br/>Cell ${Number(p.cell_id)}
      <br/>${LABELS[band]}
      <br/>Forecast rainfall:
      ${rain == null ? "Unavailable" : `${fmt(rain)} mm`}
      <br/>Modeled river-flow band:
      ${Number(p[`model_flow_band${horizon}`])}
      <br/>Cropland in entire cell:
      ${fmt(p.cropland_ha)} ha
      <br/>Reference river point:
      ${String(p.reference_station || "Unavailable")}
      <br/><em>Not predicted inundation or flood depth.</em>
    `);
  };

  return (
    <section className="mb-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <header>
        <h2 className="text-xl font-bold text-slate-900">
          Future River-Flow &amp; Land Exposure
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Forecast hydrological conditions combined with rainfall,
          historical flood locations and cropland for 306 geographic cells.
        </p>
      </header>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <strong>Experimental geographic screening.</strong>{" "}
        Screened land and cropland are areas for monitoring,
        not predicted underwater areas. This is not a validated
        flood-probability, flood-depth or inundation forecast.
        Low screening signals do not confirm safety.
      </div>

      {error &&
        <p role="alert" className="text-red-700">{error}</p>
      }

      {!data && !error &&
        <p>Loading hydrological forecast...</p>
      }

      {data && (
        <>
          {(!rainFresh || stale) && (
            <div role="alert" className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm">
              {stale
                ? "This screening is more than 12 hours old. "
                : ""}
              {!rainFresh
                ? "Rainfall was stale at generation, so this screening uses river-flow signals only. "
                : ""}
              Zero flagged cells must not be interpreted as zero flood risk.
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <label className="text-sm font-semibold">
              Forecast horizon
              <select
                value={horizon}
                onChange={e => setHorizon(Number(e.target.value))}
                className="mt-1 block rounded-lg border p-2"
              >
                {HORIZONS.map(h =>
                  <option key={h} value={h}>{h} hours*</option>
                )}
              </select>
            </label>

            <label className="text-sm font-semibold">
              District
              <select
                value={district}
                onChange={e => setDistrict(e.target.value)}
                className="mt-1 block rounded-lg border p-2"
              >
                <option>All districts</option>
                {districts.map(d =>
                  <option key={d}>{d}</option>
                )}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm">Elevated screening cells</p>
              <p className="text-2xl font-bold">
                {exposure.cells} / {selected.features.length}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm">Cropland inside flagged cells</p>
              <p className="text-2xl font-bold">
                {fmt(exposure.crop)} ha
              </p>
              <p className="text-xs">
                Not predicted flooded cropland
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm">
                Historical flood footprint in flagged cells
              </p>
              <p className="text-2xl font-bold">
                {fmt(exposure.land)} ha
              </p>
              <p className="text-xs">
                Not predicted flooded land
              </p>
            </div>
          </div>

          <div className="h-[390px] overflow-hidden rounded-xl border">
            <MapContainer
              center={[24.5, 91.2]}
              zoom={7}
              scrollWheelZoom={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitMap collection={selected} />
              <GeoJSON
                key={`${horizon}-${district}-${data.summary.generated_at}`}
                data={selected}
                style={style}
                onEachFeature={showPopup}
              />
            </MapContainer>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            {LABELS.map((label, i) => (
              <span key={label} className="flex items-center gap-1">
                <span
                  className="inline-block h-3 w-3"
                  style={{ backgroundColor: COLORS[i] }}
                />
                {label}
              </span>
            ))}
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <p>
              Last update:{" "}
              {Number.isFinite(issued.getTime())
                ? issued.toLocaleString("en-BD", {
                    timeZone: "Asia/Dhaka"
                  })
                : "Unavailable"}
            </p>
            <p>
              <strong>River model:</strong> Copernicus GloFAS v4.
              Cells are associated with the nearest of six
              reference points within 120 km, not verified
              hydrological catchments.
            </p>
            <p>
              *River forecasts represent the next 1–3 complete
              UTC days, while rainfall uses rolling forecast
              windows. These are not exactly time-aligned;
              results are coarse screening indicators.
            </p>
            <p>
              Official warnings:{" "}
              <a
                href="https://ffwc.gov.bd/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline"
              >
                Bangladesh Flood Forecasting and Warning Centre
              </a>
            </p>
          </div>
        </>
      )}
    </section>
  );
}
