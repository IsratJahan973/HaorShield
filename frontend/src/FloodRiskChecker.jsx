
import React, { useEffect, useState } from "react";
import FarmerCropAdvice from "./FarmerCropAdvice.jsx";
import SimpleRainMap from "./SimpleRainMap.jsx";
import LandAttentionMap from "./LandAttentionMap.jsx";
import { summarizeCurrentWeather } from "./weatherNow.js";
import { farmerHorizon, farmerSummary } from "./farmerOutlookView.js";
import { rollingRainfallWindows } from "./rainfallWindows.js";
import { floodConcernOutlooks } from "./floodConcern.js";
import { combinedFloodOutlooks } from "./floodOutlook.js";
import { fetchRiverForecast } from "./riverForecast.js";
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

// Local district suggestions work immediately, even if the geocoding API is offline.
// Search suggestions are only an aid; polygon validation still happens on submit.
const DISTRICT_ALIASES = {
  Brahmanbaria: ["brahmanbaria", "brahmanbariya", "brahman bariya", "brahmanbaria district", "brahman bari", "brahmonbaria"],
  Habiganj: ["habiganj", "hobiganj", "hobigonj", "habigonj", "habigunj"],
  Kishoreganj: ["kishoreganj", "kishoregonj", "kishorganj", "kishorgonj", "kishorganj", "kishoregunj"],
  Moulvibazar: ["moulvibazar", "moulvi bazar", "maulvibazar", "maulvi bazar", "moulvibazaar", "moulobi bazar"],
  Netrakona: ["netrakona", "netrokona", "netrokona", "netrokona district"],
  Sunamganj: ["sunamganj", "sunamgonj", "sunamgunj", "sunamganj district"],
  Sylhet: ["sylhet", "silhet", "silet", "sylhat"]
};

function normalizePlace(text) {
  return String(text || "").toLowerCase().replace(/[^a-z]/g, "");
}

function editDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous.splice(0, previous.length, ...next);
  }
  return previous[b.length];
}

function districtSuggestions(input) {
  const q = normalizePlace(input);
  if (q.length < 2) return [];
  return DISTRICTS.map(place => {
    const aliases = DISTRICT_ALIASES[place.name] || [place.name];
    const score = Math.min(...aliases.map(alias => {
      const name = normalizePlace(alias);
      if (name === q) return 0;
      if (name.startsWith(q)) return 1;
      if (q.length >= 3 && name.includes(q)) return 2;
      if (q.length >= 3) {
        const distance = editDistance(q, name.slice(0, q.length));
        if (distance <= (q.length >= 6 ? 2 : 1)) return 3 + distance;
        if (editDistance(q, name) <= 2) return 6;
      }
      return 99;
    }));
    return { ...place, score };
  }).filter(p => p.score < 99).sort((a, b) => a.score - b.score)
    .slice(0, 5);
}

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

