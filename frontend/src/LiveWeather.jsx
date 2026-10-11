
import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import {
  MapPin, CloudRain, Thermometer, Droplets,
  Wind, RefreshCw, AlertCircle
} from "lucide-react";

const DISTRICTS = [
  { name: "Brahmanbaria", lat: 23.96, lon: 91.11 },
  { name: "Habiganj", lat: 24.38, lon: 91.42 },
  { name: "Kishoreganj", lat: 24.44, lon: 90.78 },
  { name: "Moulvibazar", lat: 24.48, lon: 91.77 },
  { name: "Netrakona", lat: 24.88, lon: 90.73 },
  { name: "Sunamganj", lat: 25.07, lon: 91.40 },
  { name: "Sylhet", lat: 24.89, lon: 91.87 }
];

function WeatherCard({ title, value, subtitle, Icon }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <Icon size={18} />
        <span>{title}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 mt-3">
        {value}
      </div>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
      )}
    </div>
  );
}

export default function LiveWeather() {
  const [selected, setSelected] = useState("Sunamganj");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const location = DISTRICTS.find(d => d.name === selected);

  async function loadWeather() {
    setLoading(true);
    setError("");
    setWeather(null);

    try {
      const params = new URLSearchParams({
        latitude: String(location.lat),
        longitude: String(location.lon),
        current:
          "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
        hourly: "precipitation",
        forecast_days: "4",
        timezone: "Asia/Dhaka"
      });

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params}`
      );

      if (!response.ok) {
        throw new Error("Weather service unavailable.");
      }

      const result = await response.json();

      if (!result.current || !result.hourly) {
        throw new Error("Incomplete weather response.");
      }

      const times = result.hourly.time || [];
      const rainfall = result.hourly.precipitation || [];

      // Select future forecast hours after the current observation time.
      const currentTime = result.current.time;
      const firstFutureIndex = times.findIndex(
        t => t > currentTime
      );

      if (firstFutureIndex < 0) {
        throw new Error("Future rainfall forecast unavailable.");
      }

      const futureRainfall = rainfall
        .slice(firstFutureIndex, firstFutureIndex + 72)
        .map(v => Number(v) || 0);

      if (futureRainfall.length < 72) {
        throw new Error("72-hour rainfall forecast is incomplete.");
      }

      const sumRain = hours =>
        futureRainfall
          .slice(0, hours)
          .reduce((sum, value) => sum + value, 0);

      setWeather({
        temperature: result.current.temperature_2m,
        humidity: result.current.relative_humidity_2m,
        precipitation: result.current.precipitation,
        wind: result.current.wind_speed_10m,
        rain24: sumRain(24),
        rain48: sumRain(48),
        rain72: sumRain(72),
        updated: currentTime
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWeather();
  }, [selected]);

  const formatRain = n => `${n.toFixed(1)} mm`;

  return (
    <div className="space-y-7">

      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Live Weather & Rainfall Monitoring
        </h2>
        <p className="text-slate-500 mt-2">
          Current weather and upcoming rainfall forecasts
          across seven northeastern districts of Bangladesh.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <label className="block text-sm font-semibold mb-3">
          <MapPin size={17} className="inline mr-2" />
          Select your district
        </label>

        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="w-full md:w-96 p-3 border border-slate-300 rounded-xl"
        >
          {DISTRICTS.map(d => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>

        <p className="text-xs text-slate-500 mt-3">
          Weather is retrieved for an approximate district-center
          coordinate, not every village within the district.
        </p>
      </div>

      {loading && (
        <div className="bg-cyan-50 p-5 rounded-xl text-cyan-800">
          <RefreshCw className="inline animate-spin mr-2" size={18} />
          Loading latest weather information...
        </div>
      )}

      {error && (
        <div className="bg-red-50 p-5 rounded-xl text-red-700">
          <AlertCircle className="inline mr-2" size={18} />
          {error}
        </div>
      )}

      {weather && !loading && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <WeatherCard
              title="Temperature"
              value={`${weather.temperature} °C`}
              subtitle="Latest available conditions"
              Icon={Thermometer}
            />
            <WeatherCard
              title="Humidity"
              value={`${weather.humidity}%`}
              subtitle="Relative humidity"
              Icon={Droplets}
            />
            <WeatherCard
              title="Precipitation"
              value={`${weather.precipitation} mm`}
              subtitle="Current reported interval"
              Icon={CloudRain}
            />
            <WeatherCard
              title="Wind Speed"
              value={`${weather.wind} km/h`}
              subtitle="Current wind conditions"
              Icon={Wind}
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold mb-5">
              Forecast Rainfall
            </h3>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                ["Next 24 Hours", weather.rain24],
                ["Next 48 Hours", weather.rain48],
                ["Next 72 Hours", weather.rain72]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="bg-cyan-50 rounded-xl p-5"
                >
                  <p className="text-sm text-slate-600">{label}</p>
                  <p className="text-2xl font-bold text-cyan-900 mt-2">
                    {formatRain(value)}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 mt-5">
              Forecast source: Open-Meteo.
              Weather update: {weather.updated} (Asia/Dhaka).
              Rainfall totals are cumulative forecast amounts,
              not flood probabilities.
            </p>
          </div>
        </>
      )}

      <div className="bg-white p-5 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-lg mb-4">
          Selected District Location
        </h3>

        <div className="h-80 rounded-xl overflow-hidden">
          <MapContainer
            key={selected}
            center={[location.lat, location.lon]}
            zoom={10}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[location.lat, location.lon]}>
              <Popup>{selected}, Bangladesh</Popup>
            </Marker>
          </MapContainer>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <p className="font-semibold text-amber-900">
          Weather information is not a flood warning.
        </p>
        <p className="text-sm text-amber-800 mt-2">
          This module displays current weather and forecast rainfall.
          Flood-risk forecasting and estimated danger-area mapping
          will be developed separately and require validation.
        </p>
      </div>

    </div>
  );
}
