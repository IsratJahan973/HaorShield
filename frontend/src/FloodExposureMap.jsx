import FFWCStationExplorer from "./FFWCStationExplorer.jsx";
import AgriculturalDecisionGuide from "./AgriculturalDecisionGuide.jsx";
import HydrologicalExposure from "./HydrologicalExposure";

import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer, TileLayer, GeoJSON, useMap
} from "react-leaflet";

const MAP_URL = "/data/haorshield_cropland_rainfall_screening.geojson";
const SUMMARY_URL =
  "/data/haorshield_cropland_rainfall_screening_summary.json";

const HORIZONS = [24, 48, 72];

const fmt = (number, digits = 0) =>
  Number(number).toLocaleString("en-BD", {
    maximumFractionDigits: digits
  });

const getDate = (text) => {
  const parsed = new Date(text || "");
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

function FitBounds({ features }) {
  const map = useMap();

  useEffect(() => {
    if (!features?.length) return;

    const bounds = L.geoJSON({
      type: "FeatureCollection",
      features
    }).getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [18, 18],
        maxZoom: 11
      });
    }
  }, [map, features]);

  return null;
}

function CellMap({ features, hours }) {
  const geojson = useMemo(() => ({
    type: "FeatureCollection",
    features
  }), [features]);

  return (
    <div className="h-[480px] overflow-hidden rounded-xl border border-slate-200">
      <MapContainer
        center={[24.65, 91.5]}
        zoom={8}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds features={features} />
        <GeoJSON
          key={`${hours}-${features.length}`}
          data={geojson}
          style={(feature) => {
            const elevated =
              feature?.properties?.[
                `elevated_rainfall_${hours}h`
              ] === true;

            return {
              color: elevated ? "#b45309" : "#64748b",
              weight: elevated ? 1.6 : 0.8,
              fillColor: elevated ? "#f59e0b" : "#94a3b8",
              fillOpacity: elevated ? 0.65 : 0.18
            };
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties || {};
            const rain = Number(p[`rain${hours}_mm`]);
            const crop = Number(p.mapped_cropland_ha);
            const label = p[`screening${hours}`] || "Unclassified";

            const safeDistrict = String(p.district || "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");

            layer.bindPopup(`
              <strong>${safeDistrict}</strong><br/>
              Cell: ${String(p.cell_id || "")}<br/>
              ${hours}h forecast rainfall:
              ${Number.isFinite(rain) ? fmt(rain, 1) : "Unavailable"} mm<br/>
              Rainfall screening: ${label}<br/>
              Mapped cropland:
              ${Number.isFinite(crop) ? fmt(crop, 2) : "Unavailable"} ha<br/>
              <small>Not predicted inundation.</small>
            `);
          }}
        />
      </MapContainer>
    </div>
  );
}

