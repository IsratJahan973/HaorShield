import React, { useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { exposureForDistrict } from "./landAttention.js";

const HOURS = [24, 48, 72];

function FitArea({ features }) {
  const map = useMap();
  React.useEffect(() => {
    if (!features.length) return;
    const bounds = L.geoJSON({ type: "FeatureCollection", features }).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16], maxZoom: 10 });
  }, [features, map]);
  return null;
}

function featureFraction(feature, hours) {
  return Number(feature?.properties?.[`sar_candidate_fraction_${hours}h`] || 0);
}

function totalMappedLandKm2(features) {
  return features.reduce((sum, f) => sum + Number(f.properties?.cell_area_ha || 0) / 100, 0);
}

function totalMappedCroplandHa(features) {
  return features.reduce((sum, f) => sum + Number(f.properties?.cropland_ha || 0), 0);
}

export default function LandAttentionMap({ district, forecastDate, scenarioData, scenarioError, outlooks = [] }) {
  const [hours, setHours] = useState(24);

  const check = useMemo(
    () => exposureForDistrict(scenarioData, district, hours, forecastDate),
    [scenarioData, district, hours, forecastDate]
  );

  const selectedForecast = outlooks.find(o => o.horizonHours === hours);
  const forecastHasConcern = Number(selectedForecast?.rank) >= 2;

  const fmt = n => Math.round(n).toLocaleString("en-BD");

  const mapStats = useMemo(() => {
    if (!check.ok) return null;
    return {
      mappedLandKm2: totalMappedLandKm2(check.features),
      mappedCropHa: totalMappedCroplandHa(check.features)
    };
  }, [check]);

  const statusText = !check.ok
    ? null
    : forecastHasConcern
      ? "Forecasts show increased flood concern for this period. Orange cells mark the parts of the district that need closer attention now. Light blue cells are other mapped areas."
      : "No elevated flood concern was detected for this period. The district is shown in light blue only. Orange will appear only when a flood-concern target area is detected.";

  return (
    <section className="rounded-2xl border border-slate-200 p-4 space-y-3" aria-label="Land needing attention">
      <h4 className="text-lg font-bold">Areas that may be vulnerable if flooding develops</h4>
      <p className="text-sm text-slate-700">
        Select 24, 48 or 72 hours to view your district. The map stays visible for location reference.
        If flood concern is detected, only the affected part of the district turns orange.
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Map forecast period">
        {HOURS.map(h => (
          <button
            key={h}
            type="button"
            aria-pressed={hours === h}
            onClick={() => setHours(h)}
            className={`rounded-lg border px-4 py-2 font-semibold ${hours === h ? "bg-sky-800 text-white" : "bg-white text-slate-900"}`}
          >
            {h} hours
          </button>
        ))}
      </div>

      {check.ok ? (
        <>
          <div className="rounded-xl bg-sky-50 p-4 text-sm text-slate-800">
            {statusText}
          </div>

          {forecastHasConcern ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-sm">Target land area</p>
                <p className="text-xl font-bold">{fmt(check.landKm2)} km²</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-sm">Target cropland area</p>
                <p className="text-xl font-bold">{fmt(check.cropHa)} hectares</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-sm">Mapped district land</p>
                <p className="text-xl font-bold">{fmt(mapStats?.mappedLandKm2 || 0)} km²</p>
              </div>
              <div className="rounded-xl bg-cyan-50 p-3">
                <p className="text-sm">Mapped cropland</p>
                <p className="text-xl font-bold">{fmt(mapStats?.mappedCropHa || 0)} hectares</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="font-semibold text-slate-900 mb-2">Map color guide</p>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="inline-block h-5 w-8 rounded border border-sky-400 bg-sky-200" />
                <span>Light blue: mapped district area with no current flood target</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-5 w-8 rounded border border-orange-500 bg-orange-300" />
                <span>Light orange: target area needing attention</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-5 w-8 rounded border border-orange-800 bg-orange-700" />
                <span>Dark orange: stronger target area within the selected period</span>
              </div>
            </div>
          </div>

          <div style={{ height: 320 }} className="overflow-hidden rounded-xl border" aria-label="Map showing land needing attention">
            <MapContainer center={[24.8, 91.3]} zoom={8} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitArea features={check.features} />
              <GeoJSON
                key={`${district}-${hours}-${forecastHasConcern ? 'risk' : 'norisk'}`}
                data={{ type: "FeatureCollection", features: check.features }}
                style={feature => {
                  const frac = featureFraction(feature, hours);
                  const isTarget = forecastHasConcern && frac >= 0.10;
                  if (!isTarget) {
                    return {
                      color: "#60a5fa",
                      weight: 1,
                      fillColor: "#bfdbfe",
                      fillOpacity: 0.42
                    };
                  }
                  const stronger = frac >= 0.35;
                  return {
                    color: stronger ? "#9a3412" : "#ea580c",
                    weight: 2,
                    fillColor: stronger ? "#c2410c" : "#fdba74",
                    fillOpacity: 0.60
                  };
                }}
              />
            </MapContainer>
          </div>

          <p className="text-xs text-slate-600">
            This map does not show flood depth, confirmed flooded land, or crop damage.
            It only helps show which part of the district would be watched more closely if flood concern increases.
          </p>
        </>
      ) : (
        <p className="rounded-xl bg-slate-100 p-3 text-sm" role="status">
          {scenarioError ? "Land map is unavailable right now." : check.message}
        </p>
      )}

      <p className="text-xs text-slate-500">For safety decisions, follow official flood warnings and local advice.</p>
    </section>
  );
}
