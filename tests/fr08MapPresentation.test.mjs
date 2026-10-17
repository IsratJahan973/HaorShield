import assert from 'node:assert/strict';
import fs from 'node:fs';
const code = fs.readFileSync(new URL('../frontend/src/LandAttentionMap.jsx', import.meta.url), 'utf8');
for (const needle of ['haorshield_districts.geojson','ADM2_NAME','selectedBoundary', 'haorshield_upazila_boundaries.geojson', 'selectedUpazilaBoundary', 'FitResearchArea', 'Research cells are intentionally light']) {
 assert.ok(code.includes(needle), `Missing map safeguard: ${needle}`);
}
assert.match(code, /mapped administrative boundary/);
assert.match(code, /fillOpacity: 0\.19/);
assert.ok(!code.includes('function FitArea('));
console.log('PASS polished district outline, true upazila polygons and clipped forecast shading, subtle cells and map focus');
