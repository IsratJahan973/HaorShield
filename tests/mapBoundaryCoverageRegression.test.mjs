import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UPAZILAS } from '../frontend/src/areaChoices.js';
import { placeKey, selectUpazilaBoundary, clipResearchCells, clipRainCells } from '../frontend/src/upazilaPolygonOverlay.js';

const read = name => JSON.parse(fs.readFileSync(new URL(`../frontend/public/data/${name}`, import.meta.url), 'utf8'));
const boundaries = read('haorshield_upazila_boundaries.geojson');
const clips = read('haorshield_upazila_cell_clips.json');
const flood = read('haorshield_sar_future_candidates.geojson').features;
const rain = read('haorshield_rainfall_risk.geojson').features;

assert.equal(boundaries.features.length, 70);
assert.equal(clips.source_cell_count, 306);
assert.equal(flood.length, 306);
assert.equal(rain.length, 306);
assert.equal(Object.keys(clips.upazilas).length, 70);
assert.equal(Object.keys(clips.rainUpazilas).length, 70);

// Historically verified aliases only; never substitute a different location.
for (const [district, alias, sourceName] of [
  ['Sunamganj', 'Shalla', 'Sulla'],
  ['Sunamganj', 'Bishwambarpur', 'Bishwamvarpur'],
  ['Sunamganj', 'Shantiganj', 'Dakshin Sunamganj'],
  ['Habiganj', 'Baniachong', 'Baniachang'],
  ['Sylhet', 'Golapganj', 'Golabganj'],
]) assert.equal(placeKey(district, alias),placeKey(district,sourceName));

const stillMissing = [];
let covered = 0;
for (const [district, names] of Object.entries(UPAZILAS)) {
  for (const name of names) {
    const boundary = selectUpazilaBoundary(boundaries, district, name);
    const f = clipResearchCells(flood, clips, district, name);
    const r = clipRainCells(rain, clips, district, name);
    if (!boundary) {
      stillMissing.push(`${district}/${name}`);
      assert.equal(f.length, 0);
      assert.equal(r.length, 0);
      continue;
    }
    assert.equal(boundary.features.length, 1,`${district}/${name}`);
    assert.ok(f.length > 0,`no research intersection: ${district}/${name}`);
    assert.ok(r.length > 0,`no rain intersection: ${district}/${name}`);
    assert.ok(f.every(x => x.properties.overlapFraction > 0 && x.properties.overlapFraction <= 1));
    assert.ok(r.every(x => x.properties.overlapFraction > 0 && x.properties.overlapFraction <= 1));
    covered++;
  }
}
assert.equal(covered, 70);
assert.deepEqual(stillMissing.sort(), [
  'Habiganj/Shayestaganj', 'Sunamganj/Madhyanagar', 'Sylhet/Osmani Nagar'
]);
console.log('PASS 70/73 selectable upazilas have verified boundaries and clipped grid data; 3 remain explicitly unavailable.');
