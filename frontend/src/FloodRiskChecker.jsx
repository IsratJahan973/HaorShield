
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
    label: "Low Forecast Rainfall", color: "text-slate-700",
    background: "bg-slate-100", level: "Low Rainfall Alert"
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

  if (mm >= 20) {
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

export default function FloodRiskChecker({ onOpenMap }) {
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

          
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {rainfallGuidance(result.rainfall).heading}
              </h3>
              <p className="text-sm text-slate-700 mb-3">
                {rainfallGuidance(result.rainfall).message}
              </p>
              <p className="font-semibold text-slate-900 mb-2">
                Recommended precautions
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                {rainfallGuidance(result.rainfall).actions.map((action, i) => (
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
