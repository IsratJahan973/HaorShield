import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Keep tests aligned to the current farmer-facing crop choices and behavior,
// rather than asserting old English wording from a removed interface.
const source = readFileSync(new URL('../frontend/src/FarmerCropAdvice.jsx', import.meta.url), 'utf8');
assert.match(source, /export default function FarmerCropAdvice\s*\(/, 'React component must have a default export');
const start = source.indexOf('export function getFarmerAdvice');
const end = source.indexOf('export default function FarmerCropAdvice');
assert.ok(start >= 0 && end > start, 'getFarmerAdvice must be exported before the React component');
const helperSource = source.slice(start, end).replace('export function getFarmerAdvice', 'function getFarmerAdvice');
const getFarmerAdvice = vm.runInNewContext(`${helperSource}\ngetFarmerAdvice`);

for (const [id, label] of [
  ['rice_boro', 'Boro rice'], ['rice_aman', 'Aman rice'], ['rice_aus', 'Aus rice'],
  ['vegetables', 'Vegetables'], ['fish', 'Fish pond'], ['other', 'Other crops / livestock'],
]) {
  assert.ok(source.includes(`"${id}"`), `Missing crop option ${id}`);
  assert.ok(source.includes(`"${label}"`), `Missing crop label ${label}`);
}
for (const stage of ['planning', 'seedling', 'growing', 'harvest']) {
  assert.ok(source.includes(`"${stage}"`), `Missing crop stage ${stage}`);
}
for (const field of ['normal', 'wet', 'river']) {
  assert.ok(source.includes(`"${field}"`), `Missing field condition ${field}`);
}

const normal = getFarmerAdvice('rice_aman', 'growing', 'normal', [{ rank: 0 }]);
const elevated = getFarmerAdvice('rice_aman', 'growing', 'normal', [{ rank: 2 }]);
const unavailable = getFarmerAdvice('rice_aman', 'unknown', 'unknown', []);
const standing = getFarmerAdvice('rice_aman', 'growing', 'wet', [{ rank: 0 }]);
const river = getFarmerAdvice('rice_aman', 'growing', 'river', [{ rank: 0 }]);

for (const result of [normal, elevated, unavailable, standing, river]) {
  assert.equal(typeof result.message, 'string');
  assert.ok(result.message.trim().length > 0, 'Advice status must not be blank');
  assert.ok(Array.isArray(result.actions));
  assert.ok(result.actions.length >= 2 && result.actions.length <= 4, 'Show 2–4 short actions');
}
assert.notEqual(elevated.message, normal.message, 'High concern must change the message');
assert.match(elevated.message, /high|prepare|warning/i);
assert.match(unavailable.message, /not available|unavailable|missing|unknown/i);
assert.notEqual(standing.message, normal.message, 'Standing water must override a low-signal message');
assert.notEqual(river.message, normal.message, 'Rising river must override a low-signal message');
assert.match(river.actions.join(' '), /safe|warning|rising water/i);
for (const [crop, stage, keyword] of [
  ['rice_boro', 'seedling', /Boro/i], ['rice_aman', 'growing', /Aman/i],
  ['rice_aus', 'harvest', /Aus/i], ['vegetables', 'seedling', /seedling/i],
  ['fish', 'growing', /fish/i],
]) {
  assert.match(getFarmerAdvice(crop, stage, 'normal', [{ rank: 1 }]).actions.join(' '), keyword);
}
console.log('PASS farmer advice: crop choices, stages, safe field overrides, missing-data handling and action lists');
