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
assert.equal(rollingRainfallWindows(bad,n/** Rolling weather outlooks. Never label incomplete/gapped data as a 24/48/72h forecast. */
export function rollingRainfallWindows(hours, issueTime = new Date()) {
  const start = new Date(issueTime).getTime();
  if (!Number.isFinite(start) || !Array.isArray(hours)) throw new Error('Invalid hourly forecast');
  const slots = new Map();
  // Open-Meteo provides hourly timestamps. The first future hour can be <60 minutes ahead.
  for (const h of hours) {
    const t = new Date(h.timestamp).getTime();
    if (!Number.isFinite(t) || t <= start || t > start + 72 * 3600000) continue;
    // Ignore duplicate timestamp rather than silently double-count precipitation.
    if (!slots.has(t)) slots.set(t, h);
    else slots.set(t, { ...h, value: null, probability: null });
  }
  const sorted = [...slots].sort((a,b)=>a[0]-b[0]);
  return [24,48,72].map(horizon => {
    const subset = sorted.filter(([t])=>t <= start + horizon * 3600000);
    const valid = subset.filter(([,h])=>h.value !== null && Number.isFinite(Number(h.value)) && Number(h.value) >= 0);
    const aligned = subset.length >= horizon-1 && subset.length <= horizon+1 &&
      subset.every(([t],i)=>i===0 || t-subset[i-1][0] === 3600000) &&
      (subset.length===0 || subset[0][0]-start <= 3600000) &&
      (subset.length===0 || start+horizon*3600000-subset.at(-1)[0] < 3600000);
    const complete = aligned && valid.length === subset.length;
    const rainfallMm = complete ? valid.reduce((s,[,h])=>s+Number(h.value),0) : null;
    const probs = complete ? valid.map(([,h])=>h.probability) : [];
    const rainChanceMax = complete && probs.length && probs.every(p=>p!==null && Number.isFinite(Number(p)) && Number(p)>=0 && Number(p)<=100)
      ? Math.max(...probs.map(Number)) : null;
    const rainfallPer24h = complete ? rainfallMm * 24 / subset.length : null;
    const category = !complete ? 'Unavailable' : rainfallPer24h >=100 ? 'Very heavy' : rainfallPer24h >=50 ? 'Heavy' : rainfallPer24h >=10 ? 'Moderate' : rainfallPer24h >0 ? 'Light' : 'No rain';
    return {horizonHours:horizon, rainfallMm, hoursAvailable:valid.length, complete, rainChanceMax, rainfallPer24h, category};
  });
}
ow)[0].complete,false);
const partial=rollingRainfallWindows(hours.slice(0,20),now);
assert.equal(partial[0].complete,false);
assert.equal(partial[0].hoursAvailable,20);
console.log('Rolling rainfall: 24/48/72-hour logic, gaps, and partial-data tests passed');
