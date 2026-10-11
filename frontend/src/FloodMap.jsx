import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  ScaleControl,
  useMap
} from "react-leaflet";
import { RotateCcw, Layers, Info } from "lucide-react";

const CENTER = [24.42, 91.45];
const ZOOM = 8;

const EVENTS = [
  { id: 4382, label: "Jul–Aug 2016" },
  { id: 4459, label: "Mar–Apr 2017" },
  { id: 4508, label: "Aug 2017" }
];

const number = (value) =>
  Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });

function ResetMap({ resetSignal }) {
  const map = useMap();

  useEffect(() => {
    map.setView(CENTER, ZOOM);
  }, [map, resetSignal]);

  return null;
}

function districtName(properties = {}) {
  return (
    properties.ADM2_EN ||
    properties.ADM2_NAME ||
    properties.district ||
    properties.name ||
    "Unknown district"
  );
}

export default function FloodMap({ dashboardData }) {
  const [eventId, setEventId] = useState(4382);
  const [boundaries, setBoundaries] = useState(null);
  const [flood, setFlood] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const [showFlood, setShowFlood] = useState(true);

  const records = dashboardData?.district_event_exposure || [];
  const summaries = dashboardData?.event_summary || [];

  const eventSummary = useMemo(
    () => summaries.find(
      (row) => Number(row.event_id) === Number(eventId)
    ),
    [summaries, eventId]
  );

  useEffect(() => {
    fetch("/data/haorshield_districts.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("District layer unavailable");
        return response.json();
      })
      .then(setBoundaries)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");
    setFlood(null);
    setSelected(null);

    fetch(`/data/haorshield_flood_${eventId}.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error("Flood layer unavailable");
        return response.json();
      })
      .then((geojson) => {
        if (!cancelled) setFlood(geojson);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const selectedRecord = useMemo(() => {
    if (!selected) return null;

    return records.find(
      (row) =>
        Number(row.event_id) === Number(eventId) &&
        String(row.district).toLowerCase() ===
          selected.toLowerCase()
    );
  }, [selected, records, eventId]);

  const bindDistrict = (feature, layer) => {
    const name = districtName(feature.properties);

    layer.bindTooltip(name, { sticky: true });

    layer.on({
      click: () => setSelected(name)
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Historical Flood Explorer
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          Explore historical MODIS flood detections and
          estimated cropland exposure across seven districts.
        </p>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-4 lg:p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            {EVENTS.map((event) => (
              <button
                key={event.id}
                onClick={() => setEventId(event.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${
                  eventId === event.id
                    ? "bg-cyan-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {event.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFlood((value) => !value)}
              className="px-3 py-2 bg-slate-100 rounded-xl text-sm flex items-center gap-2"
            >
              <Layers size={16} />
              {showFlood ? "Hide Flood" : "Show Flood"}
            </button>

            <button
              onClick={() => setResetSignal((value) => value + 1)}
              className="p-2 bg-slate-100 rounded-xl"
              title="Reset map view"
              aria-label="Reset map view"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm relative">
          <MapContainer
            center={CENTER}
            zoom={ZOOM}
            scrollWheelZoom={true}
            className="h-[460px] lg:h-[610px] w-full z-0"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <ResetMap resetSignal={resetSignal} />

            {flood && showFlood && (
              <GeoJSON
                key={eventId}
                data={flood}
                style={{
                  color: "#2563eb",
                  weight: 0.5,
                  fillColor: "#3b82f6",
                  fillOpacity: 0.48
                }}
                interactive={false}
                bubblingMouseEvents={false}
              />
            )}

            {boundaries && (
              <GeoJSON
                pane="overlayPane"
                data={boundaries}
                style={{
                  color: "#0f766e",
                  weight: 2,
                  fillColor: "#0e7490",
                  fillOpacity: 0.05
                }}
                onEachFeature={bindDistrict}
              />
            )}

            <ScaleControl position="bottomleft" />
          </MapContainer>

          {loading && (
            <div className="absolute top-4 left-4 z-[500] bg-white px-3 py-2 rounded-lg shadow text-sm">
              Loading historical flood layer...
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-4 z-[500] bg-red-50 text-red-700 px-3 py-2 rounded-lg shadow text-sm">
              {error}
            </div>
          )}

          <div className="absolute bottom-7 right-3 z-[500] bg-white/95 rounded-xl shadow p-3 text-xs">
            <p className="font-semibold mb-2">Map Legend</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 bg-blue-500/50 border border-blue-600" />
              MODIS flood detected
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-teal-700" />
              District boundary
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Selected Event
            </p>
            <h3 className="font-bold text-xl mt-2">
              {EVENTS.find((e) => e.id === eventId)?.label}
            </h3>

            <div className="mt-5">
              <p className="text-xs text-slate-500">
                Estimated Flooded Cropland
              </p>
              <p className="text-2xl font-bold text-cyan-700 mt-1">
                {eventSummary
                  ? `${number(eventSummary.flooded_cropland_ha)} ha`
                  : "—"}
              </p>
            </div>

            <p className="text-xs text-slate-500 mt-4">
              Based on 2021 cropland distribution and
              historical event-window flood detections.
            </p>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">
              District Details
            </h3>

            {selected ? (
              <>
                <p className="text-lg font-bold mt-3">{selected}</p>

                {selectedRecord ? (
                  <div className="space-y-3 mt-4 text-sm">
                    <div>
                      <p className="text-slate-500">
                        Flooded cropland
                      </p>
                      <p className="font-semibold">
                        {number(
                          selectedRecord.flooded_cropland_ha
                        )} ha
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">
                        Cropland exposure
                      </p>
                      <p className="font-semibold">
                        {number(
                          selectedRecord.flooded_pct_total_cropland
                        )}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-amber-700 mt-3">
                    No matching district record found.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500 mt-3">
                Click a district on the map to inspect its
                historical agricultural exposure.
              </p>
            )}
          </div>

          <div className="bg-cyan-50 rounded-2xl p-5 border border-cyan-100">
            <div className="flex items-center gap-2 text-cyan-800">
              <Info size={18} />
              <h3 className="font-semibold text-sm">
                Interpretation
              </h3>
            </div>
            <p className="text-xs text-cyan-900 mt-3 leading-relaxed">
              Flood polygons represent coarse-resolution
              historical MODIS detections. They are not
              live observations, precise field boundaries,
              or confirmed agricultural losses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
