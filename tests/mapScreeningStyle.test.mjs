import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// FR17+FR18: protect the current map behavior without hard-coding an obsolete
// React-Leaflet key or helper name.
const source = readFileSync(new URL('../frontend/src/LandAttentionMap.jsx', import.meta.url), 'utf8');
assert.match(source, /const\s+HOURS\s*=\s*\[24,\s*48,\s*72\]/);
assert.match(source, /aria-label="Map forecast period"/);
assert.match(source, /const\s+forecastHasConcern\s*=\s*Number\(selectedForecast\?\.rank\)\s*>=\s*2/);
assert.match(source, /const\s+active\s*=\s*forecastHasConcern\s*&&\s*frac\s*>=\s*0\.10/);
assert.match(source, /fillColor:\s*"#bfdbfe"/); // light blue for non-target cells
assert.match(source, /fillColor:\s*strong\s*\?\s*"#c2410c"\s*:\s*"#fdba74"/);
assert.match(source, /clipResearchCells\(check\.features,\s*polygonClips,\s*district,\s*selectedUpazila\)/);
assert.match(source, /data=\{\{\s*type:\s*"FeatureCollection",\s*features:\s*displayFeatures\s*\}\}/);
assert.match(source, /selectedUpazila\s*\?\s*localTargetLandKm2\s*:\s*check\.landKm2/);
assert.match(source, /selectedUpazila\s*\?\s*localTargetCropHa\s*:\s*check\.cropHa/);
assert.match(source, /Map color guide/);
console.log('PASS FR17 map focus, selected-hour targeting, light-blue default, area figures and legend');
