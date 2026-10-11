
import React, { useEffect, useState } from "react";
import { MapPin, CalendarDays, CloudRain, ShieldCheck,
         AlertTriangle, Search, Loader2 } from "lucide-react";

const DISTRICTS = [
  { name: "Brahmanbaria", lat: 23.96, lon: 91.11 },
  { name: "Habiganj", lat: 24.38, lon: 91.42 },
  { name: "Kishoreganj", lat: 24.44, lon: 90.78 },
  { name: "Moulvibazar", lat: 24.48, lon: 91.77 },
  { name: "Netrakona", lat: 24.88, lon: 90.73 },
  { name: "Sunamganj", lat: 25.07, lon: 91.40 },
  { name: "Sylhet", lat: 24.89, lon: 91.87 }
];

function localDate(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type)?.value;
  const base = new Date(Date.UTC(
    Number(get("year")), Number(get("month")) - 1,
    Number(get("day")) + offset
  ));
  return base.toISOString().slice(0, 10);
}

function category(mm) {
  if (mm >= 100) return {
    label: "Very Heavy Rainfall", color: "text-red-700",
    background: "bg-red-50", level: "Very High Rainfall Alert"
  };
  if (mm >= 50) return {
    label: "Heavy Rainfall", color: "text-orange-700",
    background: "bg-orange-50", level: "High Rainfall Alert"
  };
  if (mm >= 20) return {
    label: "Moderate Rainfall", color: "text-amber-700",
    background: "bg-amber-50", level: "Moderate Rainfall Alert"
  };
  return {
    label: "Low Forecast Rainfall", color: "text-emerald-700",
    background: "bg-emerald-50", level: "Low Rainfall Alert"
  };
}

