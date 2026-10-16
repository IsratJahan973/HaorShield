import assert from 'node:assert/strict';
import { farmerHorizon, farmerSummary } from '../frontend/src/farmerOutlookView.js';
const rain = { horizonHours:24, complete:true, rainfallMm:35.8 };
for (const rank of [0,1,2,3]) {
  const r=farmerHorizon({horizonHours:24,rank, label:'test'},rain);
  assert.equal(r.rainText,'35.8 mm rain expected');
  assert.ok(r.title.length > 3);
}
assert.equal(farmerHorizon({horizonHours:24,rank:null,label:'Cannot assess'},rain).uncertain,true);
assert.match(farmerHorizon({horizonHours:24,rank:2}, {complete:false,rainfallMm:0}).rainText,/incomplete/);
assert.match(farmerSummary([{rank:3,riverAvailable:true,riverIdentityVerified:false}]).lines.join(' '),/may not represent your local river/);
assert.match(farmerSummary([{rank:2}]).advice.join(' '),/seeds/);
assert.match(farmerSummary([{rank:0}]).lines.join(' '),/No strong signal/);
assert.match(farmerSummary([{rank:null}]).lines.join(' '),/not enough forecast information/i);
console.log('9 farmer presentation checks passed');
