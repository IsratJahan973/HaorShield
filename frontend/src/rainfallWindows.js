/** Rolling rain totals from a single forecast retrieval, relative to retrieval time.
 * These are meteorological outlooks, NOT flood probabilities or inundation forecasts.
 */
export function rollingRainfallWindows(hours, issueTime = new Date()) {
  const issueMs = new Date(issueTime).getTime();
  if (!Number.isFinite(issueMs)) throw new Error('Invalid forecast issue time');
  if (!Array.isArray(hours)) throw new Error('Hourly forecast unavailable');
  return [24, 48, 72].map(horizon => {
    const subset = hours.filter(h => {
      const ms = new Date(h.timestamp).getTime();
      return Number.isFinite(ms) && ms > issueMs && ms <= issueMs + horizon * 3600000;
    });
    const valid = subset.filter(h => h.value !== null && Number.isFinite(Number(h.value)) && Number(h.value) >= 0);
    const complete = subset.length >= horizon - 1 && valid.length === subset.length;
    const rainfallMm = valid.reduce((s,h) => s + Number(h.value), 0);
    const pops = valid.map(h => h.probability).filter(p => Number.isFinite(p) && p >= 0 && p <= 100);
    const rainChanceMax = pops.length === valid.length && pops.length ? Math.max(...pops) : null;
    const rainfallPer24h = valid.length ? rainfallMm * 24 / valid.length : null;
    const category = rainfallPer24h === null ? 'Unavailable' : rainfallPer24h >= 100 ? 'Very heavy' : rainfallPer24h >= 50 ? 'Heavy' : rainfallPer24h >= 10 ? 'Moderate' : rainfallPer24h > 0 ? 'Light' : 'No rain';
    return { horizonHours: horizon, rainfallMm, hoursAvailable: valid.length, complete, rainChanceMax, rainfallPer24h, category };
  });
}