function OriginalFloodExposureMap() {
  const [geo, setGeo] = useState(null);
  const [summary, setSummary] = useState(null);
  const [hours, setHours] = useState(72);
  const [district, setDistrict] = useState("All Districts");
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Poll to detect new publicly deployed GitHub forecast files.
  useEffect(() => {
    const interval = setInterval(
      () => setLastRefresh(Date.now()),
      15 * 60 * 1000
    );
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch(`${MAP_URL}?v=${lastRefresh}`, {
        cache: "no-store",
        signal: controller.signal
      }),
      fetch(`${SUMMARY_URL}?v=${lastRefresh}`, {
        cache: "no-store",
        signal: controller.signal
      })
    ])
      .then(async ([mapResponse, summaryResponse]) => {
        if (!mapResponse.ok || !summaryResponse.ok) {
          throw new Error("Live geographic forecast data unavailable.");
        }

        const [mapData, summaryData] = await Promise.all([
          mapResponse.json(),
          summaryResponse.json()
        ]);

        if (
          mapData.type !== "FeatureCollection" ||
          mapData.features?.length !== 306
        ) {
          throw new Error("The geographic grid is incomplete.");
        }

        if (
          !summaryData.horizons ||
          summaryData.is_flood_inundation_prediction !== false ||
          summaryData.predicted_flooded_cropland_ha !== null
        ) {
          throw new Error("Unexpected cropland-screening data format.");
        }

        for (const feature of mapData.features) {
          const p = feature.properties || {};
          const crop = Number(p.mapped_cropland_ha);

          if (!Number.isFinite(crop) || crop < 0) {
            throw new Error("Missing geographic cropland data.");
          }

          for (const h of HORIZONS) {
            const rain = Number(p[`rain${h}_mm`]);

            if (
              !Number.isFinite(rain) ||
              rain < 0 ||
              typeof p[`elevated_rainfall_${h}h`] !== "boolean"
            ) {
              throw new Error("Invalid geographic rainfall data.");
            }
          }
        }

        setGeo(mapData);
        setSummary(summaryData);
        setError("");
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Unable to load map.");
          setGeo(null);
          setSummary(null);
        }
      });

    return () => controller.abort();
  }, [lastRefresh]);

  const districts = useMemo(() => {
    if (!geo) return [];
    return [...new Set(
      geo.features.map((feature) => feature.properties.district)
    )].sort();
  }, [geo]);

  const features = useMemo(() => {
    if (!geo) return [];

    return geo.features.filter((feature) =>
      district === "All Districts" ||
      feature.properties.district === district
    );
  }, [geo, district]);

  const stats = useMemo(() => {
    let mappedCropland = 0;
    let screenedCropland = 0;
    let screeningAreaKm2 = 0;
    let elevatedCells = 0;

    for (const feature of features) {
      const p = feature.properties;
      const cropHa = Number(p.mapped_cropland_ha);
      mappedCropland += cropHa;

      if (p[`elevated_rainfall_${hours}h`] === true) {
        screenedCropland += cropHa;
        screeningAreaKm2 += Number(p.area_km2) || 0;
        elevatedCells += 1;
      }
    }

    return {
      mappedCropland,
      screenedCropland,
      screeningAreaKm2,
      elevatedCells,
      totalCells: features.length
    };
  }, [features, hours]);

  const issued = getDate(summary?.generated_at);
  const hoursOld = issued
    ? (Date.now() - issued.getTime()) / 3600000
    : Infinity;
  const stale = hoursOld < -1 || hoursOld > 12;
  const timestampsMatch =
    summary?.generated_at === geo?.metadata?.generated_at;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Geographic Rainfall & Cropland Screening
        </h2>
        <p className="mt-2 text-slate-600">
          Next 24/48/72-hour rainfall screening across seven
          districts, linked to ESA WorldCover 2021 cropland.
        </p>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Not a flood-inundation forecast.</strong>
        {" "}Highlighted cells indicate elevated forecast rainfall
        under the project's screening rules. Cropland hectares
        refer to mapped cropland inside those cells—not hectares
        predicted to flood. Low rainfall does not rule out
        flooding caused by upstream flow or rising river levels.
      </div>

      {error && (
        <p role="alert" className="text-red-700">{error}</p>
      )}

      {!geo && !error && (
        <p>Loading the current geographic screening map...</p>
      )}

      {geo && summary && (
        <>
          {(!timestampsMatch || stale) && (
            <div
              role="alert"
              className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900"
            >
              {!timestampsMatch
                ? "The map and summary have different update timestamps. Data may not be synchronized."
                : "The rainfall forecast is older than 12 hours or has an invalid timestamp. Treat this map as stale."}
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-end">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Forecast horizon
              <select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                {HORIZONS.map((h) => (
                  <option value={h} key={h}>{h} hours</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold">
              District
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option>All Districts</option>
                {districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Mapped cropland", `${fmt(stats.mappedCropland)} ha`],
              ["Rainfall-screened cropland", `${fmt(stats.screenedCropland)} ha`],
              ["Elevated-rainfall cells", `${stats.elevatedCells} / ${stats.totalCells}`],
              ["Screened geographic area", `${fmt(stats.screeningAreaKm2, 1)} km²`]
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>

          <CellMap features={features} hours={hours} />

          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
            <span>
              <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-amber-500" />
              Elevated-rainfall screening
            </span>
            <span>
              <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-slate-400" />
              No elevated rainfall signal
            </span>
          </div>

          <p className="text-sm text-slate-600">
            Forecast updated:{" "}
            {issued
              ? issued.toLocaleString("en-BD", {
                  timeZone: "Asia/Dhaka",
                  dateStyle: "medium",
                  timeStyle: "short"
                })
              : "Unavailable"}.
            {" "}The webpage checks for new published data every 15 minutes.
          </p>

          <p className="text-sm text-slate-600">
            Cropland source: ESA WorldCover 2021, class 40.
            The screening map contains 306 geographic cells.
            Forecast rainfall is supplied by Open-Meteo.
          </p>

          <p className="text-sm font-medium text-slate-700">
            Predicted flooded cropland: Not available.
            For official operational warnings, consult{" "}
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

export default function FloodExposureWithHydrology(props) {
  return (
    <>
      <HydrologicalExposure />
      <OriginalFloodExposureMap {...props} />
      <AgriculturalDecisionGuide />
      <FFWCStationExplorer />
    </>
  );
}
