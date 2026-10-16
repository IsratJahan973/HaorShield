import assert from 'node:assert/strict';
import { rollingRainfallWindows } from '../src/rainfallWindows.js';
const now = new Date('2026-10-16T06:00:00Z');
const hours = Array.from({length:72},(_,i)=>({
  timestamp:new Date(now.getTime() + (i+1)*3600000), value:1, probability:20
}));
const results=rollingRainfallWindows(hours,now);
assert.deepEqual(results.map(x=>x.rainfallMm),[24,48,72]);
assert.deepEqual(results.map(x=>x.complete),[true,true,true]);
assert.deepEqual(results.map(x=>x.hoursAvailable),[24,48,72]);
assert.equal(results[0].category,'Moderate');
const bad=hours.map((x,i)=>i===2?{...x,value:null}:x);
assert.equal(rollingRainfallWindows(bad,now)[0].complete,false);
const partial=rollingRainfallWindows(hours.slice(0,20),now);
assert.equal(partial[0].complete,false);
assert.equal(partial[0].hoursAvailable,20);
console.log('Rolling rainfall: 24/48/72-hour logic, gaps, and partial-data tests passed');
