import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer, TileLayer, GeoJSON, useMap
} from "react-leaflet";

const HORIZONS = [24, 48, 72];
// Illustrative geographic concern rule for experimental SAR candidate fraction.
// No calibrated probability or confirmed inundation is implied.
const CONCERN_CUTOFF = 0.10;

const MAP_URL =
  "/data/haorshield_sar_future_candidates.geojson";

const SUMMARY_URL =
  "/data/haorshield_sar_future_summary.json";

const fmt = (v) =>
  Number.isFinite(Number(v)) && v !== null && v !== ""
    ? Math.round(Number(v)).toLocaleString("en-BD") : "Unavailable";

const EXPECTED_DISTRICTS = new Set([
  "Brahmanbaria", "Habiganj", "Kishoreganj", "Moulvibazar",
  "Netrakona", "Sunamganj", "Sylhet"
]);

// Reject incomplete research datasets instead of making missing values look like zero.
function validateSpatial(mapData, summaryData) {
  if (mapData?.type !== "FeatureCollection" ||
      mapData.features?.length !== 306 ||
      summaryData?.cells !== 306 ||
      summaryData?.is_validated_flood_probability !== false ||
      summaryData?.is_validated_inundation_prediction !== false ||
      !Number.isFinite(Date.parse(summaryData.generated_at || ""))) {
    return false;
  }
  const seen = new Set();
  for (const feature of mapData.features) {
    const p = feature?.properties;
    if (!p || !EXPECTED_DISTRICTS.has(p.district) ||
        seen.has(String(p.cell_id)) ||
        !Number.isFinite(Number(p.cell_area_ha)) || Number(p.cell_area_ha) <= 0 ||
        !Number.isFinite(Number(p.cropland_ha)) || Number(p.cropland_ha) < 0 ||
        Number(p.cropland_ha) > Number(p.cell_area_ha) + 0.01) return false;
    seen.add(String(p.cell_id));
    for (const h of HORIZONS) {
      const f = Number(p[`sar_candidate_fraction_${h}h`]);
      const land = Number(p[`research_land_proxy_ha_${h}h`]);
      const crop = Number(p[`research_cropland_proxy_ha_${h}h`]);
      const rain = p[`future_rain_${h}h_mm`];
      if (!Number.isFinite(f) || f < 0 || f > 1 ||
          !Number.isFinite(land) || land < 0 ||
          !Number.isFinite(crop) || crop < 0 ||
          land > Number(p.cell_area_ha) + 0.01 ||
          crop > Number(p.cropland_ha) + 0.01 ||
          rain === null || !Number.isFinite(Number(rain)) || Number(rain) < 0) return false;
    }
  }
  return seen.size === 306 &&
    new Set(mapData.features.map(f => f.properties.district)).size === 7;
}

function FitSelected({ features }) {
  const map = useMap();

  useEffect(() => {
    if (!features.length) return;

    const bounds = L.geoJSON({
      type: "FeatureCollection",
      features
    }).getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [15, 15],
        maxZoom: 11
      });
    }
  }, [features, map]);

  return null;
}

