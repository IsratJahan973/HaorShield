/**
 * Copernicus GloFAS v4 daily *river-discharge* forecast via Open-Meteo.
 * This is a genuine hydrological forecast, but it is NOT a calibrated flood
 * occurrence probability, official danger-level warning, or inundation map.
 * Historical simulated discharge references use the SAME GloFAS v4 family.
 */
const API = 'https://flood-api.open-meteo.com/v1/flood';
const historicalCache = new Map();

function finiteNonNegative(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }
export function quantile(values, p) {
  const a = values.filter(finiteNonNegative).sort((x,y) => x-y);
  if (!a.length) return null;
  const index = (a.length-1)*p;
  const lo = Math.floor(index), hi = Math.ceil(index);
  return a[lo] + (a[hi]-a[lo])*(index-lo);
}
function parseDaily(data) {
  if (!Array.isArray(data?.daily?.time) || !Array.isArray(data?.daily?.river_discharge) ||
      data.daily.time.length !== data.daily.river_discharge.length) {
    throw new Error('Hydrological service returned incomplete river-flow data.');
  }
  return data.daily.time.map((date, i) => ({date, flow: data.daily.river_discharge[i]}))
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && finiteNonNegative(x.flow));
}
export function distanceKm(aLat, aLon, bLat, bLon) {
  const values = [aLat, aLon, bLat, bLon].map(Number);
  if (!values.every(Number.isFinite)) return Infinity;
  const [lat1, lon1, lat2, lon2] = values;
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
function forecastLevel(q, p90, p95) {
  if (!finiteNonNegative(q) || !finiteNonNegative(p90) || !finiteNonNegative(p95)) return 'Unavailable';
  if (q >= p95) return 'Unusually high river flow';
  if (q >= p90) return 'Elevated river flow';
  return 'Within historical flow range';
}
export function evaluateRiverForecast(forecast, historical, requested, now = new Date()) {
  const h = parseDaily(historical);
  const f = parseDaily(forecast);
  // Model-cell proximity is NOT proof that the sampled watercourse is
  // the local river. Fail closed for distant cells or inconsistent grid data.
  const distance = distanceKm(requested.lat, requested.lon,
    forecast.latitude, forecast.longitude);
  if (distance > 8) throw new Error('No nearby modeled river cell (within 8 km); river-flow outlook unavailable.');
  const historyDistance = distanceKm(forecast.latitude, forecast.longitude,
    historical.latitude, historical.longitude);
  if (historyDistance > 1) throw new Error('Historical and forecast river-flow grid cells differ; cannot compare their flows.');
  if (h.length < 365*8) throw new Error('Insufficient historical river-flow reference data.');
  const p90 = quantile(h.map(v => v.flow), .9);
  const p95 = quantile(h.map(v => v.flow), .95);
  if (p95 < 2) throw new Error('Modeled river discharge too small for a dependable river assessment here.');
  const today = now.toISOString().slice(0, 10);
  const upcoming = f.filter(v=>v.date >= today).slice(0,3);
  if (upcoming.length < 3) throw new Error('A complete three-day river forecast is unavailable.');
  return {
    source: 'Copernicus GloFAS v4 / Open-Meteo Flood API',
    sourceKind: 'modeled river discharge',
    nearestModelCell: { latitude: forecast.latitude, longitude: forecast.longitude },
    modelCellDistanceKm: Math.round(distance * 10) / 10,
    localRiverIdentityVerified: false,
    referenceYears: `${h[0].date} to ${h[h.length-1].date}`,
    p90, p95,
    forecasts: upcoming.map((x,i) => ({
      horizonHours: (i+1)*24,
      date: x.date,
      modeledDischargeM3s: x.flow,
      relativeToHistoricalP95: p95 > 0 ? x.flow/p95 : null,
      level: forecastLevel(x.flow,p90,p95)
    })),
    validatedFloodProbability: false,
    verifiedInundationPrediction: false,
    warning: 'GloFAS daily modeled river discharge for a nearby grid cell, not a confirmed local river match. Dates use UTC model days, not rolling 24/48/72-hour forecasts. Historical model-flow percentiles are NOT BWDB danger levels or observed flood events.'
  };
}
async function requestFlood(params, timeout = 12000) {
  const url = new URL(API);
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,String(v));
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),timeout);
  try {
    const res = await fetch(url, {signal: controller.signal});
    if (!res.ok) throw new Error(`Hydrological service returned ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}
/**
 * Sunamganj's two nearby high-discharge GloFAS cells were identified in a
 * 2026-10-16 diagnostic. Neither has a VERIFIED Surma-network identity.
 * Cross-checking them only guards against a wrongly sampled small channel;
 * it cannot establish flood occurrence or station-level connectivity.
 */
export function verifySunamganjNeighbor(primary, adjacent) {
  const primaryCells = parseDaily(primary);
  const adjacentCells = parseDaily(adjacent);
  const west = { latitude: 25.075005, longitude: 91.375 };
  const east = { latitude: 25.075005, longitude: 91.42502 };
  const primaryIsWest = distanceKm(primary.latitude, primary.longitude, west.latitude, west.longitude) < 1;
  const primaryIsEast = distanceKm(primary.latitude, primary.longitude, east.latitude, east.longitude) < 1;
  const expected = primaryIsWest ? east : primaryIsEast ? west : null;
  if (!expected) throw new Error('Sunamganj river model cell is not one of the investigated candidates.');
  if (distanceKm(adjacent.latitude, adjacent.longitude, expected.latitude, expected.longitude) >= 1)
    throw new Error('Sunamganj neighboring model cell could not be confirmed.');
  const byDate = new Map(adjacentCells.map(v => [v.date, v.flow]));
  for (const point of primaryCells) {
    const q = byDate.get(point.date);
    if (q === undefined) continue;
    if (point.flow < 2 || q < 2 || Math.abs(point.flow - q) / Math.max(point.flow, q) > 0.30)
      throw new Error('Nearby modeled channels disagree; local river outlook is unavailable.');
  }
  const matching = primaryCells.filter(v => byDate.has(v.date));
  if (matching.length < 3) throw new Error('Insufficient adjacent-cell forecast coverage.');
  return { check: 'adjacent_GloFAS_cell_agreement', maxRelativeDifference: Math.max(
    ...matching.map(v => Math.abs(v.flow - byDate.get(v.date)) / Math.max(v.flow, byDate.get(v.date), 1))
  ), riverIdentityVerified: false };
}

export async function fetchRiverForecast(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Invalid coordinates.');
  const coordinates = { latitude:lat, longitude:lon, daily:'river_discharge', timezone:'GMT', cell_selection:'nearest' };
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  let history = historicalCache.get(key);
  if (!history) {
    history = requestFlood({...coordinates, models:'consolidated_v4',
      start_date:'2000-01-01',end_date:'2021-12-31'});
    historicalCache.set(key,history);
    history.catch(()=>historicalCache.delete(key));
  }
  const [forecast, historical] = await Promise.all([
    requestFlood({...coordinates, models:'forecast_v4', forecast_days:5}), history
  ]);
  const result = evaluateRiverForecast(forecast,historical,{lat,lon});
  // This condition targets the Sunamganj district reference point, NOT all
  // arbitrary GPS locations in the district.
  if (distanceKm(lat, lon, 25.07, 91.40) <= 1) {
    const isWest = distanceKm(forecast.latitude, forecast.longitude, 25.075005, 91.375) < 1;
    const alternateLongitude = isWest ? 91.45 : 91.40;
    const neighbor = await requestFlood({
      latitude:25.07,longitude:alternateLongitude,daily:'river_discharge',
      timezone:'GMT',cell_selection:'nearest',models:'forecast_v4',forecast_days:5
    });
    result.adjacentCellCheck = verifySunamganjNeighbor(forecast,neighbor);
    result.warning += ' Adjacent high-flow modeled cell checked for consistency; Surma River identity remains unverified.';
  }
  return result;
}
