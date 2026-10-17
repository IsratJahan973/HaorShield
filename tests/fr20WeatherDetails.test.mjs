import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeCurrentWeather } from '../frontend/src/weatherNow.js';

const at = '2026-10-17T06:00:00Z';
const valid = {
  time: '2026-10-17T11:45', temperature_2m: 32.1, precipitation: 0,
  relative_humidity_2m: 73, wind_speed_10m: 12.6, weather_code: 2
};
const summary = summarizeCurrentWeather(valid, at);
assert.equal(summary.humidityPct, 73);
assert.equal(summary.windKmh, 12.6);
assert.equal(summary.temperatureC, 32.1);
assert.equal(summary.rainMm, 0);
assert.equal(summarizeCurrentWeather({...valid, relative_humidity_2m: null, wind_speed_10m: null}, at).humidityPct, null);
assert.equal(summarizeCurrentWeather({...valid, relative_humidity_2m: -1, wind_speed_10m: -3}, at).windKmh, null);
assert.equal(summarizeCurrentWeather({...valid, relative_humidity_2m: 101}, at).humidityPct, null);
assert.equal(summarizeCurrentWeather({...valid, time: '2026-10-16T01:00'}, at).humidityPct, null);
assert.equal(summarizeCurrentWeather({...valid, time: '2026-10-16T01:00'}, at).windKmh, null);
const ui = readFileSync(new URL('../frontend/src/FloodRiskChecker.jsx', import.meta.url), 'utf8');
assert.match(ui, /Humidity/);
assert.match(ui, /Wind speed/);
assert.match(ui, /weatherNow\.humidityPct/);
assert.match(ui, /weatherNow\.windKmh/);
assert.match(ui, /relative_humidity_2m,precipitation,wind_speed_10m/);
assert.match(ui, /Rain expected/);
assert.match(ui, /Next \{item\.horizonHours\} hours/);
console.log('FR-20: current humidity and wind with freshness guards, existing weather preserved');
