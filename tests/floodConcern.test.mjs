import assert from 'node:assert/strict';
import { floodConcernOutlooks } from '../src/floodConcern.js';
const w = (h, mm, complete=true) => ({horizonHours:h,rainfallMm:mm,rainfallPer24h:mm*24/h,complete});
const result = floodConcernOutlooks([w(24,0),w(48,120),w(72,305),w(24,20,false)]);
assert.deepEqual(result.map(r=>r.level),[
  'Low local rainfall signal', 'Elevated rainfall concern', 'High rainfall concern','Unavailable'
]);
assert.ok(result.every(r => !('probability' in r)));
console.log('PASS floodConcern: complete horizon handling and rainfall concern classes');
