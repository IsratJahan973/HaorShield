import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, GeoJSON, Circle, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { exposureForDistrict } from "./landAttention.js";
import { nearbyResearchCells } from "./upazilaForecastLocation.js";
import { selectUpazilaBoundary, clipResearchCells } from "./upazilaPolygonOverlay.js";

const HOURS = [24, 48, 72];

// District and upazila boundaries come from their geographic datasets.
// The screening cells are clipped to the selected upazila and remain coarse inputs.
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
function FitResearchArea({ features, districtBoundary, upazilaBoundary }) {
  const map = useMap();
  useEffect(() => {
    // Bounds come from attached-independent polygon geometry; never call Circle.getBounds.
    const region = upazilaBoundary?.features?.length ? upazilaBoundary.features : (districtBoundary?.features?.length ? districtBoundary.features : features);
    if (!region.length) return;
    const bounds = L.geoJSON({ type: "FeatureCollection", features: region }).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [26, 26], maxZoom: 10 });
  }, [features, districtBoundary, upazilaBoundary, map]);
  return null;
}


function featureFraction(feature, hours) {
  return Number(feature?.properties?.[`sar_candidate_fraction_${hours}h`] || 0);
}

function totalMappedLandKm2(features) {
  return features.reduce((sum, f) => sum + Number(f.properties?.cell_area_ha || 0) * Number(f.properties?.overlapFraction ?? 1) / 100, 0);
}

function totalMappedCroplandHa(features) {
  return features.reduce((sum, f) => sum + Number(f.properties?.cropland_ha || 0) * Number(f.properties?.overlapFraction ?? 1), 0);
}

