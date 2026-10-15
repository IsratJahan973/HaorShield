
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

            <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <h4 className="font-semibold text-slate-900">Experimental geographic and cropland screening</h4>
              <p className="text-sm text-slate-700">
                These are separate 24/48/72-hour research scenarios for {result.supportedDistrict}.
                They are <strong>not predictions for {result.date}</strong> and are not verified flooded areas.
              </p>
              {scenarioError && <p role="alert" className="text-sm text-amber-900">{scenarioError}</p>}
              {!scenarioData && !scenarioError && <p className="text-sm">Loading experimental scenario information...</p>}
              {scenarioData && (() => {
                const { map, summary } = scenarioData;
                const cells = map.features.filter(f => f.properties?.district === result.supportedDistrict);
                const ageHours = (Date.now() - Date.parse(summary.generated_at)) / 3600000;
                const stale = !Number.isFinite(ageHours) || ageHours < 0 || ageHours > 24;
                if (!cells.length) return <p className="text-sm">No geographic cells available for this district.</p>;
                return <>
                  <p className="text-xs text-slate-700">Research data issue date: {summary.issue_anchor_date_utc || "Unknown"} (UTC). {stale ? "This research snapshot is outdated or its timestamp is uncertain. Do not use it for current decisions." : "This is a recent experimental snapshot, not an official flood warning."}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[450px] text-left text-sm">
                      <thead><tr className="border-b border-emerald-200"><th className="py-2 pr-3">Research horizon</th><th className="py-2 pr-3">Concern area (km²)</th><th className="py-2">Cropland in concern cells (ha)</th></tr></thead>
                      <tbody>{[24,48,72].map(h => {
                        const valid = cells.every(f => {
                          const p = f.properties;
                          const fraction = p[`sar_candidate_fraction_${h}h`];
                          return Number.isFinite(fraction) && fraction >= 0 && fraction <= 1 &&
                            Number.isFinite(p.cell_area_ha) && p.cell_area_ha > 0 &&
                            Number.isFinite(p.cropland_ha) && p.cropland_ha >= 0 &&
                            p.cropland_ha <= p.cell_area_ha;
                        });
                        if (!valid) return <tr key={h}><td className="py-2">{h}h</td><td colSpan={2}>Data unavailable</td></tr>;
                        const flagged = cells.filter(f => f.properties[`sar_candidate_fraction_${h}h`] >= 0.10);
                        const area = flagged.reduce((sum,f) => sum + f.properties.cell_area_ha / 100, 0);
                        const crop = flagged.reduce((sum,f) => sum + f.properties.cropland_ha, 0);
                        return <tr key={h} className="border-b border-emerald-100"><td className="py-2">{h} hours</td><td className="py-2">{area.toFixed(1)}</td><td className="py-2">{Math.round(crop).toLocaleString("en-BD")}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-700">The full area of each cell passing an illustrative 10% SAR-candidate cutoff is counted. These figures do not measure inundation, confirmed crop damage or a calibrated risk level.</p>
                </>;
              })()}
            </section>
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
