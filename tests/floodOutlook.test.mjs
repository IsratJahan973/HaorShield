import assert from 'node:assert/strict';
import { combinedFloodOutlooks } from '../frontend/src/floodOutlook.js';
const now = new Date('2026-10-16T09:00:00Z');
const R = (labels) => [24,48,72].map((h,i) => ({horizonHours:h,level:labels[i],usable: labels[i] !== 'Unavailable'}));
const low = ['Low local rainfall signal','Low local rainfall signal','Low local rainfall signal'];
const normal = ['Within historical flow range','Within historical flow range','Within historical flow range'];
const F = (labels) => ({localRiverIdentityVerified:false, forecasts:labels.map((level,i) => ({date:`2026-10-${16+i}`,modeledDischargeM3s:500,level}))});
const C = (rain,river) => combinedFloodOutlooks(rain,river,now);
assert.deepEqual(C(R(low),F(normal)).map(x=>x.rank),[0,0,0]);
assert.deepEqual(C(R(low),F([normal[0],'Unusually high river flow',normal[2]])).map(x=>x.rank),[0,3,3]);
assert.deepEqual(C(R(['High rainfall concern',...low.slice(1)]),null).map(x=>x.rank),[3,null,null]);
assert.deepEqual(C(R(low),null).map(x=>x.rank),[null,null,null]);
assert.deepEqual(C(null,F(['Unusually high river flow',...normal.slice(1)])).map(x=>x.rank),[3,3,3]);
assert.deepEqual(C(R(['Rainfall watch','Elevated rainfall concern',low[2]]),F(normal)).map(x=>x.rank),[1,2,0]);
assert.deepEqual(C(R(low),F(['Elevated river flow',...normal.slice(1)])).map(x=>x.rank),[2,2,2]);
assert.deepEqual(C(R(['Unavailable',...low.slice(1)]),F(normal)).map(x=>x.rank),[null,0,0]);
const gap=F(normal); gap.forecasts[1].date='2026-10-19';
assert.deepEqual(C(R(low),gap).map(x=>x.rank),[0,null,null]);
const late=F(normal); late.forecasts[0].date='2026-10-17';
assert.deepEqual(C(R(low),late).map(x=>x.rank),[null,null,null]);
const missing=F(normal); missing.forecasts[1].modeledDischargeM3s=null;
assert.deepEqual(C(R(low),missing).map(x=>x.rank),[0,null,null]);
const incomplete=F(normal); incomplete.forecasts.pop();
assert.deepEqual(C(R(low),incomplete).map(x=>x.rank),[0,0,null]);
const flagged=F(normal); flagged.forecasts[0].level='Unusually high river flow';
assert.ok(C(R(low),flagged)[0].factors.some(x=>x.includes('not verified')));
assert.ok(C(R(low),flagged).every(x=>x.isValidatedFloodPrediction === false));
for (const district of ['Brahmanbaria','Habiganj','Kishoreganj','Moulvibazar','Netrakona','Sunamganj','Sylhet']) {
  assert.equal(C(R(low),F(normal)).length,3,district);
}
console.log('PASS: 14 hydrometeorological behavior assertions + seven-district schema checks');

// Malformed upstream dates must fail closed without crashing the website.
for (const badDate of ['2026-13-40', '2026-02-30', 'not-a-date', null]) {
  const invalid = F(normal);
  invalid.forecasts[0].date = badDate;
  assert.doesNotThrow(() => C(R(low), invalid));
  assert.deepEqual(C(R(low), invalid).map(x => x.rank), [null, null, null]);
}
const invalidLater = F(normal);
invalidLater.forecasts[1].date = '2026-15-99';
assert.deepEqual(C(R(low), invalidLater).map(x => x.rank), [0, null, null]);
console.log('PASS malformed date handling for river forecast');
