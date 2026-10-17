import assert from 'node:assert/strict';
import {selectForecastDay} from '../frontend/src/forecastDaySelection.js';
import {rollingRainfallWindows} from '../frontend/src/rainfallWindows.js';
const now = Date.parse('2026-10-17T17:45:00Z'); // 23:45 in Bangladesh
const hours = Array.from({length:75}, (_,i)=>({
  timestamp:new Date(Date.parse('2026-10-17T18:00:00Z')+i*3600000),
  time:new Date(Date.parse('2026-10-17T18:00:00Z')+i*3600000+6*3600000).toISOString().slice(0,16),
  value:2,probability:50
}));
const windows=rollingRainfallWindows(hours,new Date(now));
const today=selectForecastDay(hours,'2026-10-17','2026-10-17',windows[0],now);
assert.equal(today.ok,true);assert.equal(today.rollingFallback,true);assert.equal(today.hours,24);assert.equal(today.rainfall,48);
const tomorrow=selectForecastDay(hours,'2026-10-18','2026-10-17',windows[0],now);
assert.equal(tomorrow.ok,true);assert.equal(tomorrow.rollingFallback,false);assert.equal(tomorrow.rainfall,48);
assert.equal(selectForecastDay(hours,'2026-10-21','2026-10-17',windows[0],now).ok,false);
assert.equal(selectForecastDay([], '2026-10-17','2026-10-17',{complete:false},now).ok,false);
const missing=hours.map(h=>({...h}));missing[0].value=null;
assert.equal(selectForecastDay(missing,'2026-10-17','2026-10-17',rollingRainfallWindows(missing,new Date(now))[0],now).ok,false);
console.log('PASS FR12 midnight rolling day fallback, next-day selection and missing evidence');