export default function FloodRiskChecker({ onOpenMap }) {
  const [district, setDistrict] = useState("Sunamganj");
  const [date, setDate] = useState(localDate());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    fetch("/data/haorshield_rainfall_risk.geojson")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setGeo)
      .catch(() => {});
  }, []);

  async function checkRisk() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const selected = DISTRICTS.find(d => d.name === district);
      if (!selected) throw new Error("Select a district.");

      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", selected.lat);
      url.searchParams.set("longitude", selected.lon);
      url.searchParams.set(
        "current",
        "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
      );
      url.searchParams.set("hourly", "precipitation");
      url.searchParams.set("forecast_days", "5");
      url.searchParams.set("timezone", "Asia/Dhaka");

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Weather service unavailable.");

      const data = await response.json();
      const times = data.hourly.time;
      const rain = data.hourly.precipitation;

      const now = new Date();
      const futureHours = times
        .map((t, i) => ({
          time: t,
          value: rain[i],
          timestamp: new Date(t + "+06:00")
        }))
        .filter(h => h.timestamp > now);

      const end = new Date(now.getTime() + 72 * 3600000);

      const selectedHours = futureHours.filter(h =>
        h.timestamp <= end &&
        h.time.slice(0, 10) === date
      );

      if (!selectedHours.length) {
        throw new Error(
          "No forecast hours available for this date within the next 72 hours."
        );
      }

      if (selectedHours.some(h => h.value === null)) {
        throw new Error("Some rainfall data is missing.");
      }

      const rainfall = selectedHours.reduce(
        (sum, h) => sum + h.value, 0
      );

      const status = category(rainfall);

      // Spatial exposure proxy uses only matching district cells.
      // A forecast snapshot can be stale; never use it silently.
      let spatial = null;

      if (geo?.metadata?.generated_at) {
        const age = Date.now() -
          new Date(geo.metadata.generated_at).getTime();

        const validSnapshot = age >= 0 && age <= 24 * 3600000;

        if (validSnapshot) {
          const features = geo.features.filter(f =>
            f.properties.district.toLowerCase() ===
            district.toLowerCase()
          );

          // The spatial file contains cumulative 24/48/72h
          // windows, not daily forecasts. We therefore do not
          // incorrectly use it to calculate selected-date area.
          spatial = {
            cells: features.length,
            areaAvailable: false
          };
        }
      }

      setResult({
        district,
        date,
        rainfall,
        hours: selectedHours.length,
        status,
        current: data.current,
        spatial
      });

    } catch (e) {
      setError(e.message || "Unable to retrieve forecast.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-sky-900 to-teal-800 p-7 md:p-10 text-white">
        <div className="flex items-center gap-2 text-sky-100 mb-3">
          <CloudRain size={20}/>
          HaorShield V2
        </div>
        <h2 className="text-3xl md:text-4xl font-bold">
          Check Weather & Flood-Risk Indicators
        </h2>
        <p className="mt-3 text-sky-100 max-w-2xl">
          Select your district and forecast date to check
          current weather and upcoming rainfall conditions.
          Flood probability is not yet available.
        </p>
      </div>

      <div className="bg-white border rounded-2xl p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold text-sm block mb-2">
              <MapPin size={16} className="inline mr-2"/>
              Your location
            </label>
            <select
              value={district}
              onChange={e => setDistrict(e.target.value)}
              className="w-full border rounded-xl p-3"
            >
              {DISTRICTS.map(d => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              Currently uses district-center weather coordinates.
            </p>
          </div>

          <div>
            <label className="font-semibold text-sm block mb-2">
              <CalendarDays size={16} className="inline mr-2"/>
              Forecast date
            </label>
            <input
              type="date"
              value={date}
              min={localDate()}
              max={localDate(3)}
              onChange={e => setDate(e.target.value)}
              className="w-full border rounded-xl p-3"
            />
            <p className="text-xs text-slate-500 mt-2">
              Forecast period: up to 72 hours ahead.
            </p>
          </div>
        </div>

        <button
          onClick={checkRisk}
          disabled={loading}
          className="w-full bg-sky-800 hover:bg-sky-900 text-white rounded-xl p-4 font-bold flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <><Loader2 className="animate-spin" size={19}/> Checking...</>
          ) : (
            <><Search size={19}/> Check My Location</>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className={`rounded-2xl border p-6 ${result.status.background}`}>
            <div className="flex items-center gap-3">
              {result.rainfall < 20
                ? <ShieldCheck size={32} className={result.status.color}/>
                : <AlertTriangle size={32} className={result.status.color}/>
              }
              <div>
                <p className="text-sm">Rainfall screening result</p>
                <h3 className={`text-2xl font-bold ${result.status.color}`}>
                  {result.status.level}
                </h3>
              </div>
            </div>
            <p className="text-sm mt-3">
              This is not a flood-safety clearance or
              a measured flood probability.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-5">
              <p className="text-slate-500 text-sm">Current temperature</p>
              <p className="text-2xl font-bold mt-2">
                {result.current.temperature_2m}°C
              </p>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <p className="text-slate-500 text-sm">Current humidity</p>
              <p className="text-2xl font-bold mt-2">
                {result.current.relative_humidity_2m}%
              </p>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <p className="text-slate-500 text-sm">
                Forecast rainfall on selected date
              </p>
              <p className="text-2xl font-bold mt-2">
                {result.rainfall.toFixed(1)} mm
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {result.hours} forecast hours within the next 72h
              </p>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-6 space-y-3">
            <h3 className="text-lg font-bold">
              Flood Risk & Potential Land Exposure
            </h3>
            <p className="text-sm">
              <strong>Flood probability:</strong> Not available —
              requires a validated forecast model.
            </p>
            <p className="text-sm">
              <strong>Predicted flooded area:</strong> Not available —
              rainfall alone cannot establish inundation boundaries.
            </p>
            <p className="text-sm">
              <strong>Potential agricultural exposure:</strong>
              Not yet estimated for the selected date.
            </p>
            <p className="text-sm text-slate-600">
              Heavy rainfall may increase concern, but river levels,
              upstream flows, terrain and drainage must also
              be assessed.
            </p>
          </div>

          <button
            onClick={onOpenMap}
            className="bg-slate-900 text-white rounded-xl px-5 py-3 font-semibold"
          >
            Explore Geographic Rainfall Map →
          </button>
        </div>
      )}
    </div>
  );
}
