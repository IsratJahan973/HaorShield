
import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer, TileLayer, GeoJSON, useMap
} from "react-leaflet";

const COLORS = {
  "No Elevated Rainfall Signal": "#94a3b8",
  "Rainfall Watch": "#facc15",
  "Elevated Screening Concern": "#f97316",
  "High Screening Concern": "#dc2626"
};

const DISTRICTS = [
  "All Districts", "Brahmanbaria", "Habiganj",
  "Kishoreganj", "Moulvibazar", "Netrakona",
  "Sunamganj", "Sylhet"
];

function FitBounds({ features }) {
  const map = useMap();

  useEffect(() => {
    if (!features.length) return;
    const bounds = L.geoJSON({
      type: "FeatureCollection", features
    }).getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, features]);

  return null;
}

const fmt = n => Number(n).toLocaleString(
  "en-US", { maximumFractionDigits: 1 }
);

export default function FloodExposureMap() {
  const [geo, setGeo] = useState(null);
  const [agriculture, setAgriculture] = useState(null);
  const [district, setDistrict] = useState("All Districts");
  const [hours, setHours] = useState(72);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/data/haorshield_flood_screening.geojson")
        .then(r => {
          if (!r.ok) throw new Error("Screening data unavailable");
          return r.json();
        }),
      fetch("/data/haorshield_agricultural_exposure.json")
        .then(r => {
          if (!r.ok) throw new Error("Agriculture data unavailable");
          return r.json();
        })
    ])
      .then(([g, a]) => {
        setGeo(g);
        setAgriculture(a);
      })
      .catch(e => setError(e.message));
  }, []);

  const features = useMemo(() => {
    if (!geo) return [];

    return geo.features.filter(f =>
      district === "All Districts" ||
      f.properties.district === district
    );
  }, [geo, district]);

  const summary = useMemo(() => {
    const result = {
      area: 0,
      elevatedArea: 0,
      elevatedCells: 0,
      historicalFraction: 0
    };

    for (const f of features) {
      const p = f.properties;
      const area = Number(p.area_km2);
      const category = p[`screening${hours}`];

      result.area += area;
      result.historicalFraction +=
        Number(p.historical_flood_fraction) * area;

      if (category === "Elevated Screening Concern" ||
          category === "High Screening Concern") {
        result.elevatedArea += area;
        result.elevatedCells++;
      }
    }

    if (result.area > 0) {
      result.historicalFraction /= result.area;
    }

    return result;
  }, [features, hours]);

  const crop = useMemo(() => {
    if (!agriculture) return null;

    const records = district === "All Districts"
      ? Object.values(agriculture.districts)
      : [agriculture.districts[district]].filter(Boolean);

    return {
      cropland: records.reduce(
        (s, d) => s + d.mapped_cropland_ha, 0
      ),
      historicalMean: records.reduce(
        (s, d) => s + d.historical_mean_exposed_ha, 0
      )
    };
  }, [agriculture, district]);

  const generatedAt = geo?.metadata?.generated_at;
  const ageHours = generatedAt
    ? (Date.now() - new Date(generatedAt).getTime()) / 3600000
    : null;
  const stale = ageHours === null ||
    !Number.isFinite(ageHours) || ageHours > 24;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border">
        <h2 className="text-2xl font-bold text-slate-900">
          Flood Concern & Agricultural Exposure
        </h2>
        <p className="text-slate-600 mt-2">
          Forecast rainfall combined with historical
          flood susceptibility across northeastern Bangladesh.
        </p>
        <p className="text-sm text-amber-800 mt-3">
          Preliminary screening only. Not a validated flood
          probability or predicted inundation map.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      {!geo && !error && <p>Loading exposure map...</p>}

      {geo && agriculture && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm font-semibold">
              District
              <select
                value={district}
                onChange={e => setDistrict(e.target.value)}
                className="block mt-2 w-full p-3 rounded-xl border"
              >
                {DISTRICTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold">
              Forecast Window
              <select
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
                className="block mt-2 w-full p-3 rounded-xl border"
              >
                <option value={24}>Next 24 hours</option>
                <option value={48}>Next 48 hours</option>
                <option value={72}>Next 72 hours</option>
              </select>
            </label>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["Area Screened", `${fmt(summary.area)} km²`],
              ["Elevated Concern Cells", summary.elevatedCells],
              ["Elevated Screening Area",
                `${fmt(summary.elevatedArea)} km²`],
              ["Mapped Cropland",
                `${fmt(crop?.cropland ?? 0)} ha`]
            ].map(([label, value]) => (
              <div key={label}
                className="bg-white rounded-xl p-5 border">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold mt-2">{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-4 border">
            <div style={{ height: 460 }}>
              <MapContainer
                center={[24.7, 91.2]}
                zoom={8}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <GeoJSON
                  key={`${district}-${hours}`}
                  data={{
                    type: "FeatureCollection",
                    features
                  }}
                  style={f => ({
                    color: "#475569",
                    weight: 0.5,
                    fillOpacity: 0.65,
                    fillColor:
                      COLORS[f.properties[`screening${hours}`]]
                      || "#94a3b8"
                  })}
                  onEachFeature={(feature, layer) => {
                    const p = feature.properties;
                    layer.bindPopup(`
                      <b>${p.district}</b><br/>
                      Cell: ${p.cell_id}<br/>
                      Rainfall: ${Number(
                        p[`rain${hours}_mm`]
                      ).toFixed(1)} mm<br/>
                      Screening: ${
                        p[`screening${hours}`]
                      }<br/>
                      Historical detected flood fraction:
                      ${(
                        100 * p.historical_flood_fraction
                      ).toFixed(1)}%<br/>
                      <small>Historical fraction is not
                      future flood probability.</small>
                    `);
                  }}
                />
                <FitBounds features={features} />
              </MapContainer>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 text-xs">
              {Object.entries(COLORS).map(([label, color]) => (
                <span key={label} className="flex items-center gap-2">
                  <span style={{
                    backgroundColor: color,
                    width: 12, height: 12,
                    display: "inline-block"
                  }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border">
            <h3 className="text-xl font-bold mb-3">
              Agricultural Exposure Context
            </h3>
            <p>
              Mapped cropland: <b>
                {fmt(crop?.cropland ?? 0)} hectares
              </b>
            </p>
            <p className="mt-2">
              Mean historical flood-exposed cropland:
              <b> {fmt(crop?.historicalMean ?? 0)} hectares</b>
            </p>
            <p className="text-sm text-slate-600 mt-3">
              Historical exposure is calculated from three
              past flood events using ESA WorldCover 2021
              cropland as a reference. It is not a forecast
              of agricultural damage.
            </p>
            <p className="text-sm font-medium mt-3">
              Predicted future flooded cropland:
              Not yet validated.
            </p>
          </div>

          <div className="bg-amber-50 rounded-xl p-4 text-sm">
            <b>Forecast issued:</b>{" "}
            {generatedAt
              ? new Date(generatedAt).toLocaleString()
              : "Unknown"}
            {stale && (
              <p className="text-amber-900 font-semibold mt-2">
                Warning: This forecast snapshot is old or
                its age cannot be verified. Refresh is required.
              </p>
            )}
            <p className="mt-2">
              Low local forecast rainfall does not rule out
              river flooding, upstream rainfall impacts,
              or flooding from drainage problems.
              Screened geographic area is not flooded area.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
