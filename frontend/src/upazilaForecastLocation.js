// A selected upazila must never silently fall back to a district centroid.
// Geocoding is used for a locality weather sampling point only; it is NOT an
// administrative boundary and cannot establish upazila flood inundation.
export function normalizeAreaName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function chooseVerifiedPlace(results, name, district, containsDistrict) {
  const desired = normalizeAreaName(name);
  for (const candidate of results || []) {
    const lat = Number(candidate.latitude), lon = Number(candidate.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (normalizeAreaName(candidate.name) !== desired) continue;
    if (containsDistrict(lat, lon) !== district) continue;
    return {lat, lon, name: district, selectedUpazila: name, locationBasis: 'verified geocoder point'};
  }
  return null;
}

export async function resolveUpazilaForecastPoint(name, district, containsDistrict, fetchImpl = fetch) {
  if (!name) return null;
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', name);
  url.searchParams.set('count', '100');
  url.searchParams.set('countryCode', 'BD');
  url.searchParams.set('language', 'en');
  const response = await fetchImpl(url.toString());
  if (response.ok) {
    const json = await response.json();
    const match = chooseVerifiedPlace(json.results, name, district, containsDistrict);
    if (match) return match;
  }
  // Secondary lookup: an administrative locality search. This is called only
  // after a user explicitly requests a selected location's forecast.
  const alternate = new URL('https://nominatim.openstreetmap.org/search');
  alternate.searchParams.set('q', `${name} Upazila, ${district}, Bangladesh`);
  alternate.searchParams.set('format', 'jsonv2');
  alternate.searchParams.set('countrycodes', 'bd');
  alternate.searchParams.set('limit', '5');
  const secondResponse = await fetchImpl(alternate.toString());
  if (secondResponse.ok) {
    const places = await secondResponse.json();
    for (const place of places || []) {
      const lat = Number(place.lat), lon = Number(place.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (containsDistrict(lat,lon) !== district) continue;
      const display = normalizeAreaName(place.display_name);
      if (!display.includes(normalizeAreaName(name))) continue;
      return { lat,lon,name:district, selectedUpazila:name,locationBasis:'verified locality point' };
    }
  }
  throw new Error(`Cannot verify a weather location for ${name}, ${district}. Please select District overview; no district-centre forecast was substituted.`);
}

export function greatCircleDistanceKm(aLat, aLon, bLat, bLon) {
  const deg = Math.PI / 180;
  const dl = (bLat - aLat) * deg;
  const dn = (bLon - aLon) * deg;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(aLat * deg) * Math.cos(bLat * deg) * Math.sin(dn / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function featurePoint(feature) {
  const g = feature?.geometry;
  if (!g || !['Polygon','MultiPolygon'].includes(g.type)) return null;
  const pts = [];
  function visit(node) {
    if (!Array.isArray(node)) return;
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      pts.push(node);return;
    }
    for (const v of node) visit(v);
  }
  visit(g.coordinates);
  if (!pts.length) return null;
  return {lon: pts.reduce((s,x)=>s+x[0],0)/pts.length,lat:pts.reduce((s,x)=>s+x[1],0)/pts.length};
}

export function nearbyResearchCells(features, location, km=20) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return features;
  return features.filter(f => {
    const p = featurePoint(f);
    return p && greatCircleDistanceKm(location.lat,location.lon,p.lat,p.lon) <= km;
  });
}