export default function FutureSpatialOutlook({ initialDistrict = "All Districts" }) {
  const [geo, setGeo] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [hours, setHours] = useState(24);
  const [district, setDistrict] = useState(initialDistrict);

  useEffect(() => {
    setDistrict(initialDistrict);
  }, [initialDistrict]);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch(MAP_URL, { signal: controller.signal }),
      fetch(SUMMARY_URL, { signal: controller.signal })
    ])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) {
          throw new Error("Spatial research data unavailable.");
        }

        const [mapData, summaryData] =
          await Promise.all([a.json(), b.json()]);

        if (!validateSpatial(mapData, summaryData)) {
          throw new Error("Spatial data validation failed.");
        }

        setGeo(mapData);
        setSummary(summaryData);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });

    return () => controller.abort();
  }, []);

  const districts = useMemo(() => {
    if (!geo) return [];

    return [...new Set(
      geo.features.map((f) => f.properties.district)
    )].sort();
  }, [geo]);

  const features = useMemo(() => {
    if (!geo) return [];

    return geo.features.filter(
      (f) =>
        district === "All Districts" ||
        f.properties.district === district
    );
  }, [geo, district]);

  const stats = useMemo(() => {
    return features.reduce(
      (total, feature) => {
        const p = feature.properties;

        total.land += Number(
          p[`research_land_proxy_ha_${hours}h`]
        ) || 0;

        total.crop += Number(
          p[`research_cropland_proxy_ha_${hours}h`]
        ) || 0;

        total.cells++;
        const frac = Number(p[`sar_candidate_fraction_${hours}h`]);
        if (Number.isFinite(frac) && frac >= CONCERN_CUTOFF) {
          total.concernCells++;
          total.concernAreaKm2 += Number(p.cell_area_ha || 0) / 100;
          total.concernCroplandHa += Number(p.cropland_ha || 0);
        }
        total.recent7Total += Number(p.past7_mm || 0);
        total.futureRainTotal += Number(p[`future_rain_${hours}h_mm`] || 0);
        total.pastFlowTotal += Number(p.past_flow_issue_ratio || 0);
        return total;
      },
      { cells: 0, land: 0, crop: 0, concernCells: 0,
        concernAreaKm2: 0, concernCroplandHa: 0,
        recent7Total: 0, futureRainTotal: 0, pastFlowTotal: 0 }
    );
  }, [features, hours]);

  const comparisons = useMemo(() => {
    if (!geo) return [];

    return districts.map((name) => {
      const cells = geo.features.filter(
        (f) => f.properties.district === name
      );

      return {
        district: name,
        cells: cells.length,
        land: cells.reduce(
          (sum, f) =>
            sum + Number(
              f.properties[`research_land_proxy_ha_${hours}h`]
            ),
          0
        ),
        crop: cells.reduce(
          (sum, f) =>
            sum + Number(
              f.properties[`research_cropland_proxy_ha_${hours}h`]
            ),
          0
        ),
        concernAreaKm2: cells.reduce((sum, f) => {
          const p = f.properties;
          return sum + (Number(p[`sar_candidate_fraction_${hours}h`]) >= CONCERN_CUTOFF
            ? Number(p.cell_area_ha || 0) / 100 : 0);
        }, 0),
        concernCroplandHa: cells.reduce((sum, f) => {
          const p = f.properties;
          return sum + (Number(p[`sar_candidate_fraction_${hours}h`]) >= CONCERN_CUTOFF
            ? Number(p.cropland_ha || 0) : 0);
        }, 0)
      };
    }).sort((a, b) => b.crop - a.crop);
  }, [geo, districts, hours]);

  const issued = Date.parse(summary?.generated_at || "");

  const stale =
    !Number.isFinite(issued) ||
    Date.now() - issued > 12 * 3600000 ||
    issued - Date.now() > 3600000;

  const style = (feature) => {
    const value = Number(
      feature.properties[`sar_candidate_fraction_${hours}h`]
    ) || 0;

    return {
      color: "#475569",
      weight: 0.5,
      fillOpacity: 0.7,
      fillColor:
        value >= 0.5 ? "#991b1b" :
        value >= 0.25 ? "#ea580c" :
        value >= 0.1 ? "#facc15" :
        "#bfdbfe"
    };
  };

  const onEachFeature = (feature, layer) => {
    const p = feature.properties;

    const fraction = Number(
      p[`sar_candidate_fraction_${hours}h`]
    );

    layer.bindPopup(`
      <strong>${p.district}</strong><br/>
      Grid cell: ${p.cell_id}<br/>
      SAR candidate fraction: ${(fraction * 100).toFixed(1)}%<br/>
      Land scenario proxy: ${fmt(
        p[`research_land_proxy_ha_${hours}h`]
      )} ha<br/>
      Cropland scenario proxy: ${fmt(
        p[`research_cropland_proxy_ha_${hours}h`]
      )} ha<br/>
      Forecast rainfall: ${Number(p[`future_rain_${hours}h_mm`] || 0).toFixed(1)} mm<br/>
      Antecedent 7-day rainfall: ${Number(p.past7_mm || 0).toFixed(1)} mm<br/>
      <em>Hydrological context is a proxy, not an official station forecast.</em><br/>
      <em>Not verified flooded area or probability.</em>
    `);
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="text-2xl font-bold">
          Experimental 24/48/72-hour Spatial Outlook
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Experimental Sentinel-1 SAR candidate scenarios
          across 306 geographic cells in seven districts.
          Colours represent research candidate fractions,
          not calibrated flood probabilities.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Research data generated: {summary?.generated_at
            ? new Date(summary.generated_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) + " Bangladesh time"
            : "Unavailable"}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Forecast issue anchor:{" "}
          {summary?.issue_anchor_date_utc || "Unavailable"}
          {" "}UTC
        </p>
      </div>

      {error && (
        <p role="alert" className="text-red-700">{error}</p>
      )}

      {!geo && !error && (
        <p>Loading experimental spatial map...</p>
      )}

      {geo && summary && (
        <>
          {stale && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"
            >
              <strong>Outdated experimental scenario.</strong>
              {" "}These values are not current operational
              flood warnings. Do not use them alone for
              time-sensitive decisions.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Forecast research horizon
              <select
                value={hours}
                onChange={(e) =>
                  setHours(Number(e.target.value))
                }
                className="mt-1 w-full rounded-lg border p-3"
              >
                {HORIZONS.map((h) => (
                  <option key={h} value={h}>{h} hours</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              District
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="mt-1 w-full rounded-lg border p-3"
              >
                <option>All Districts</option>
                {districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Selected cells", fmt(stats.cells)],
              ["Research land proxy", `${fmt(stats.land)} ha`],
              ["Research cropland proxy", `${fmt(stats.crop)} ha`]
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border bg-white p-4"
              >
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-2 text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <h3 className="font-semibold">Experimental flagged grid area — not a flood prediction</h3>
            <p className="mt-1">{fmt(stats.concernCells)} grid cells reach the research-only SAR-candidate threshold of 10% or greater.</p>
            <p className="mt-2 font-semibold">Combined full area of flagged cells: {stats.concernAreaKm2.toFixed(1)} km² · Mapped cropland inside flagged cells: {fmt(stats.concernCroplandHa)} ha</p>
            <p className="mt-2">Selected area: {district}; forecast research horizon: {hours} hours. The cutoff is only a research screening rule, not an official flood-risk category.</p>
            <p className="mt-2">These totals count entire grid cells, not the land expected to flood. Flagged cells can appear even when local rain is low, because this experimental research uses additional inputs and a different time window. Neither the cell area nor its cropland is predicted flooding, verified crop damage, or an official warning. A repeated total across horizons can mean the same cells cross the cutoff each time.</p>
          </div>

          <div className="rounded-xl border bg-white p-3">
            <div className="h-[460px] overflow-hidden rounded-lg">
              <MapContainer
                center={[24.65, 91.5]}
                zoom={8}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                <FitSelected features={features} />
                <GeoJSON
                  key={`${hours}-${district}`}
                  data={{
                    type: "FeatureCollection",
                    features
                  }}
                  style={style}
                  onEachFeature={onEachFeature}
                />
              </MapContainer>
            </div>

            <p className="mt-3 text-xs text-slate-600">
              Map bins: blue below 10%, yellow 10–25%,
              orange 25–50%, red 50% or above SAR candidate
              fraction. These are not official flood-risk levels.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white p-4">
            <h3 className="font-semibold">
              District comparison — {hours} hours
            </h3>

            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-2">District</th>
                  <th className="p-2">Cells</th>
                  <th className="p-2">Land proxy (ha)</th>
                  <th className="p-2">Cropland proxy (ha)</th>
                  <th className="p-2">Flagged grid area (km²)</th>
                  <th className="p-2">Cropland within flagged cells (ha)</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((r) => (
                  <tr key={r.district} className="border-b">
                    <td className="p-2">{r.district}</td>
                    <td className="p-2">{r.cells}</td>
                    <td className="p-2">{fmt(r.land)}</td>
                    <td className="p-2">{fmt(r.crop)}</td>
                    <td className="p-2">{r.concernAreaKm2.toFixed(1)}</td>
                    <td className="p-2">{fmt(r.concernCroplandHa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-white p-5 text-sm">
            <h3 className="font-semibold">
              Agricultural early-action considerations
            </h3>

            <p className="mt-2">
              {stale
                ? "The experimental data is outdated. Consult current official warnings before making field decisions."
                : "Check official river warnings and local drainage conditions. Where safe, protect stored seeds, harvested crops and agricultural equipment."}
            </p>

            <p className="mt-3">
              Crop-specific actions depend on the locally grown
              crop, agricultural season and growth stage.
              Confirm harvesting or planting decisions with
              local agricultural extension guidance.
            </p>

            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-slate-700">
              <strong>What informs this scenario?</strong> Selected cells include a mean
              forecast rainfall input of {stats.cells ? (stats.futureRainTotal / stats.cells).toFixed(1) : "—"} mm,
              mean antecedent 7-day rainfall of {stats.cells ? (stats.recent7Total / stats.cells).toFixed(1) : "—"} mm,
              and a modelled river-flow reference ratio of {stats.cells ? (stats.pastFlowTotal / stats.cells).toFixed(2) : "—"}.
              These are input/context summaries, NOT measured feature importance or official river-water-level forecasts.
            </div>
            <p className="mt-3 text-amber-900">
              {summary.area_warning}
              {" "}{summary.input_shift_warning}
              {" "}{summary.time_window_warning}
            </p>

            <a
              href="https://ffwc.gov.bd/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-blue-700 underline"
            >
              Official Bangladesh FFWC warnings
            </a>
          </div>
        </>
      )}
    </section>
  );
}
