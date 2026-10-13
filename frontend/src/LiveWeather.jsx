
import React, { useEffect, useState } from "react";
import {
  CloudSun, CloudRain, Thermometer, Droplets,
  Wind, Clock, AlertTriangle
} from "lucide-react";

const HOURS = [24, 48, 72];

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "Unavailable";
  }
  return `${Number(value).toLocaleString("en-BD", {
    maximumFractionDigits: 1
  })}${suffix}`;
}

function WeatherCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <Icon size={17} />
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-3">{value}</p>
      {detail && <p className="text-xs text-slate-500 mt-2">{detail}</p>}
    </div>
  );
}

export default function LiveWeather() {
  const [data, setData] = useState(null);
  const [district, setDistrict] = useState("Sunamganj");
  const [hours, setHours] = useState(72);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/data/haorshield_live_weather.json?t=${Date.now()}`, {
      signal: controller.signal,
      cache: "no-store"
    })
      .then((response) => {
        if (!response.ok) throw new Error("Weather data unavailable");
        return response.json();
      })
      .then((payload) => {
        if (!Array.isArray(payload.districts) || payload.districts.length !== 7) {
          throw new Error("Incomplete district weather dataset");
        }
        setData(payload);
        setError("");
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Unable to load weather forecast");
        }
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div className="p-6 bg-white border rounded-2xl text-red-700">
        Weather unavailable: {error}
      </div>
    );
  }

  if (!data) {
    return <div className="p-6">Loading live weather forecast...</div>;
  }

  const selected = data.districts.find(
    (item) => item.district === district
  ) || data.districts[0];

  const forecast = selected.forecast[`${hours}h`];
  const observedAt = selected.current.observed_time;

  const issue = new Date(data.issued_at);
  const ageHours = (Date.now() - issue.getTime()) / 3600000;
  const stale = !Number.isFinite(ageHours) || ageHours > 12;

  const formatTime = (value) => {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleString("en-BD", {
          timeZone: "Asia/Dhaka",
          dateStyle: "medium",
          timeStyle: "short"
        });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <CloudSun className="text-sky-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Live Weather & Rainfall Forecast
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Current weather and the next 24–72 hours of forecast rainfall
              for seven northeastern Bangladesh district centers.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6 items-center">
          <label htmlFor="district-weather" className="text-sm font-semibold">
            District
          </label>
          <select
            id="district-weather"
            value={selected.district}
            onChange={(event) => setDistrict(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3"
          >
            {data.districts.map((item) => (
              <option key={item.district} value={item.district}>
                {item.district}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(h)}
                className={`px-4 py-3 rounded-xl border font-semibold ${
                  hours === h
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                {h} hours
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-slate-500 mt-4">
          <Clock size={14} className="inline mr-1" />
          Forecast issued: {formatTime(data.issued_at)}
        </p>

        {stale && (
          <div
            role="alert"
            className="flex gap-2 mt-4 rounded-xl bg-amber-50 border border-amber-300 p-4 text-amber-900 text-sm"
          >
            <AlertTriangle size={20} className="shrink-0" />
            This forecast is more than 12 hours old or its issue time is invalid.
            Check an updated forecast before making decisions.
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">Current conditions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <WeatherCard
            icon={Thermometer}
            label="Temperature"
            value={formatNumber(selected.current.temperature_c, "°C")}
            detail={`Observation time: ${observedAt}`}
          />
          <WeatherCard
            icon={Droplets}
            label="Relative humidity"
            value={formatNumber(
              selected.current.relative_humidity_pct, "%"
            )}
          />
          <WeatherCard
            icon={CloudRain}
            label="Current precipitation"
            value={formatNumber(selected.current.precipitation_mm, " mm")}
          />
          <WeatherCard
            icon={Wind}
            label="Wind speed"
            value={formatNumber(selected.current.wind_speed_kmh, " km/h")}
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">
          Next {hours}-hour rainfall forecast
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <WeatherCard
            icon={CloudRain}
            label="Total forecast rainfall"
            value={formatNumber(forecast.rainfall_total_mm, " mm")}
          />
          <WeatherCard
            icon={Droplets}
            label="Maximum hourly rain chance"
            value={formatNumber(
              forecast.max_hourly_precipitation_probability_pct, "%"
            )}
            detail="Highest single-hour probability, not the chance of rain at least once."
          />
          <WeatherCard
            icon={CloudRain}
            label="Peak hourly intensity"
            value={forecast.rainfall_intensity || "Unavailable"}
            detail={formatNumber(
              forecast.maximum_hourly_rainfall_mm, " mm/hour"
            )}
          />
          <WeatherCard
            icon={Clock}
            label="Forecast horizon"
            value={`${hours} hours`}
            detail="Beginning at the forecast issue window"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-600">
        <strong>Source:</strong> Open-Meteo.
        Rainfall intensity categories are project-defined.
        Weather forecasts are not flood predictions.
        Upstream river flooding can occur even with little local rainfall.
        Always consult official flood warnings.
      </div>
    </div>
  );
}
