import assert from 'node:assert/strict';
import { areaOptions, resolveManualLocation, UPAZILAS } from '../frontend/src/areaChoices.js';
import { readFileSync } from 'node:fs';

const districts = Object.keys(UPAZILAS).map((name, index) => ({ name, lat:24 + index * 0.1, lon:91 }));
assert.equal(districts.length, 7);
for (const district of districts) {
  const items = areaOptions(district.name);
  assert.ok(items.length >= 7, `${district.name} has named choices`);
  assert.ok(items.every(item => !item.label.includes('Mapped area') && !item.label.includes('°')), 'No numeric grid IDs');
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  assert.equal(resolveManualLocation(district.name, '', districts).name, district.name);
  assert.equal(resolveManualLocation(district.name, items[0].id, districts).selectedUpazila, items[0].id);
  assert.equal(resolveManualLocation(district.name, 'Made-up place', districts), null);
}
const view = readFileSync(new URL('../frontend/src/FloodRiskChecker.jsx', import.meta.url), 'utf8');
assert.match(view,/Select upazila/);
assert.match(view,/onClick=\{useGPS\}/);
assert.match(view,/district-level, not upazila predictions/);
assert.doesNotMatch(view,/Mapped areas are geographic grid cells/);
console.log('PASS FR-16: seven named upazila menus, manual fallback, GPS opt-in, no false upazila forecasts');
