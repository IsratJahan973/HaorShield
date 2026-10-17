import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rainfallIntensityBand, rollingRainfallWindows } from '../frontend/src/rainfallWindows.js';
import { selectForecastDay } from '../frontend/src/forecastDaySelection.js';

for (const [mm, expected] of [[0,'No Rain'],[0.1,'Light'],[9.9,'Light'],[10,'Moderate'],[49.9,'Moderate'],[50,'Heavy'],[99.9,'Heavy'],[100,'Very Heavy']]) {
  assert.equal(rainfallIntensityBand(mm,24),expected);
}
for (const bad of [undefined,null,NaN,Infinity,-1,'', '8']) {
  assert.equal(rainfallIntensityBand(bad,24),'Unavailable');
}
assert.equal(rainfallIntensityBand(100,48),'Heavy');
assert.equal(rainfallIntensityBand(10,0),'Unavailable');
const t=Date.parse('2026-10-18T01:00:00Z');
const hours=Array.from({length:72},(_,i)=>({ timestamp:new Date(t+(i+1)*3600000),time:'2026-10-18',value:1,probability:20 }));
const broken=hours.map((h,i)=>i===2?{...h,value:null}:h);
assert.equal(rollingRainfallWindows(broken,new Date(t))[0].rainfallMm,null);
assert.equal(selectForecastDay(broken,'2026-10-18','2026-10-18',null,t).ok,false);
const source=readFileSync(new URL('../frontend/src/FloodRiskChecker.jsx',import.meta.url),'utf8');
assert.match(source,/rainfallIntensityBand\(mm, hours\)/);
assert.match(source,/typeof value === "number" && Number\.isFinite\(value\) && value >= 0/);
assert.match(source,/rainProbabilities\.length === times\.length && validRainChance/);
assert.doesNotMatch(source,/Why this outlook\?|<OutlookEvidence\b/);
console.log('FR-04/05/12: stable rainfall bands, missing rain, and invalid probability guards passed');
