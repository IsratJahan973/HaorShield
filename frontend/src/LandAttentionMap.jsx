import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, GeoJSON, Circle, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { exposureForDistrict } from "./landAttention.js";
import { nearbyResearchCells } from "./upazilaForecastLocation.js";

const HOURS = [24, 48, 72];

// Administrative boundaries come from the existing district GeoJSON, not from
// research grid rectangles. An upazila focus is a point with a 20 km search
// radius, NOT an administrative upazila polygon.
function normalizeDistrict(name) {
  return String(name || "").toLowerCase().replace(/[^a-z]/g, "");
}
function matchesDistrict(feature, district) {
  const name = normalizeDistrict(feature?.properties?.ADM2_NAME || feature?.properties?.ADM2_EN);
  const wanted = normalizeDistrict(district);
  return name === wanted ||
    (wanted === "brahmanbaria" && name === "brahamanbaria") ||
    (wanted === "moulvibazar" && name === "maulvibazar") ||
    (wanted === "netrakona" && name === "netrokona");
}
function focusCoordinates(point) {
  const lat = Number(point?.lat ?? point?.latitude);
  const lon = Number(point?.lon ?? point?.lng ?? point?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? [lat, lon] : null;
}
function FitResearchArea({ features, districtBoundary, point }) {
  const map = useMap();
  useEffect(() => {
    if (point) {
      // Approximate research search radius; no fake upazila polygon.
      // Calculate a ~40 km viewing box without constructing an unmounted Circle.
      // L.circle(...).getBounds() requires a map and crashes React before mount.
      const bounds = L.latLng(point[0], point[1]).toBounds(40000);
      map.fitBounds(bounds, { padding: [26, 26], maxZoom: 10 });
      return;
    }
    const region = districtBoundary?.features?.length ? districtBoundary.features : features;
    if (!region.length) return;
    const bounds = L.geoJSON({ type: "FeatureCollection", features: region }).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [26, 26], maxZoom: 10 });
  }, [features, districtBoundary, point, map]);
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
  const [districtBoundary, setDistrictBoundary] = useState(null);
  const [boundariesAvailable, setBoundariesAvailable] = useState(true);
  const focusPoint = useMemo(() => focusCoordinates(focusLocation), [focusLocation]);
  useEffect(() => {
    let active = true;
    fetch("/data/haorshield_districts.geojson")
      .then(r => { if (!r.ok) throw Error("District boundary unavailable"); return r.json(); })
      .then(data => { if (active) { setDistrictBoundary(data); setBoundariesAvailable(true); } })
      .catch(() => { if (active) setBoundariesAvailable(false); });
    return () => { active = false; };
  }, []);
  const selectedBoundary = useMemo(() => {
    const features = districtBoundary?.features?.filter(f => matchesDistrict(f, district)) || [];
    return features.length ? { type: "FeatureCollection", features } : null;
  }, [districtBoundary, district]);

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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold text-slate-900">Land &amp; cropland outlook map</h4>
          <p className="text-sm text-slate-500">{selectedUpazila ? `${selectedUpazila}, ` : ""}{district} · Experimental geographic screening</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Research map · Not inundation</span>
      </div>


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
          <p className="text-xs text-slate-600" role="status">Experimental research scenario issued {check.issueDate} (UTC), showing a {hours}-hour scenario. This is not a dated flood-inundation prediction for {forecastDate}.</p>
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
                <p className="text-sm">{selectedUpazila ? "Nearby research-cell land to monitor" : "Research-cell land to monitor"}</p>
                <p className="text-xl font-bold">{fmt(selectedUpazila ? localTargetLandKm2 : check.landKm2)} km²</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-sm">{selectedUpazila ? "Nearby research-cell cropland to monitor" : "Research-cell cropland to monitor"}</p>
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

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="font-semibold text-slate-900 mb-2">Map color guide</p>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="inline-block h-4 w-7 rounded border border-sky-300 bg-sky-100" />
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
              <div className="flex items-center gap-2">
                <span className="inline-block h-4 w-7 rounded border-2 border-slate-800 bg-transparent" />
                <span>Dark outline: selected district boundary</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm" aria-label="Map showing land needing attention">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
              <div className="font-semibold text-slate-900">{selectedUpazila ? `${selectedUpazila} area` : district} · {hours}-hour outlook</div>
              <span className="text-xs text-slate-500">Zoom to explore · OpenStreetMap</span>
            </div>
            <div style={{ height: 420 }}>
              <MapContainer center={[24.8, 91.3]} zoom={8} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
                <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitResearchArea features={displayFeatures} districtBoundary={selectedBoundary} point={selectedUpazila ? focusPoint : null} />
                {/* Research cells are intentionally light. They are not upazila boundaries. */}
                <GeoJSON
                  key={`cells-${district}-${selectedUpazila || "all"}-${hours}-${forecastHasConcern}`}
                  data={{ type: "FeatureCollection", features: displayFeatures }}
                  style={feature => {
                    const frac = featureFraction(feature, hours);
                    const active = forecastHasConcern && frac >= 0.10;
                    const strong = frac >= 0.35;
                    return active
                      ? { color: strong ? "#9a3412" : "#ea580c", weight: 1.2,
                          fillColor: strong ? "#c2410c" : "#fdba74", fillOpacity: 0.47 }
                      : { color: "#60a5fa", weight: 0.65, opacity: 0.6,
                          fillColor: "#bfdbfe", fillOpacity: 0.19 };
                  }}
                />
                {selectedBoundary && <GeoJSON
                  key={`district-boundary-${district}`}
                  data={selectedBoundary}
                  style={() => ({ color: "#0f172a", weight: 3.1, opacity: 0.95,
                    fillOpacity: 0, dashArray: "", lineCap: "round", lineJoin: "round" })}
                  onEachFeature={(_, layer) => layer.bindTooltip(`${district} district`, { sticky: true })}
                />}
                {selectedUpazila && focusPoint && <>
                  <Circle center={focusPoint} radius={20000}
                    pathOptions={{ color: "#0369a1", weight: 1.6, dashArray: "6 6", fillColor: "#0284c7", fillOpacity: 0.025 }} />
                  <CircleMarker center={focusPoint} radius={7}
                    pathOptions={{ color: "#ffffff", weight: 2.5, fillColor: "#075985", fillOpacity: 1 }}>
                    <Tooltip permanent direction="top" offset={[0, -7]}>{selectedUpazila} · reference point</Tooltip>
                  </CircleMarker>
                </>}
              </MapContainer>
            </div>
            <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              {selectedUpazila
                ? `The dotted circle shows a 20 km research radius around the ${selectedUpazila} reference point, not its administrative boundary.`
                : "The dark outline shows the selected district; rectangular overlays are research cells, not administrative areas."}
              {!selectedBoundary && !boundariesAvailable && " Official-style district boundary data could not be loaded."}
            </div>
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
