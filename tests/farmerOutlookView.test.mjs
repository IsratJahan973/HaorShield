import assert from 'node:assert/strict';
import {farmerHorizon,farmerSummary} from '../frontend/src/farmerOutlookView.js';
for(const hours of [24,48,72]){
  const base={horizonHours:hours,rank:null,riverAvailable:false,rainfallAvailable:true};
  const rain={horizonHours:hours,complete:true,rainfallMm:0};
  let v=farmerHorizon(base,rain);
  assert.match(v.title,/river flood concern unknown/);
  assert.equal(v.rainText,'0.0 mm rain expected');
  assert.equal(v.uncertain,true);
  v=farmerHorizon(base,{horizonHours:hours,complete:false,rainfallMm:null});
  assert.equal(v.rainText,'Rain forecast unavailable');
  assert.match(v.title,/cannot be checked/);
  v=farmerHorizon({...base,rank:3},rain);
  assert.match(v.title,/High flood concern/);
  v=farmerHorizon({...base,rank:0,riverAvailable:true},rain);
  assert.equal(v.uncertain,false);
  v=farmerHorizon({...base,rank:2}, {complete:false,rainfallMm:null});
  assert.match(v.title,/Elevated/);
}
assert.match(farmerSummary([{rainfallAvailable:true,riverAvailable:false}]).lines.join(' '),/river forecast could not/);
console.log('Farmer forecast presentation: 16 assertions passed');