// After 11 PM in Bangladesh, the final hourly forecast for today has
// normally passed. Start with tomorrow rather than a date with zero hours.
function initialForecastDate() {
  const hourParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", hour: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  const hour = Number(hourParts.find(part => part.type === "hour")?.value);
  return localDate(hour >= 23 ? 1 : 0);
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
  const [activeSection, setActiveSection] = useState("flood");
  const [date, setDate] = useState(initialForecastDate());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [scenarioData, setScenarioData] = useState(null);
  const [scenarioError, setScenarioError] = useState("");
  const [districtBoundaries, setDistrictBoundaries] = useState(null);
  const [locationMode, setLocationMode] = useState("district");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = selectedPlace ? [] : districtSuggestions(searchText);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/data/haorshield_sar_future_candidates.geojson", { signal: controller.signal }),
      fetch("/data/haorshield_sar_future_summary.json", { signal: controller.signal })
    ]).then(async ([mapResponse, summaryResponse]) => {
      if (!mapResponse.ok || !summaryResponse.ok) throw new Error("Experimental map data unavailable.");
      const [map, summary] = await Promise.all([mapResponse.json(), summaryResponse.json()]);
      if (map?.type !== "FeatureCollection" || map.features?.length !== 306 ||
          summary?.cells !== 306 || !Number.isFinite(Date.parse(summary.generated_at || "")) ||
          summary.is_validated_flood_probability !== false ||
          summary.is_validated_inundation_prediction !== false) {
        throw new Error("Experimental map data could not be verified.");
      }
      setScenarioData({ map, summary });
      setScenarioError("");
    }).catch(err => {
      if (err.name !== "AbortError") setScenarioError(err.message);
    });
    return () => controller.abort();
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

  function chooseSuggestedDistrict(place) {
    setSelectedPlace({ name: place.name, lat: place.lat, lon: place.lon });
    setDistrict(place.name);
    setSearchText(place.name);
    setSearchResults([]);
    setShowSuggestions(false);
    setLocationError("");
    setResult(null);
  }

  async function searchLocations() {
    const query = searchText.trim();
    if (query.length < 2) {
      setLocationError("Enter at least two characters.");
      return;
    }

    // Keep a supported district match usable without any external service.
    const localMatches = districtSuggestions(query);
    setSearching(true);
    setLocationError("");
    setShowSuggestions(false);
    setSearchResults([]);
    setSelectedPlace(null);

    try {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.searchParams.set("name", query);
      url.searchParams.set("count", "30");
      url.searchParams.set("language", "en");
      url.searchParams.set("countryCode", "BD");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Location search service unavailable.");
      const data = await response.json();

      // Do not offer misleading outside-district names (e.g. Kishoreganj,
      // Nilphamari). The SAME boundary check is applied again on submit.
      const supported = (data.results || []).filter(place => {
        if (place.country_code !== "BD" ||
            !Number.isFinite(place.latitude) ||
            !Number.isFinite(place.longitude)) return false;
        try {
          return DISTRICTS.some(d => d.name ===
            findSupportedDistrict(place.latitude, place.longitude));
        } catch { return false; }
      });
      const unique = supported.filter((p, i, all) =>
        all.findIndex(other => other.latitude === p.latitude &&
          other.longitude === p.longitude) === i);
      setSearchResults(unique);
      if (!unique.length) {
        setShowSuggestions(true);
        setLocationError(localMatches.length
          ? "No additional supported towns found. Choose a suggested district."
          : "No supported places found. Try a district name or another spelling.");
      }
    } catch {
      setShowSuggestions(true);
      setLocationError(localMatches.length
        ? "Town search is temporarily unavailable. Choose a district suggestion."
        : "Town search is temporarily unavailable. Try a supported district name.");
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
    setActiveSection("flood");

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
        "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code"
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

      const rollingOutlooks = rollingRainfallWindows(futureHours, now);
      const floodConcern = floodConcernOutlooks(rollingOutlooks);
      // A genuine hydrological river-flow forecast, not rainfall relabeled as flood probability.
      // Do not suppress weather results if the separate river service is unavailable.
      let riverForecast = null;
      let riverForecastError = null;
      try {
        riverForecast = await fetchRiverForecast(selected.lat, selected.lon);
      } catch (hydrologyError) {
        riverForecastError = hydrologyError.message || 'River-flow forecast unavailable';
      }
      const end = new Date(now.getTime() + 72 * 3600000);

      const selectedHours = futureHours.filter(h =>
        h.timestamp <= end &&
        h.time.slice(0, 10) === date
      );

      if (!selectedHours.length) {
        const availableDates = [...new Set(futureHours
          .filter(h => h.timestamp <= end && !Number.isNaN(h.timestamp.getTime()))
          .map(h => h.time.slice(0, 10)))];
        if (date === localDate() && availableDates.length && !availableDates.includes(date)) {
          throw new Error(
            `No forecast hours remain today. Please choose ${availableDates[0]} to see the next available rainfall forecast.`
          );
        }
        if (availableDates.length) {
          throw new Error(
            `No usable forecast hours for ${date}. Available forecast dates within the next 72 hours: ${availableDates.join(", ")}.`
          );
        }
        throw new Error(
          "The weather service returned no usable future hourly forecasts. Please try again later."
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

      // Research scenarios have an independent issue anchor, not the selected
      // weather calendar day. Never present them as that day's flood prediction.
      const spatial = null;

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
        rollingOutlooks,
        floodConcern,
        combinedFloodOutlooks: combinedFloodOutlooks(floodConcern, riverForecast),
        riverForecast,
        riverForecastError,
        status,
        current: data.current,
        weatherNow: summarizeCurrentWeather(data.current, retrievedAt),
        spatial
      });

    } catch (e) {
      setError(e.message || "Unable to retrieve forecast.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <nav aria-label="HaorShield sections" className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-2xl border bg-white p-2 sticky top-0 z-20 shadow-sm">
        {[
          ["flood", "🌊 Flood Check"],
          ["weather", "☀️ Weather"],
          ["map", "🗺️ Rain Map"],
          ["crops", "🌾 Crop Advice"]
        ].map(([key, title]) => (
          <button key={key} type="button" aria-current={activeSection === key ? "page" : undefined}
            onClick={() => setActiveSection(key)}
            className={`rounded-xl px-3 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${activeSection === key ? "bg-sky-800 text-white" : "text-slate-800 bg-slate-50 hover:bg-sky-100"}`}>
            {title}
          </button>
        ))}
      </nav>
      {activeSection === "flood" && <div className="bg-white rounded-2xl p-5 md:p-7 border">
        <h2 className="text-2xl md:text-3xl font-bold">Will rain or rising rivers affect my area?</h2>
        <p className="text-slate-700 mt-2">Choose your area. Check what the next three days may bring.</p>
      </div>}

      {activeSection === "flood" && <div className="bg-white border rounded-2xl p-6 space-y-5">
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
                  setSearchText("");
                  setSelectedPlace(null);
                  setSearchResults([]);
                  setShowSuggestions(false);
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
                    setShowSuggestions(true);
                    setLocationError("");
                  }}
                  placeholder=""
                  autoComplete="off"
                  aria-label="Search a district or town"
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={e => {
                    if (e.key === "Escape") setShowSuggestions(false);
                    if (e.key === "Enter" && suggestions.length) {
                      e.preventDefault();
                      chooseSuggestedDistrict(suggestions[0]);
                    }
                  }}
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

              {showSuggestions && suggestions.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden" role="listbox" aria-label="Suggested supported districts">
                  <p className="px-3 py-2 text-xs text-slate-500">Suggested supported districts</p>
                  {suggestions.map(place => (
                    <button key={place.name} type="button" role="option"
                      aria-selected={false}
                      onClick={() => chooseSuggestedDistrict(place)}
                      className="block w-full text-left px-3 py-3 text-sm border-t hover:bg-sky-50 focus:bg-sky-50">
                      {place.name} District, Bangladesh
                    </button>
                  ))}
                </div>
              )}

              {searchResults.length > 0 && (
                <select
                  value={selectedPlace
                    ? `${selectedPlace.lat},${selectedPlace.lon}`
                    : ""}
                  onChange={e => {
                    const match = searchResults.find(p =>
                      `${p.latitude},${p.longitude}` === e.target.value
                    );
                    if (match) {
                      setSearchText(match.name);
                      setShowSuggestions(false);
                      setLocationError("");
                    }
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
      </div>}

      {activeSection === "flood" && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
          {error}
        </div>
      )}

      {!result && activeSection !== "flood" && (
        <div className="bg-white rounded-2xl border p-6 space-y-3">
          <h2 className="text-xl font-bold">Check your area first</h2>
          <p>Choose a district or use your location to see updated information here.</p>
          <button type="button" onClick={() => setActiveSection("flood")} className="bg-sky-800 text-white rounded-lg px-5 py-3 font-semibold">Go to Flood Check</button>
        </div>
      )}
      {result && activeSection === "flood" && (
        <div className="space-y-5">
          <section aria-label="Your flood outlook" className="rounded-2xl bg-white border border-sky-200 p-5 md:p-7 space-y-4">
            <h3 className="text-2xl font-bold">Your area: {result.supportedDistrict}</h3>
            <p className="text-sm text-slate-600">Checked {new Date(result.retrievedAt).toLocaleString("en-BD", {timeZone:"Asia/Dhaka"})}</p>
            <div>
              <h4 className="text-xl font-bold">What may happen in the next 3 days?</h4>
              <p className="text-sm text-slate-600 mt-1">Look at each period to see the rain and flood concern for your area.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {result.combinedFloodOutlooks.map(outlook => {
                const rainfall = result.rollingOutlooks.find(x => x.horizonHours === outlook.horizonHours);
                const item = farmerHorizon(outlook, rainfall);
                const tones = { sky: "bg-sky-50 border-sky-300", amber: "bg-yellow-50 border-yellow-400", orange: "bg-orange-50 border-orange-400", red: "bg-red-50 border-red-500", slate: "bg-slate-100 border-slate-300" };
                return <div key={outlook.horizonHours} className={`rounded-2xl border-2 p-4 ${tones[item.tone]}`}>
                  <div className="flex items-center justify-between gap-2"><p className="font-semibold">Next {outlook.horizonHours} hours</p><span className="text-2xl" aria-hidden="true">{item.icon}</span></div>
                  <p className="text-xl font-extrabold mt-2">{item.title}</p>
                  <p className="mt-2 font-semibold text-sm">🌧️ {item.rainText}</p>
                  <p className="text-sm mt-2 text-slate-700">{item.detail}</p>
                </div>;
              })}
            </div>
            <LandAttentionMap district={result.supportedDistrict} forecastDate={result.date} scenarioData={scenarioData} scenarioError={scenarioError} outlooks={result.combinedFloodOutlooks} />
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
              <h4 className="text-lg font-bold">Why does HaorShield show this?</h4>
              {farmerSummary(result.combinedFloodOutlooks, result.riverForecast).lines.map((line, i) => <p className="text-sm text-slate-700" key={i}>{line}</p>)}
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <h4 className="font-bold text-lg">What should I do?</h4>
              <ul className="mt-2 space-y-2 list-disc ml-5 text-sm md:text-base">
                {farmerSummary(result.combinedFloodOutlooks, result.riverForecast).advice.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
            {result.currentOutdated && <p role="alert" className="font-semibold text-amber-800">Weather information may be old. Check official updates.</p>}
            <p className="text-xs text-slate-600">These are early signs, not a confirmed flood prediction. Follow official Bangladesh flood warnings.</p>
          </section>
        </div>
      )}
      {result && activeSection === "weather" && (
        <section className="bg-white rounded-2xl border p-5 md:p-7 space-y-4" aria-label="Local weather">
          <h2 className="text-2xl font-bold">Weather in {result.supportedDistrict}</h2>
                      <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-white border border-sky-200 p-4 md:p-5" aria-label="Current weather">
              <div className="flex gap-3 items-center mb-3">
                <span className="text-3xl" aria-hidden="true">{result.weatherNow.description === "Clear sky" ? "☀️" : /rain|drizzle|storm/i.test(result.weatherNow.description) ? "🌧️" : "⛅"}</span>
                <div><h4 className="text-lg font-bold">Weather right now</h4><p className="text-sm text-slate-600">{result.weatherNow.fresh ? result.weatherNow.description : "Latest weather unavailable"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="bg-white rounded-xl p-3 border border-sky-100"><p className="text-xs text-slate-600">Temperature</p><p className="text-xl font-bold">{result.weatherNow.temperatureC === null ? "—" : `${result.weatherNow.temperatureC.toFixed(1)}°C`}</p></div>
                <div className="bg-white rounded-xl p-3 border border-sky-100"><p className="text-xs text-slate-600">Rain in latest report</p><p className="text-xl font-bold">{result.weatherNow.rainMm === null ? "—" : `${result.weatherNow.rainMm.toFixed(1)} mm`}</p></div>
                <div className="bg-white rounded-xl p-3 border border-sky-100 col-span-2 sm:col-span-1"><p className="text-xs text-slate-600">Chance of rain today*</p><p className="text-xl font-bold">{result.maxHourlyPrecipChance === null ? "—" : `${Math.round(result.maxHourlyPrecipChance)}%`}</p></div>
              </div>
              <p className="text-xs text-slate-500 mt-2">*Highest forecast chance in the remaining hours of the selected day, not a full-day average. Weather service estimates.</p>
            </div>

          <h3 className="text-lg font-semibold">Rain expected</h3>
          <div className="grid grid-cols-3 gap-2">
            {result.rollingOutlooks.map(item => <div key={item.horizonHours} className="rounded-xl bg-sky-50 border p-3">
              <p className="text-sm font-semibold">Next {item.horizonHours} hours</p>
              <p className="text-lg font-bold">{Number.isFinite(item.rainfallMm) ? `${item.rainfallMm.toFixed(1)} mm` : "Not available"}</p>
            </div>)}
          </div>
        </section>
      )}
      {result && activeSection === "map" && (
        <section aria-label="Rain map" className="space-y-3">
          <h2 className="text-2xl font-bold">Rain map for {result.supportedDistrict}</h2>
          <SimpleRainMap district={result.supportedDistrict} hours={24}/>
        </section>
      )}
      {result && activeSection === "crops" && (
        <section aria-label="Crop advice">
          <FarmerCropAdvice concerns={result.combinedFloodOutlooks} />
        </section>
      )}
    </div>
  );
}