export default function LandAttentionMap({ district, forecastDate, scenarioData, scenarioError, outlooks = [], focusLocation = null, selectedUpazila = null }) {
  const [hours, setHours] = useState(24);
  const [districtBoundary, setDistrictBoundary] = useState(null);
  const [boundariesAvailable, setBoundariesAvailable] = useState(true);
  const [upazilaBoundaries, setUpazilaBoundaries] = useState(null);
  const [polygonClips, setPolygonClips] = useState(null);
  const focusPoint = useMemo(() => focusCoordinates(focusLocation), [focusLocation]);
  useEffect(() => {
    let active = true;
    fetch("/data/haorshield_districts.geojson")
      .then(r => { if (!r.ok) throw Error("District boundary unavailable"); return r.json(); })
      .then(data => { if (active) { setDistrictBoundary(data); setBoundariesAvailable(true); } })
      .catch(() => { if (active) setBoundariesAvailable(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/data/haorshield_upazila_boundaries.geojson').then(r => { if (!r.ok) throw Error('Boundary missing'); return r.json(); }),
      fetch('/data/haorshield_upazila_cell_clips.json').then(r => { if (!r.ok) throw Error('Clips missing'); return r.json(); })
    ]).then(([boundaries, clips]) => { if (active) { setUpazilaBoundaries(boundaries); setPolygonClips(clips); } })
      .catch(() => { if (active) { setUpazilaBoundaries(null); setPolygonClips(null); } });
    return () => { active = false; };
  }, []);
  const selectedUpazilaBoundary = useMemo(() => selectUpazilaBoundary(upazilaBoundaries, district, selectedUpazila), [upazilaBoundaries, district, selectedUpazila]);
  const selectedBoundary = useMemo(() => {
    const features = districtBoundary?.features?.filter(f => matchesDistrict(f, district)) || [];
    return features.length ? { type: "FeatureCollection", features } : null;
  }, [districtBoundary, district]);

  const check = useMemo(
    () => exposureForDistrict(scenarioData, district, hours, forecastDate),
    [scenarioData, district, hours, forecastDate]
  );

  // Clip research cells by the mapped upazila boundary, not a circular point buffer.
  const displayFeatures = useMemo(() => !check.ok ? [] : selectedUpazila
    ? selectedUpazilaBoundary ? clipResearchCells(check.features, polygonClips, district, selectedUpazila) : []
    : check.features, [check, district, selectedUpazila, selectedUpazilaBoundary, polygonClips]);
  const nearbyTargets = displayFeatures.filter(f => Number(f.properties[`sar_candidate_fraction_${hours}h`]) >= 0.10);
  const localTargetLandKm2 = nearbyTargets.reduce((s, f) => s + Number(f.properties.cell_area_ha) * Number(f.properties.overlapFraction ?? 1) / 100, 0);
  const localTargetCropHa = nearbyTargets.reduce((s, f) => s + Number(f.properties.cropland_ha) * Number(f.properties.overlapFraction ?? 1), 0);
  const selectedForecast = outlooks.find(o => o.horizonHours === hours);
  const forecastHasConcern = Number(selectedForecast?.rank) >= 2;
  // Light blue means a lower *screening signal*, never a zero flood probability.
  const hasKnownLowerConcern = selectedForecast?.rank != null && Number.isFinite(Number(selectedForecast.rank))
    && Number(selectedForecast.rank) < 2 && displayFeatures.length > 0;

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
    : selectedUpazila && displayFeatures.length === 0
      ? "Local map coverage is unavailable for this selection."
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
          {selectedUpazila && displayFeatures.length === 0 && <p className="text-sm text-orange-800" role="status">No research-grid coverage intersects this upazila, or its verified boundary is unavailable. No local area estimate is available.</p>}
          <div className="rounded-xl bg-sky-50 p-4 text-sm text-slate-800">
            {statusText}
          </div>

          {forecastHasConcern ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-sm">{selectedUpazila ? "Nearby research-cell land to monitor" : "Research-cell land to monitor"}</p>
                <p className="text-xl font-bold">{selectedUpazila && displayFeatures.length === 0 ? "Unavailable" : `${fmt(selectedUpazila ? localTargetLandKm2 : check.landKm2)} km²`}</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-sm">{selectedUpazila ? "Nearby research-cell cropland to monitor" : "Research-cell cropland to monitor"}</p>
                <p className="text-xl font-bold">{selectedUpazila && displayFeatures.length === 0 ? "Unavailable" : `${fmt(selectedUpazila ? localTargetCropHa : check.cropHa)} hectares`}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-sm">{selectedUpazila ? "Mapped land in selected area" : "Mapped district land"}</p>
                <p className="text-xl font-bold">{selectedUpazila && displayFeatures.length === 0 ? "Unavailable" : `${fmt(mapStats?.mappedLandKm2 || 0)} km²`}</p>
              </div>
              <div className="rounded-xl bg-cyan-50 p-3">
                <p className="text-sm">{selectedUpazila ? "Mapped cropland in selected area" : "Mapped cropland"}</p>
                <p className="text-xl font-bold">{selectedUpazila && displayFeatures.length === 0 ? "Unavailable" : `${fmt(mapStats?.mappedCropHa || 0)} hectares`}</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="font-semibold text-slate-900 mb-2">Map color guide</p>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="inline-block h-4 w-7 rounded border border-sky-300 bg-sky-100" />
                <span>Light blue: lower screening signal / mapped cells (not zero risk)</span>
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
                <FitResearchArea features={displayFeatures} districtBoundary={selectedBoundary} upazilaBoundary={selectedUpazilaBoundary} />
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
                {selectedUpazilaBoundary && <GeoJSON
                  key={`upazila-boundary-${district}-${selectedUpazila}`}
                  data={selectedUpazilaBoundary}
                  style={() => ({ color: '#0369a1', weight: 2.7,
                    fillColor: hasKnownLowerConcern ? '#93c5fd' : 'transparent',
                    fillOpacity: hasKnownLowerConcern ? 0.30 : 0,
                    opacity: 0.95, lineCap: 'round', lineJoin: 'round' })}
                  onEachFeature={(_, layer) => layer.bindTooltip(`${selectedUpazila} upazila`, { sticky: true })}
                />}
              </MapContainer>
            </div>
            <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              {selectedUpazila
                ? `The blue outline marks the mapped administrative boundary of ${selectedUpazila}. Pale blue is a lower experimental screening signal where mapped cells exist, not proof of no flood risk. Orange remains limited to intersecting research cells.`
                : "The dark outline shows the selected district; rectangular overlays are research cells, not administrative areas."}
              {selectedUpazila && !selectedUpazilaBoundary && " Upazila boundary unavailable: no district-wide forecast shading is substituted."}
              {!selectedBoundary && !boundariesAvailable && " District boundary data could not be loaded."}
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
