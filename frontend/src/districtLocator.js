// Geographic district matching for HaorShield's seven supported districts.
// GeoJSON coordinates use [longitude, latitude]; coordinates from GPS use latitude, longitude.
const names = new Map([
  ["Brahamanbaria", "Brahmanbaria"],
  ["Maulvibazar", "Moulvibazar"],
]);
const supported = new Set(["Brahmanbaria", "Habiganj", "Kishoreganj", "Moulvibazar", "Netrakona", "Sunamganj", "Sylhet"]);

function inRing(lon, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
function inPolygon(lon, lat, rings) {
  return Array.isArray(rings) && inRing(lon, lat, rings[0]) && !rings.slice(1).some(r => inRing(lon, lat, r));
}
export function findSupportedDistrict(boundaries, lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  if (boundaries?.type !== "FeatureCollection" || !Array.isArray(boundaries.features)) return null;
  for (const f of boundaries.features) {
    const geometry = f?.geometry;
    const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
      : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
    if (polygons.some(polygon => inPolygon(lon, lat, polygon))) {
      const raw = f.properties?.ADM2_NAME;
      const name = names.get(raw) || raw;
      return supported.has(name) ? name : null;
    }
  }
  return null;
}
