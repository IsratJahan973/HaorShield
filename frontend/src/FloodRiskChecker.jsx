
import React, { useEffect, useState } from "react";
import CropEarlyAction from "./CropEarlyAction.jsx";
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

// Project-specific screening bands for 24-hour-equivalent rainfall.
// They are NOT official BMD categories or flood-risk probabilities.
export function category(mm, hours = 24) {
  const rate = hours > 0 ? (Number(mm) * 24 / hours) : 0;
  if (rate >= 100) return {
    label: "Very Heavy", color: "text-red-700",
    background: "bg-red-50", level: "Very Heavy Rainfall"
  };
  if (rate >= 50) return {
    label: "Heavy", color: "text-orange-700",
    background: "bg-orange-50", level: "Heavy Rainfall"
  };
  if (rate >= 10) return {
    label: "Moderate", color: "text-amber-700",
    background: "bg-amber-50", level: "Moderate Rainfall"
  };
  if (rate > 0) return {
    label: "Light", color: "text-sky-700",
    background: "bg-sky-50", level: "Light Rainfall"
  };
  return {
    label: "No Rain", color: "text-slate-700",
    background: "bg-slate-100", level: "No Rain Forecast"
  };
}


function rainfallGuidance(mm) {
  if (mm >= 100) {
    return {
      heading: "Very heavy rainfall — heightened awareness",
      message: "Very heavy forecast rainfall may increase local flooding concerns, especially in low-lying areas.",
      actions: [
        "Monitor official flood and weather bulletins.",
        "Avoid flooded roads and fast-moving water.",
        "Prepare essential documents, medicines and emergency supplies.",
        "Follow local authority instructions if warnings are issued."
      ]
    };
  }

  if (mm >= 50) {
    return {
      heading: "Heavy rainfall — prepare and monitor",
      message: "Heavy forecast rainfall may cause waterlogging and increase concern in vulnerable locations.",
      actions: [
        "Check official weather and river-level updates.",
        "Keep important belongings above floor level where appropriate.",
        "Avoid crossing waterlogged roads without knowing the depth.",
        "Check local emergency contact information."
      ]
    };
  }

  if (mm >= 10) {
    return {
      heading: "Moderate rainfall — stay informed",
      message: "Moderate forecast rainfall warrants attention to local drainage and changing conditions.",
      actions: [
        "Follow local forecasts and official advisories.",
        "Be cautious near canals, rivers and low-lying roads.",
        "Plan outdoor travel with possible rainfall in mind."
      ]
    };
  }

  return {
    heading: "Low forecast rainfall — continue monitoring",
    message: "Low local rainfall does not rule out river flooding, upstream rainfall effects or existing inundation.",
    actions: [
      "Continue checking official flood and river-level bulletins.",
      "Watch for changes in upstream conditions.",
      "Do not interpret this screening result as a flood-safety clearance."
    ]
  };
}


