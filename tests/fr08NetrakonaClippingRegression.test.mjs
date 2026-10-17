import assert from 'node:assert/strict';
import fs from 'node:fs';
import { placeKey, selectUpazilaBoundary, clipResearchCells, clipRainCells } from '../frontend/src/upazilaPolygonOverlay.js';
const load = file => JSON.parse(fs.readFileSync(new URL('../frontend/public/data/' + file, import.meta.url), 'utf8'));
const boundaries = load('haorshield_upazila_boundaries.geojson');
const clips = load('haorshield_upazila_cell_clips.json');
const flood = load('haorshield_sar_future_candidates.geojson').features;
const rain = load('haorshield_rainfall_risk.geojson').features;
assert.equal(placeKey('Netrokona','Madan Upazilla'), placeKey('Netrakona','Madan'));
assert.equal(placeKey('Sunamganj','Dharmapasha'), placeKey('Sunamganj','Dharampasha'));
for (const name of ['Madan','Durgapur','Kalmakanda','Mohanganj','Khaliajuri']) {
  assert.ok(selectUpazilaBoundary(boundaries,'Netrakona',name), name + ' boundary missing');
  const f=clipResearchCells(flood,clips,'Netrakona',name);
  const r=clipRainCells(rain,clips,'Netrakona',name);
  assert.ok(f.length > 0 && r.length > 0, name + ' clipping missing');
  assert.ok(f.every(x => x.properties.overlapFraction > 0 && x.properties.overlapFraction <= 1));
}
assert.ok(clipResearchCells(flood,clips,'Sunamganj','Chhatak').length);
assert.ok(clipRainCells(rain,clips,'Sunamganj','Chhatak').length);
assert.ok(selectUpazilaBoundary(boundaries,'Sunamganj','Dharmapasha'));
assert.deepEqual(clipResearchCells(flood,clips,'Netrakona','MadeUpArea'),[]);
assert.deepEqual(clipRainCells(rain,clips,'Netrakona','MadeUpArea'),[]);
const view=fs.readFileSync(new URL('../frontend/src/LandAttentionMap.jsx',import.meta.url),'utf8');
assert.match(view,/displayFeatures\.length === 0 \? "Unavailable"/);
assert.doesNotMatch(view,/L\.circle\([^\n]*getBounds/);
console.log('PASS Netrakona polygons, flood and rain intersection keys, missing-data display, Leaflet guard');
