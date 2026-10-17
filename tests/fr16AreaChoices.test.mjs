import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { areaOptions, resolveManualLocation, MAPPED_AREAS } from '../frontend/src/areaChoices.js';
const districts=[
  {name:'Brahmanbaria',lat:23.96,lon:91.11},{name:'Habiganj',lat:24.38,lon:91.42},
  {name:'Kishoreganj',lat:24.44,lon:90.78},{name:'Moulvibazar',lat:24.48,lon:91.77},
  {name:'Netrakona',lat:24.88,lon:90.73},{name:'Sunamganj',lat:25.07,lon:91.40},
  {name:'Sylhet',lat:24.89,lon:91.87}
];
assert.equal(Object.keys(MAPPED_AREAS).length,7);
assert.equal(Object.values(MAPPED_AREAS).flat().length,306);
for(const district of districts){
 const areas=areaOptions(district.name);
 assert.ok(areas.length>0);
 assert.equal(resolveManualLocation(district.name,'',districts).lat,district.lat);
 for(const area of areas){
   assert.ok(Number.isFinite(area.lat) && Number.isFinite(area.lon));
   const selected=resolveManualLocation(district.name,area.id,districts);
   assert.equal(selected.name,district.name);
   assert.equal(selected.lat,area.lat);
   assert.equal(selected.lon,area.lon);
 }
}
assert.equal(resolveManualLocation('Sylhet','not-a-valid-id',districts),null);
const ui=readFileSync(new URL('../frontend/src/FloodRiskChecker.jsx',import.meta.url),'utf8');
assert.match(ui,/id="area-choice"/);
assert.match(ui,/onChange=\{e => selectArea\(e.target.value\)\}/);
assert.match(ui,/getCurrentPosition\(/);
assert.match(ui,/onClick=\{useGPS\}/);
assert.match(ui,/gpsAttempt.current/);
assert.match(ui,/resolveManualLocation\(district, areaId, DISTRICTS\)/);
console.log('PASS FR-16 manual district/area selection and opt-in GPS');
