import assert from 'node:assert/strict';
import { summarizeCurrentWeather } from '../frontend/src/weatherNow.js';
const now = '2026-10-16T10:30:00Z'; // 16:30 Bangladesh time
const current = {time:'2026-10-16T16:15', temperature_2m:29.5, precipitation:2.4, weather_code:61};
const report = summarizeCurrentWeather(current, now);
assert.equal(report.fresh, true);
assert.equal(report.temperatureC, 29.5);
assert.equal(report.rainMm, 2.4);
assert.equal(report.description, 'Rainy');
assert.equal(summarizeCurrentWeather({...current,precipitation:0},now).rainMm,0);
assert.equal(summarizeCurrentWeather({...current,precipitation:null},now).rainMm,null);
assert.equal(summarizeCurrentWeather({...current,precipitation:-2},now).rainMm,null);
assert.equal(summarizeCurrentWeather({...current,time:'2026-10-15T09:00'},now).fresh,false);
assert.equal(summarizeCurrentWeather({},now).fresh,false);
assert.equal(summarizeCurrentWeather({...current,weather_code:95},now).description,'Thunderstorm');
console.log('Weather-now tests: 9 assertions passed');
