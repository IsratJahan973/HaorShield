import React, { useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { exposureForDistrict } from "./landAttention.js";
import { nearbyResearchCells } from "./upazilaForecastLocation.js";

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

export default function LandAttentionMap({ district, forecastDate, scenarioData, scenarioError, outlooks = [], focusLocation = null, selectedUpazila = null }) {
  const [hours, setHours] = useState(24);

  const check = useMemo(
    () => exposureForDistrict(scenarioData, district, hours, forecastDate),
    [scenarioData, district, hours, forecastDate]
  );

  // For an upazila, this is a 20 km radius around a VERIFIED local point,
  // NOT an administrative polygon or a prediction of submerged land.
  const displayFeatures = useMemo(() => check.ok
    ? nearbyResearchCells(check.features, focusLocation, 20) : [], [check, focusLocation]);
  const nearbyTargets = displayFeatures.filter(f => Number(f.properties[`sar_candidate_fraction_${hours}h`]) >= 0.10);
  const localTargetLandKm2 = nearbyTargets.reduce((s, f) => s + Number(f.properties.cell_area_ha) / 100, 0);
  const localTargetCropHa = nearbyTargets.reduce((s, f) => s + Number(f.properties.cropland_ha), 0);
  const selectedForecast = outlooks.find(o => o.horizonHours === hours);
  const forecastHasConcern = Number(selectedForecast?.rank) >= 2;

  const fmt = n => Math.round(n).toLocaleString("en-BD");

  const mapStats = useMemo(() => {
    if (!check.ok) return null;
    return {
      mappedLandKm2: totalMappedLandKm2(displayFeatures),
      mappedCropHa: totalMappedCroplandHa(displayFeatures)
    };
  }, [check, displayFeatures]);

  const statusText = !check.ok
    ? null
    : forecastHasConcern
      ? "Elevated screening signal: orange cells highlight research areas to monitor."
      : "No elevated screening signal for this period.";

  return (
    <section className="rounded-2xl border border-slate-200 p-4 space-y-3" aria-label="Land needing attention">
      <h4 className="text-lg font-bold">Nearby land and cropland</h4>


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
          {selectedUpazila && <p className="text-sm rounded-lg bg-amber-50 p-3 text-amber-900" role="status">
            Map coverage: research cells within 20 km of {selectedUpazila} (not administrative boundaries).
          </p>}
          {selectedUpazila && displayFeatures.length === 0 && <p className="text-sm text-orange-800" role="status">No research-grid cells are near this point. No local area estimate is available.</p>}
          <div className="rounded-xl bg-sky-50 p-4 text-sm text-slate-800">
            {statusText}
          </div>

          {forecastHasConcern ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-sm">{selectedUpazila ? "Nearby research-cell land to monitor" : "Target land area"}</p>
                <p className="text-xl font-bold">{fmt(selectedUpazila ? localTargetLandKm2 : check.landKm2)} km²</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-sm">{selectedUpazila ? "Nearby research-cell cropland to monitor" : "Target cropland area"}</p>
                <p className="text-xl font-bold">{fmt(selectedUpazila ? localTargetCropHa : check.cropHa)} hectares</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-sm">{selectedUpazila ? "Nearby mapped land (20 km cells)" : "Mapped district land"}</p>
                <p className="text-xl font-bold">{fmt(mapStats?.mappedLandKm2 || 0)} km²</p>
              </div>
              <div className="rounded-xl bg-cyan-50 p-3">
                <p className="text-sm">{selectedUpazila ? "Nearby mapped cropland (20 km cells)" : "Mapped cropland"}</p>
                <p className="text-xl font-bold">{fmt(mapStats?.mappedCropHa || 0)} hectares</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="font-semibold text-slate-900 mb-2">Map color guide</p>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="inline-block h-5 w-8 rounded border border-sky-400 bg-sky-200" />
                <span>Light blue: mapped research cells</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-5 w-8 rounded border border-orange-500 bg-orange-300" />
                <span>Light orange: increased screening signal</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-5 w-8 rounded border border-orange-800 bg-orange-700" />
                <span>Dark orange: stronger screening signal</span>
              </div>
            </div>
          </div>

          <div style={{ height: 320 }} className="overflow-hidden rounded-xl border" aria-label="Map showing land needing attention">
            <MapContainer center={[24.8, 91.3]} zoom={8} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitArea features={displayFeatures.length ? displayFeatures : selectedUpazila ? [] : check.features} />
              <GeoJSON
                key={`${district}-${selectedUpazila || "district"}-${hours}-${forecastHasConcern ? 'risk' : 'norisk'}`}
                data={{ type: "FeatureCollection", features: displayFeatures }}
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


        </>
      ) : (
        <p className="rounded-xl bg-slate-100 p-3 text-sm" role="status">
          {scenarioError ? "Land map is unavailable right now." : check.message}
        </p>
      )}


    </section>
  );
}
