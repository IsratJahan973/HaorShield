/** Project-defined rainfall intensity on a 24-hour-equivalent basis; not official BMD bands. */
export function rainfallIntensityBand(mm, hours = 24) {
  if (!Number.isFinite(mm) || mm < 0 || !Number.isFinite(hours) || hours <= 0) return 'Unavailable';
  const rate = mm * 24 / hours;
  if (!Number.isFinite(rate)) return 'Unavailable';
  return rate >= 100 ? 'Very Heavy' : rate >= 50 ? 'Heavy' : rate >= 10 ? 'Moderate' : rate > 0 ? 'Light' : 'No Rain';
}

/** Rolling weather outlooks. Never label incomplete/gapped data as a 24/48/72h forecast. */
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
    const valid = subset.filter(([,h])=>typeof h.value === 'number' && Number.isFinite(h.value) && h.value >= 0);
    const aligned = subset.length >= horizon-1 && subset.length <= horizon+1 &&
      subset.every(([t],i)=>i===0 || t-subset[i-1][0] === 3600000) &&
      (subset.length===0 || subset[0][0]-start <= 3600000) &&
      (subset.length===0 || start+horizon*3600000-subset.at(-1)[0] < 3600000);
    const complete = aligned && valid.length === subset.length;
    const rainfallMm = complete ? valid.reduce((s,[,h])=>s+Number(h.value),0) : null;
    const probs = complete ? valid.map(([,h])=>h.probability) : [];
    const rainChanceMax = complete && probs.length && probs.every(p=>typeof p === 'number' && Number.isFinite(p) && p>=0 && p<=100)
      ? Math.max(...probs.map(Number)) : null;
    const rainfallPer24h = complete ? rainfallMm * 24 / subset.length : null;
    const category = complete ? rainfallIntensityBand(rainfallMm, subset.length) : 'Unavailable';
    return {horizonHours:horizon, rainfallMm, hoursAvailable:valid.length, complete, rainChanceMax, rainfallPer24h, category};
  });
}
