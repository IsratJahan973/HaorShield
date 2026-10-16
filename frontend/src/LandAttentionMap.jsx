import React, { useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { exposureForDistrict } from "./landAttention.js";

const HOURS = [24, 48, 72];
// Screening values are research indicators, not flood probabilities.
// The threshold determines which cells are counted; shade shows how the
// underlying indicator changes by horizon even when flagged cells are identical.
export function mapScreeningStyle(feature, hours) {
  const value = Number(feature?.properties?.[`sar_candidate_fraction_${hours}h`]);
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  if (v < 0.10) {
    return { color: "#64748b", weight: 0.5, fillColor: "#93c5fd", fillOpacity: 0.10 + 0.4 * Math.min(v / 0.10, 1) };
  }
  // Darker orange marks a stronger *relative research screening indicator*,
  // not a measured level of flood severity or probability.
  const intensity = Math.min(1, Math.max(0, (v - 0.10) / 0.15));
  return {
    color: "#9a3412", weight: 1.5 + intensity,
    fillColor: intensity >= 0.67 ? "#c2410c" : intensity >= 0.33 ? "#ea580c" : "#fb923c",
    fillOpacity: 0.40 + 0.35 * intensity
  };
}

function FitArea({ features }) {
  const map = useMap();
  React.useEffect(() => {
    if (!features.length) return;
    const bounds = L.geoJSON({ type: "FeatureCollection", features }).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16], maxZoom: 10 });
  }, [features, map]);
  return null;
}
export default function LandAttentionMap({ district, forecastDate, scenarioData, scenarioError, outlooks = [] }) {
  const [hours, setHours] = useState(24);
  const check = useMemo(() => exposureForDistrict(scenarioData, district, hours, forecastDate), [scenarioData, district, hours, forecastDate]);
  const selectedForecast = outlooks.find(o => o.horizonHours === hours);
  const fmt = n => Math.round(n).toLocaleString("en-BD");
  const level = selectedForecast?.rank;
  const low = level === 0;
  const elevated = typeof level === "number" && level >= 1;
  const heading = low ? "Areas that may be vulnerable if flooding develops" : elevated ? "Areas that may need attention if flooding develops" : "Areas to know about if flooding develops";
  return <section className="rounded-2xl border border-slate-200 p-4 space-y-3" aria-label="Land needing attention">
    <h4 className="text-lg font-bold">{heading}</h4>
    <p className="text-sm text-slate-700">This map shows areas identified through geographic research. It does not predict which fields will flood. Choose a period to see the research map.</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Map forecast period">
      {HOURS.map(h => <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)} className={`rounded-lg border px-4 py-2 font-semibold ${hours === h ? "bg-sky-800 text-white" : "bg-white text-slate-900"}`}>{h} hours</button>)}
    </div>
    {check.ok ? <>
      <p className="rounded-lg bg-sky-50 p-3 text-sm font-medium text-slate-900" role="status">{elevated ? "The latest forecasts show signs to watch. The shaded areas are separate research estimates, not places predicted to flood." : low ? "No increased flood concern was detected in the checked forecasts. The shaded areas show where flooding may have greater impact if conditions worsen — not where flooding is expected now." : "There is not enough forecast information to assess flood concern. Shaded areas are research estimates only, not an active flood warning."}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-amber-50 p-3"><p className="text-sm">Mapped land to keep in mind</p><p className="text-xl font-bold">{fmt(check.landKm2)} km²</p></div>
        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-sm">Cropland in mapped areas</p><p className="text-xl font-bold">{fmt(check.cropHa)} hectares</p></div>
      </div>
      <div className="rounded-xl border border-slate-200 p-3 space-y-2" aria-label="Land map color key">
        <p className="text-sm font-bold text-slate-900">What do the map colors mean?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-800">
          <div className="flex items-center gap-2"><span aria-hidden="true" className="h-5 w-7 shrink-0 rounded border border-blue-400 bg-blue-200" />Blue: other mapped areas</div>
          <div className="flex items-center gap-2"><span aria-hidden="true" className="h-5 w-7 shrink-0 rounded border border-orange-500 bg-orange-300" />Light orange: lower attention area</div>
          <div className="flex items-center gap-2"><span aria-hidden="true" className="h-5 w-7 shrink-0 rounded border border-orange-800 bg-orange-700" />Dark orange: higher attention area</div>
        </div>
        <p className="text-xs text-slate-700">Attention colors compare a research indicator, not actual flood risk. They do not predict flood depth, flood chance or flooded land. Blue does not mean safe.</p>
      </div>
      <div style={{height:300}} className="overflow-hidden rounded-xl border" aria-label="Map showing land to monitor">
        <MapContainer center={[24.8,91.3]} zoom={8} scrollWheelZoom={false} style={{height:"100%",width:"100%"}}>
          <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitArea features={check.features} />
          <GeoJSON key={`${district}-${hours}`} data={{type:"FeatureCollection",features:check.features}} style={feature => mapScreeningStyle(feature, hours)}/>
        </MapContainer>
      </div>
      <p className="text-xs text-slate-600">The same areas may appear at 24, 48 and 72 hours. Darker shading means a stronger research indicator, not a forecast of deeper flooding.</p>
    </> : <p className="rounded-xl bg-slate-100 p-3 text-sm" role="status">{scenarioError ? "Land map is unavailable right now." : check.message}</p>}
    <p className="text-xs text-slate-500">This research map is separate from the live flood-concern check. For safety, follow official flood warnings.</p>
  </section>;
}
