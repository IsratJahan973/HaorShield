
import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer, TileLayer, GeoJSON, useMap
} from "react-leaflet";
import { MapPin, CloudRain, AlertTriangle, Clock } from "lucide-react";

const COLORS = {
  "Low Forecast Rainfall": "#94a3b8",
  "Moderate Rainfall": "#facc15",
  "Heavy Rainfall": "#f97316",
  "Very Heavy Rainfall": "#dc2626"
};

const CATEGORIES = Object.keys(COLORS);

function FitBounds({ features }) {
  const map = useMap();

  useEffect(() => {
    if (!features.length) return;
    const layer = L.geoJSON({
      type: "FeatureCollection",
      features
    });
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [15, 15] });
    }
  }, [map, features]);

  return null;
}

export default function RainfallRiskMap() {
  const [geo, setGeo] = useState(null);
  const [summary, setSummary] = useState(null);
  const [hours, setHours] = useState(72);
  const [district, setDistrict] = useState("All Districts");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/data/haorshield_rainfall_risk.geojson"),
      fetch("/data/haorshield_rainfall_summary.json")
    ])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) {
          throw new Error("Rainfall map files unavailable");
        }
        return Promise.all([a.json(), b.json()]);
      })
      .then(([a, b]) => {
        setGeo(a);
        setSummary(b);
      })
      .catch(e => setError(e.message));
  }, []);

  const districts = useMemo(() => {
    if (!geo) return [];
    return [...new Set(
      geo.features.map(f => f.properties.district)
    )].sort();
  }, [geo]);

  const visible = useMemo(() => {
    if (!geo) return [];
    return geo.features.filter(f =>
      district === "All Districts" ||
      f.properties.district === district
    );
  }, [geo, district]);

  const totals = useMemo(() => {
    const result = Object.fromEntries(
      CATEGORIES.map(category => [category, 0])
    );

    for (const feature of visible) {
      const p = feature.properties;
      const category = p[`alert${hours}`];
      if (category in result) {
        result[category] += Number(p.area_km2) || 0;
      }
    }
    return result;
  }, [visible, hours]);

  const totalArea = Object.values(totals).reduce(
    (a, b) => a + b, 0
  );

  const elevatedArea =
    totals["Moderate Rainfall"] +
    totals["Heavy Rainfall"] +
    totals["Very Heavy Rainfall"];

  const mapGeo = useMemo(() => ({
    type: "FeatureCollection",
    features: visible
  }), [visible]);

  const generatedAt = summary?.generated_at
    ? new Date(summary.generated_at)
    : null;

  const validTime = generatedAt &&
    !Number.isNaN(generatedAt.getTime());

  const ageHours = validTime
    ? (Date.now() - generatedAt.getTime()) / 3600000
    : null;

  const stale = ageHours === null || ageHours > 24;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Rainfall Risk Screening Map
        </h2>
        <p className="text-slate-600 mt-2">
          Explore forecast rainfall and preliminary areas of
          concern across seven northeastern districts.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
        <div className="flex gap-2 items-start">
          <AlertTriangle className="text-amber-700 shrink-0" size={20}/>
          <p className="text-sm text-amber-900">
            This is a rainfall-screening map, not a validated
            flood forecast or predicted inundation map.
            Low forecast rainfall does not rule out river
            flooding or flooding caused by upstream rainfall.
            Thresholds are illustrative, not official warnings.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-red-700 bg-red-50 p-4 rounded-xl">
          {error}
        </p>
      )}

      {!geo && !error && <p>Loading rainfall map...</p>}

      {geo && summary && (
        <>
          <div className="bg-white border rounded-2xl p-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-sm mb-2">
                  <MapPin className="inline mr-1" size={16}/>
                  District
                </label>
                <select
                  className="w-full border rounded-xl p-3"
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                >
                  <option>All Districts</option>
                  {districts.map(d => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-sm mb-2">
                  <Clock className="inline mr-1" size={16}/>
                  Forecast window
                </label>
                <select
                  className="w-full border rounded-xl p-3"
                  value={hours}
                  onChange={e => setHours(Number(e.target.value))}
                >
                  <option value={24}>Next 24 hours</option>
                  <option value={48}>Next 48 hours</option>
                  <option value={72}>Next 72 hours</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white border rounded-2xl p-5">
              <p className="text-sm text-slate-500">
                Geographic area represented
              </p>
              <p className="text-2xl font-bold mt-2">
                {totalArea.toLocaleString("en-US", {
                  maximumFractionDigits: 1
                })} km²
              </p>
            </div>

            <div className="bg-white border rounded-2xl p-5">
              <p className="text-sm text-slate-500">
                Area with forecast rainfall ≥ 20 mm
              </p>
              <p className="text-2xl font-bold mt-2">
                {elevatedArea.toLocaleString("en-US", {
                  maximumFractionDigits: 1
                })} km²
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Illustrative screening threshold, not flooded area
              </p>
            </div>

            <div className="bg-white border rounded-2xl p-5">
              <p className="text-sm text-slate-500">
                Forecast snapshot
              </p>
              <p className="font-semibold mt-2">
                {validTime
                  ? generatedAt.toLocaleString("en-GB", {
                      timeZone: "Asia/Dhaka"
                    })
                  : "Timestamp unavailable"}
              </p>
              <p className="text-xs mt-2 text-slate-500">
                Bangladesh time
              </p>
            </div>
          </div>

          {stale && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-sm">
              Forecast snapshot is older than 24 hours or
              its timestamp is unavailable. Refresh the
              underlying dataset before using it for
              current decisions.
            </div>
          )}

          <div className="bg-white border rounded-2xl p-4">
            <h3 className="font-bold text-lg mb-3">
              Geographic Rainfall Screening
            </h3>

            <div className="h-[450px] rounded-xl overflow-hidden">
              <MapContainer
                center={[24.65, 91.25]}
                zoom={8}
                style={{height:"100%", width:"100%"}}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <GeoJSON
                  key={`${district}-${hours}`}
                  data={mapGeo}
                  style={feature => ({
                    color: "#475569",
                    weight: 0.5,
                    fillColor:
                      COLORS[feature.properties[`alert${hours}`]]
                      || "#94a3b8",
                    fillOpacity: 0.55
                  })}
                  onEachFeature={(feature, layer) => {
                    const p = feature.properties;
                    layer.bindPopup(`
                      <strong>${p.district}</strong><br/>
                      Forecast rainfall (${hours}h):
                      ${Number(p[`rain${hours}_mm`]).toFixed(1)} mm<br/>
                      Category: ${p[`alert${hours}`]}<br/>
                      Cell area: ${Number(p.area_km2).toFixed(2)} km²
                    `);
                  }}
                />
                <FitBounds features={visible}/>
              </MapContainer>
            </div>

            <div className="flex flex-wrap gap-4 mt-4">
              {CATEGORIES.map(category => (
                <div key={category} className="flex items-center gap-2">
                  <span
                    className="inline-block w-4 h-4 rounded"
                    style={{backgroundColor: COLORS[category]}}
                  />
                  <span className="text-xs">{category}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-5">
            <h3 className="font-bold text-lg mb-4">
              Area by Rainfall Category
            </h3>
            <div className="space-y-3">
              {CATEGORIES.map(category => (
                <div
                  key={category}
                  className="flex justify-between border-b pb-2 gap-3"
                >
                  <span className="text-sm">{category}</span>
                  <strong className="text-sm">
                    {totals[category].toLocaleString("en-US", {
                      maximumFractionDigits: 1
                    })} km²
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Source: Open-Meteo forecast snapshot.
            Resolution: approximately 10 km screening grid.
            Areas are clipped geographic cell areas.
            Forecast values are not flood probabilities.
            This static map does not automatically refresh.
          </p>
        </>
      )}
    </div>
  );
}
