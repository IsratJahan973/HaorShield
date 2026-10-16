import assert from 'node:assert/strict';
import { evaluateRiverForecast, quantile, distanceKm, verifySunamganjNeighbor } from '../frontend/src/riverForecast.js';
assert.equal(quantile([0,10,20],.5),10);
const histTimes=[], histFlows=[];
for (let year=2000;year<=2021;year++) {
  for(let day=1;day<=365;day++) {
    const d = new Date(Date.UTC(year,0,day));
    histTimes.push(d.toISOString().slice(0,10));histFlows.push(100+(day%100));
  }
}
const historical={latitude:24.89,longitude:91.87,daily:{time:histTimes,river_discharge:histFlows}};
const forecast={latitude:24.89,longitude:91.87,daily:{time:['2026-10-16','2026-10-17','2026-10-18'],river_discharge:[210,160,120]}};
const v=evaluateRiverForecast(forecast,historical,{lat:24.89,lon:91.87},new Date('2026-10-16T04:00:00Z'));
assert.equal(v.forecasts.length,3);
assert.equal(v.forecasts[0].level,'Unusually high river flow');
assert.equal(v.validatedFloodProbability,false);
assert.throws(()=>evaluateRiverForecast(forecast,historical,{lat:26,lon:90},new Date('2026-10-16T04:00:00Z')));
assert.throws(()=>evaluateRiverForecast({...forecast,daily:{time:['2026-10-16'],river_discharge:[2]}},historical,{lat:24.89,lon:91.87},new Date('2026-10-16T04:00:00Z')));
console.log('River forecast calculation checks passed');

assert.equal(distanceKm(24.89,91.87,24.89,91.87),0);
assert.ok(distanceKm(24.89,91.87,24.99,91.87)>8);
assert.throws(()=>evaluateRiverForecast({...forecast, latitude:24.99},historical,{lat:24.89,lon:91.87},new Date('2026-10-16T04:00:00Z')), /nearby/);
assert.throws(()=>evaluateRiverForecast(forecast,{...historical,latitude:24.95}, {lat:24.89,lon:91.87},new Date('2026-10-16T04:00:00Z')), /grid cells differ/);
assert.equal(v.localRiverIdentityVerified,false);
assert.equal(v.modelCellDistanceKm,0);

// Station-specific adjacent-channel guard. Geometry/identity remains unverified.
const west = {latitude:25.075005,longitude:91.375,daily:{time:['2026-10-16','2026-10-17','2026-10-18'],river_discharge:[543.5,533.56,525.02]}};
const east = {latitude:25.075005,longitude:91.42502,daily:{time:['2026-10-16','2026-10-17','2026-10-18'],river_discharge:[539.75,531.11,522.6]}};
assert.equal(verifySunamganjNeighbor(west,east).riverIdentityVerified,false);
assert.throws(()=>verifySunamganjNeighbor(west,{...east,daily:{...east.daily,river_discharge:[3,3,3]}}),/disagree/);
assert.throws(()=>verifySunamganjNeighbor(west,{...east,longitude:92}),/could not be confirmed/);
console.log('Sunamganj adjacent-cell safety checks passed');

// High-flow scenario: must indicate unusually high discharge, not flood occurrence.
const high = {...forecast, daily: {...forecast.daily, river_discharge:[400, 370, 360]}};
const highResult = evaluateRiverForecast(high,historical,{lat:24.89,lon:91.87},new Date('2026-10-16T01:00:00Z'));
assert.equal(highResult.forecasts[0].level, 'Unusually high river flow');
assert.equal(highResult.validatedFloodProbability, false);
assert.equal(highResult.verifiedInundationPrediction, false);

// Critical guard: unrelated overlapping past dates cannot validate displayed days.
const wrongDays = {...east, daily:{time:['2026-10-13','2026-10-14','2026-10-15'],river_discharge:[539,531,522]}};
assert.throws(()=>verifySunamganjNeighbor(west,wrongDays,['2026-10-16','2026-10-17','2026-10-18']), /coverage/);
assert.deepEqual(verifySunamganjNeighbor(west,east,['2026-10-16','2026-10-17','2026-10-18']).checkedDates,
  ['2026-10-16','2026-10-17','2026-10-18']);
const missingDay = {...east, daily:{time:['2026-10-16','2026-10-18','2026-10-19'],river_discharge:[539,522,516]}};
assert.throws(()=>verifySunamganjNeighbor(west,missingDay,['2026-10-16','2026-10-17','2026-10-18']), /coverage/);
assert.throws(()=>evaluateRiverForecast({...forecast, daily:{time:forecast.daily.time,river_discharge:[210,null,120]}},historical,{lat:24.89,lon:91.87},new Date('2026-10-16T01:00:00Z')), /complete three-day/);
console.log('Displayed-date alignment, high-flow, and missing-data tests passed');

// Never silently shift forecast horizons when today's hydrological date is missing.
const shifted = {...forecast, daily:{time:['2026-10-17','2026-10-18','2026-10-19'],river_discharge:[210,160,120]}};
assert.throws(() => evaluateRiverForecast(shifted,historical,{lat:24.89,lon:91.87},new Date('2026-10-16T04:00:00Z')), /for today and the next two days/);
// Duplicate timestamps are not a valid three-day forecast.
const duplicate = {...forecast, daily:{time:['2026-10-16','2026-10-16','2026-10-17','2026-10-18'],river_discharge:[210,210,160,120]}};
assert.throws(() => evaluateRiverForecast(duplicate,historical,{lat:24.89,lon:91.87},new Date('2026-10-16T04:00:00Z')), /Duplicate/);
// Out-of-order source rows must still align with their actual calendar dates.
const scrambled = {...forecast, daily:{time:['2026-10-18','2026-10-16','2026-10-17'],river_discharge:[120,210,160]}};
const aligned = evaluateRiverForecast(scrambled,historical,{lat:24.89,lon:91.87},new Date('2026-10-16T04:00:00Z'));
assert.deepEqual(aligned.forecasts.map(x=>x.date),['2026-10-16','2026-10-17','2026-10-18']);
assert.deepEqual(aligned.forecasts.map(x=>x.modeledDischargeM3s),[210,160,120]);
console.log('Current-day alignment and malformed-date guards passed');
