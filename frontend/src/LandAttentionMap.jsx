import React, { useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { exposureForDistrict } from "./landAttention.js";

const HOURS = [24, 48, 72];
// Screening values are research indicators, not flood probabilities.
// The threshold determines which cells are counted; shade shows how the
// underlying indicator changes by horizon even when flagged cells are identical.
export function mapScreeningStyle(feature, hours, highlight = true) {
  const value = Number(feature?.properties?.[`sar_candidate_fraction_${hours}h`]);
  const targeted = highlight && Number.isFinite(value) && value >= 0.10 && value <= 1;
  return targeted
    ? { color: "#9a3412", weight: 2, fillColor: "#fb923c", fillOpacity: 0.60 }
    : { color: "#94a3b8", weight: 0.45, fillColor: "#ffffff", fillOpacity: 0 };
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
    <p className="text-sm text-slate-700">Select 24, 48 or 72 hours to view your district. The map always stays visible; shaded research areas appear only when the experimental forecast shows increased concern. This is not a map of predicted flooding.</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Map forecast period">
      {HOURS.map(h => <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)} className={`rounded-lg border px-4 py-2 font-semibold ${hours === h ? "bg-sky-800 text-white" : "bg-white text-slate-900"}`}>{h} hours</button>)}
    </div>
    {level === 0 ? (
      !check.ok ? <p className="rounded-xl bg-slate-100 p-4 text-sm" role="status">{check.message}</p> : <>
        <p className="rounded-xl bg-sky-50 p-4 text-sm text-slate-900" role="status">
          No elevated flood concern was detected in the available forecast for this period. The map stays visible for location reference, but no land is identified as a current forecast target.
        </p>
        <div className="rounded-xl border border-slate-200 p-3 space-y-1" aria-label="Land map color key">
          <p className="text-sm font-bold">Map key</p>
          <p className="text-sm"><span aria-hidden="true" className="inline-block align-middle mr-2 h-4 w-6 border border-slate-400 bg-slate-100" />Outlined cells: mapped area only; no current target highlighted.</p>
        </div>
        <div style={{height:300}} className="overflow-hidden rounded-xl border" aria-label="Location reference map with no forecast targets highlighted">
          <MapContainer center={[24.8,91.3]} zoom={8} scrollWheelZoom={false} style={{height:"100%",width:"100%"}}>
            <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitArea features={check.features} />
            <GeoJSON key={`${district}-${hours}-reference`} data={{type:"FeatureCollection",features:check.features}} style={feature => mapScreeningStyle(feature, hours, false)}/>
          </MapContainer>
        </div>
        <p className="text-xs text-slate-600">This does not mean flooding is impossible. No flood-affected land area can be estimated from this result.</p>
      </>
    ) : level === undefined || level === null || !Number.isFinite(level) ? (
      <p className="rounded-xl bg-slate-100 p-4 text-sm" role="status">
        The flood outlook is unavailable for this period, so HaorShield cannot identify areas needing attention from a current flood forecast.
      </p>
    ) : !check.ok ? (
      <p className="rounded-xl bg-slate-100 p-4 text-sm" role="status">{scenarioError ? "The land map is unavailable right now." : check.message}</p>
    ) : check.flaggedCount === 0 ? (
      <p className="rounded-xl bg-sky-50 p-4 text-sm" role="status">The available forecast indicates increased concern, but the geographic screening did not identify particular mapped cells for this period. Check official local warnings.</p>
    ) : <>
      <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-slate-900" role="status">
        Increased flood concern was detected for this period. Orange cells show separate research areas to check more closely, NOT land predicted to flood.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-amber-50 p-3"><p className="text-sm">Screened land to monitor</p><p className="text-xl font-bold">{fmt(check.landKm2)} km²</p></div>
        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-sm">Cropland in those cells</p><p className="text-xl font-bold">{fmt(check.cropHa)} hectares</p></div>
      </div>
      <div className="rounded-xl border border-slate-200 p-3 space-y-2" aria-label="Land map color key">
        <p className="text-sm font-bold">Map key</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-2"><span aria-hidden="true" className="h-5 w-7 rounded border border-orange-700 bg-orange-400" />Orange: research areas to check</span>
          <span className="flex items-center gap-2"><span aria-hidden="true" className="h-5 w-7 rounded border border-slate-300 bg-slate-100" />Unshaded: other areas</span>
        </div>
      </div>
      <div style={{height:300}} className="overflow-hidden rounded-xl border" aria-label="Map showing research areas to check">
        <MapContainer center={[24.8,91.3]} zoom={8} scrollWheelZoom={false} style={{height:"100%",width:"100%"}}>
          <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitArea features={check.features} />
          <GeoJSON key={`${district}-${hours}`} data={{type:"FeatureCollection",features:check.features}} style={feature => mapScreeningStyle(feature, hours)}/>
        </MapContainer>
      </div>
      <p className="text-xs text-slate-600">Orange cells are selected separately for each period using the research screening data. Their locations may stay the same when the data do not change enough to cross the threshold. These are not forecast flood boundaries.</p>
    </>}
    <p className="text-xs text-slate-500">This research map is separate from the live flood-concern check. For safety, follow official flood warnings.</p>
  </section>;
}