function HistoricalAgriculturalExposure({ district }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/data/haorshield_agricultural_context.json")
      .then(response => {
        if (!response.ok) {
          throw new Error("Agricultural data unavailable");
        }
        return response.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        Historical agricultural information is temporarily unavailable.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        Loading historical agricultural information...
      </div>
    );
  }

  const records = data.districts?.[district] || [];

  if (!records.length) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        No historical agricultural records for this district.
      </div>
    );
  }

  const format = number =>
    Number(number).toLocaleString("en-US", {
      maximumFractionDigits: 1
    });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-bold text-slate-900">
        Historical Agricultural Exposure — {district}
      </h3>

      <p className="mt-2 text-sm text-slate-600">
        Estimated mapped cropland overlapping historical
        MODIS-detected flooding. These are past flood events,
        not predictions for your selected forecast date.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3">Historical event</th>
              <th className="p-3">Flooded cropland (ha)</th>
              <th className="p-3">Exposure (%)</th>
            </tr>
          </thead>
          <tbody>
            {records.map(event => (
              <tr key={event.event_id} className="border-b">
                <td className="p-3">{event.event_label}</td>
                <td className="p-3">
                  {format(event.historically_flooded_cropland_ha)}
                </td>
                <td className="p-3">
                  {format(event.historical_exposure_pct)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Sources: Global Flood Database MODIS Events V1 and
        ESA WorldCover 2021 cropland (class 40).
        The 2021 cropland layer is used as a proxy for earlier
        events. Estimates are not verified crop damage.
      </p>
    </section>
  );
}

export default function FloodRiskChecker({ onOpenMap, onOpenForecast }) {
  const [district, setDistrict] = useState("Sunamganj");
  const [date, setDate] = useState(localDate());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [geo, setGeo] = useState(null);
  const [districtBoundaries, setDistrictBoundaries] = useState(null);
  const [locationMode, setLocationMode] = useState("district");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    fetch("/data/haorshield_rainfall_risk.geojson")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setGeo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/data/haorshield_districts.geojson")
      .then(r => {
        if (!r.ok) throw new Error("District boundaries unavailable");
        return r.json();
      })
      .then(setDistrictBoundaries)
      .catch(() => setDistrictBoundaries(null));
  }, []);

  function pointInRing(lon, lat, ring) {
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];

      if ((yi > lat) !== (yj > lat) &&
          lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }

    return inside;
  }

  function pointInPolygon(lon, lat, polygon) {
    if (!polygon.length || !pointInRing(lon, lat, polygon[0])) {
      return false;
    }

    return !polygon.slice(1).some(
      hole => pointInRing(lon, lat, hole)
    );
  }

  function findSupportedDistrict(lat, lon) {
    if (!districtBoundaries?.features?.length) {
      throw new Error(
        "District boundary data is not ready. Please retry."
      );
    }

    for (const feature of districtBoundaries.features) {
      const geometry = feature.geometry;
      if (!geometry) continue;

      const polygons = geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates
          : [];

      if (polygons.some(polygon =>
        pointInPolygon(lon, lat, polygon)
      )) {
        const name = feature.properties?.ADM2_NAME || "";
        return name === "Brahamanbaria"
          ? "Brahmanbaria"
          : name === "Maulvibazar"
            ? "Moulvibazar"
            : name;
      }
    }

    return null;
  }

  async function searchLocations() {
    const query = searchText.trim();
    if (query.length < 2) {
      setLocationError("Enter at least two characters.");
      return;
    }

    setSearching(true);
    setLocationError("");
    setSearchResults([]);
    setSelectedPlace(null);

    try {
      const url = new URL(
        "https://geocoding-api.open-meteo.com/v1/search"
      );
      url.searchParams.set("name", query);
      url.searchParams.set("count", "20");
      url.searchParams.set("language", "en");
      url.searchParams.set("countryCode", "BD");

      const response = await fetch(url);
      if (!response.ok) throw new Error("Location search failed.");

      const data = await response.json();
      const matches = (data.results || []).filter(place =>
        place.country_code === "BD"
      );

      setSearchResults(matches);

      if (!matches.length) {
        setLocationError(
          "No matching locations found. Try another spelling or nearby town."
        );
      }
    } catch (e) {
      setLocationError(e.message || "Unable to search locations.");
    } finally {
      setSearching(false);
    }
  }

  function useGPS() {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("GPS is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        setGpsLocation({
          name: "My GPS Location",
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      () => setLocationError(
        "Unable to access GPS. Check browser location permissions."
      ),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  }

  function getLocation() {
    if (locationMode === "search") {
      if (!selectedPlace) {
        throw new Error("Select a location from the search results.");
      }
      return selectedPlace;
    }

    if (locationMode === "gps") {
      if (!gpsLocation) {
        throw new Error("Click Use My GPS Location first.");
      }
      return gpsLocation;
    }

    const selected = DISTRICTS.find(d => d.name === district);
    if (!selected) throw new Error("Select a district.");
    return selected;
  }

  async function checkRisk() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const selected = getLocation();

      const supportedDistrict = findSupportedDistrict(
        selected.lat, selected.lon
      );

      if (!supportedDistrict) {
        throw new Error(
          "This location is outside HaorShield's seven supported districts."
        );
      }

      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", selected.lat);
      url.searchParams.set("longitude", selected.lon);
      url.searchParams.set(
        "current",
        "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
      );
      url.searchParams.set("hourly", "precipitation,precipitation_probability");
      url.searchParams.set("forecast_days", "5");
      url.searchParams.set("timezone", "Asia/Dhaka");

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Weather service unavailable.");

      const data = await response.json();
      const times = data.hourly?.time;
      const rain = data.hourly?.precipitation;
      const rainProbabilities = data.hourly?.precipitation_probability;
      if (!Array.isArray(times) || !Array.isArray(rain) || times.length !== rain.length) {
        throw new Error("Incomplete hourly rainfall forecast from the weather source.");
      }

      const now = new Date();
      const futureHours = times
        .map((t, i) => ({
          time: t,
          value: rain[i],
          probability: Array.isArray(rainProbabilities) &&
            Number.isFinite(Number(rainProbabilities[i])) &&
            rainProbabilities[i] !== null
              ? Number(rainProbabilities[i]) : null,
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

      if (selectedHours.some(h => h.value === null || !Number.isFinite(Number(h.value)) || Number(h.value) < 0)) {
        throw new Error("Some rainfall data is missing.");
      }

      const rainfall = selectedHours.reduce(
        (sum, h) => sum + Number(h.value), 0
      );

      const status = category(rainfall, selectedHours.length);
      const availablePops = selectedHours
        .map(h => h.probability)
        .filter(p => Number.isFinite(p) && p >= 0 && p <= 100);
      const maxHourlyPrecipChance = availablePops.length === selectedHours.length
        ? Math.max(...availablePops) : null;
      const retrievedAt = new Date().toISOString();
      const observationTime = data.current?.time || null;
      const weatherAgeHours = observationTime
        ? (Date.now() - new Date(observationTime + "+06:00").getTime()) / 3600000
        : Infinity;
      const currentOutdated = !Number.isFinite(weatherAgeHours) ||
        weatherAgeHours < -1 || weatherAgeHours > 6;
      const rainRate24 = rainfall * 24 / selectedHours.length;

      // Spatial exposure proxy uses only matching district cells.
      // A forecast snapshot can be stale; never use it silently.
      let spatial = null;

      if (geo?.metadata?.generated_at) {
        const age = Date.now() -
          new Date(geo.metadata.generated_at).getTime();

        const validSnapshot = age >= 0 && age <= 24 * 3600000;

        if (validSnapshot && locationMode === "district") {
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
        district: selected.name,
        supportedDistrict,
        coordinates: {
          lat: selected.lat,
          lon: selected.lon
        },
        date,
        rainfall,
        rainRate24,
        maxHourlyPrecipChance,
        hours: selectedHours.length,
        retrievedAt,
        observationTime,
        currentOutdated,
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
        <div className="space-y-3">
          <label className="font-semibold text-sm block">
            Location selection method
          </label>

          <div className="flex flex-wrap gap-2">
            {[
              ["district", "Select District"],
              ["search", "Search Location"],
              ["gps", "Use GPS"]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setLocationMode(value);
                  setLocationError("");
                  setResult(null);
                }}
                className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                  locationMode === value
                    ? "bg-sky-800 text-white"
                    : "bg-white text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {locationMode === "search" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={searchText}
                  onChange={e => {
                    setSearchText(e.target.value);
                    setSelectedPlace(null);
                    setSearchResults([]);
                  }}
                  placeholder="Search town or upazila"
                  className="flex-1 min-w-0 border rounded-xl p-3"
                />
                <button
                  type="button"
                  onClick={searchLocations}
                  disabled={searching}
                  className="bg-sky-800 text-white px-4 rounded-xl"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <select
                  value={selectedPlace
                    ? `${selectedPlace.lat},${selectedPlace.lon}`
                    : ""}
                  onChange={e => {
                    const match = searchResults.find(p =>
                      `${p.latitude},${p.longitude}` === e.target.value
                    );
                    setSelectedPlace(match ? {
                      name: match.name +
                        (match.admin1 ? `, ${match.admin1}` : ""),
                      lat: match.latitude,
                      lon: match.longitude
                    } : null);
                  }}
                  className="w-full border rounded-xl p-3"
                >
                  <option value="">Select a matching location</option>
                  {searchResults.map((place, i) => (
                    <option
                      key={i}
                      value={`${place.latitude},${place.longitude}`}
                    >
                      {place.name}
                      {place.admin2 ? `, ${place.admin2}` : ""}
                      {place.admin1 ? `, ${place.admin1}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {locationMode === "gps" && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={useGPS}
                className="bg-sky-800 text-white rounded-xl px-4 py-3"
              >
                Use My GPS Location
              </button>
              {gpsLocation && (
                <p className="text-sm text-emerald-700">
                  GPS location received:
                  {" "}{gpsLocation.lat.toFixed(4)},
                  {" "}{gpsLocation.lon.toFixed(4)}
                </p>
              )}
            </div>
          )}

          {locationError && (
            <p className="text-sm text-red-700">{locationError}</p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {locationMode === "district" && <div>
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
          </div>}

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

      {!result && (
        <CropEarlyAction
          district={district}
          date={date}
          rainfallMm={null}
          forecastHours={0}
          isOutdated={true}
        />
      )}

      {result && (
        <div className="space-y-5">
          <div className={`rounded-2xl border p-6 ${result.status.background}`}>
            <div className="flex items-center gap-3">
              {result.rainRate24 < 10
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
              Screening bands use a 24-hour-equivalent rainfall rate:
              No Rain (0), Light (&gt;0–&lt;10), Moderate (10–&lt;50),
              Heavy (50–&lt;100), Very Heavy (100+ mm/24h).
              These are project-defined weather categories, not official flood-risk levels.
              This is not a flood-safety clearance or a measured flood probability.
            </p>
          </div>

          <div className="bg-white border rounded-xl p-4 text-sm">
            <strong>Forecast location:</strong> {result.district}
            <span className="text-slate-500">
              {" "}— {result.supportedDistrict} District
            </span>
            <span className="text-slate-500">
              {" "}({result.coordinates.lat.toFixed(4)},
              {" "}{result.coordinates.lon.toFixed(4)})
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-5">
              <p className="text-slate-500 text-sm">Current temperature</p>
              <p className="text-2xl font-bold mt-2">
                {Number.isFinite(result.current?.temperature_2m) ? `${result.current.temperature_2m}°C` : "Unavailable"}
              </p>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <p className="text-slate-500 text-sm">Current humidity</p>
              <p className="text-2xl font-bold mt-2">
                {Number.isFinite(result.current?.relative_humidity_2m) ? `${result.current.relative_humidity_2m}%` : "Unavailable"}
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
            <div className="bg-white border rounded-xl p-5">
              <p className="text-slate-500 text-sm">Current precipitation</p>
              <p className="text-2xl font-bold mt-2">
                {Number.isFinite(result.current?.precipitation) ? `${result.current.precipitation} mm` : "Unavailable"}
              </p>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <p className="text-slate-500 text-sm">Current wind speed</p>
              <p className="text-2xl font-bold mt-2">
                {Number.isFinite(result.current?.wind_speed_10m) ? `${result.current.wind_speed_10m} km/h` : "Unavailable"}
              </p>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <p className="text-slate-500 text-sm">Chance of precipitation</p>
              <p className="text-2xl font-bold mt-2">
                {result.maxHourlyPrecipChance === null ? "Unavailable" : `${result.maxHourlyPrecipChance.toFixed(0)}%`}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Highest hourly rain chance among {result.hours} forecast hours, not a flood probability.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p><strong>Weather observation time:</strong> {result.observationTime || "Unavailable"} (Asia/Dhaka local time)</p>
            <p className="mt-1"><strong>Forecast retrieved:</strong> {new Date(result.retrievedAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}</p>
            <p className="mt-1">Rainfall total covers {result.hours} available hours on {result.date}; intensity category uses the equivalent {result.rainRate24.toFixed(1)} mm/24h rate, not a full-day observed total.</p>
            {result.currentOutdated && <p role="alert" className="mt-2 font-semibold text-amber-800">Weather observation time is missing or outdated. Check an updated forecast.</p>}
          </div>

          <CropEarlyAction
            district={result.supportedDistrict}
            date={result.date}
            rainfallMm={result.rainfall}
            forecastHours={result.hours}
            isOutdated={result.currentOutdated}
          />

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {rainfallGuidance(result.rainRate24).heading}
              </h3>
              <p className="text-sm text-slate-700 mb-3">
                {rainfallGuidance(result.rainRate24).message}
              </p>
              <p className="font-semibold text-slate-900 mb-2">
                Recommended precautions
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                {rainfallGuidance(result.rainRate24).actions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                General preparedness guidance only. Follow official
                Bangladesh Meteorological Department and Flood
                Forecasting and Warning Centre advisories.
              </p>
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


          

          {onOpenForecast && (
            <button
              type="button"
              onClick={() => onOpenForecast({ district: result.supportedDistrict })}
              className="mr-3 mb-3 rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white"
            >
              View {result.supportedDistrict} experimental 24/48/72-hour spatial scenarios →
            </button>
          )}
          <p className="mb-3 text-xs text-slate-600">
            The separate SAR spatial scenario is anchored to its own issue time; it is not a forecast uniquely produced for the selected calendar date.
          </p>
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
