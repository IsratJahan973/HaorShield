import assert from 'node:assert/strict';
import { floodConcernOutlooks } from '../frontend/src/floodConcern.js';
const w = (h, mm, complete=true) => ({horizonHours:h,rainfallMm:mm,rainfallPer24h:mm*24/h,complete});
const result = floodConcernOutlooks([w(24,0),w(48,120),w(72,305),w(24,20,false)]);
assert.deepEqual(result.map(r=>r.level),[
  'Low local rainfall signal', 'Elevated rainfall concern', 'High rainfall concern','Unavailable'
]);
assert.ok(result.every(r => !('probability' in r)));
console.log('PASS floodConcern: complete horizon handling and rainfall concern classes');

// Missing/contradictory data must never be interpreted as a low concern.
const unreliable = floodConcernOutlooks([
  {horizonHours:24, rainfallMm:null, rainfallPer24h:0, complete:true},
  {horizonHours:24, rainfallMm:0, rainfallPer24h:null, complete:true},
  {horizonHours:48, rainfallMm:10, rainfallPer24h:100, complete:true},
  {horizonHours:72, rainfallMm:90, rainfallPer24h:30, complete:true}
]);
assert.deepEqual(unreliable.map(x=>x.usable),[false,false,false,true]);
console.log('PASS rainfall null, inconsistency and valid 72h consistency guards');
