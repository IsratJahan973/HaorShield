import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../frontend/src/FarmerCropAdvice.jsx', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('export function getFarmerAdvice'), source.indexOf('export default function')).replace('export function', 'function');
const advice = vm.runInNewContext(`${helper}\ngetFarmerAdvice`);
const low = [{horizonHours:24,rank:0,riverAvailable:true}];
const incomplete = [{horizonHours:24,rank:0,riverAvailable:false}];
const higher = [{horizonHours:48,rank:2,riverAvailable:true}];
assert.match(advice('rice_aman','growing','wet',low).message,/standing in your field/);
assert.match(advice('rice_aus','harvest','river',low).message,/rising river water/);
assert.match(advice('vegetables','seedling','normal',higher).prepare.join(' '),/seedling trays/);
assert.match(advice('fish','growing','normal',higher).recovery.join(' '),/water quality/);
assert.match(advice('rice_boro','harvest','normal',higher).periodText,/48h/);
assert.match(advice('rice_aman','unknown','normal',incomplete).evidence,/River evidence incomplete/);
assert.match(advice('rice_aman','unknown','normal',[]).message,/not available/);
assert.match(advice('rice_aman','growing','river',low).duringFlood.join(' '),/takes priority/);
for (const crop of ['rice_boro','rice_aman','rice_aus','vegetables','fish','other']) {
  const result = advice(crop,'growing','normal',low);
  assert.ok(result.prepare.length>=3 && result.duringFlood.length>=2 && result.recovery.length>=2);
  assert.ok(result.actions.length<=4);
}
assert.match(source,/Prepare now/);
assert.match(source,/After water recedes/);
console.log('PASS FR-19 crop, stage, field overrides, evidence, timing, and safe action stages');
