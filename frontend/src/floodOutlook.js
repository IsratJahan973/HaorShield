/**
 * Experimental, location-requested hydrometeorological flood-concern screening.
 * NOT a validated flood occurrence probability or official flood warning.
 * River forecasts cover UTC calendar days, not exact rolling 24/48/72h.
 */
const LABELS = {
  unknown: ['Flood concern cannot be assessed', null, 'text-slate-700'],
  routine: ['No elevated forecast signal detected', 0, 'text-sky-800'],
  watch: ['Watch — possible flood concern', 1, 'text-amber-800'],
  elevated: ['Elevated flood concern signal', 2, 'text-orange-700'],
  high: ['High flood concern signal', 3, 'text-red-700']
};
// FR-07: ordinal concern levels, not flood probabilities.
const RISK_LEVELS = { routine: 'Low', watch: 'Moderate', elevated: 'High', high: 'Very High', unknown: null };
const LIMITATION = 'Experimental forecast screening, NOT verified local flood occurrence, inundation, calibrated probability or official warning. Forecast river flow is a nearby modeled grid-cell signal with unverified river-network relevance, not a measured BWDB danger level. UTC river model days and rolling local rainfall windows differ; upstream rainfall and existing flooding may be missed.';
function rankRain(x) {
  if (!x?.usable) return null;
  return ({
    'Low local rainfall signal': 0, 'Rainfall watch': 1,
    'Elevated rainfall concern': 2, 'High rainfall concern': 3
  })[x.level] ?? null;
}
function validUtcDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const timestamp = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
}
function rankRiver(x) {
  if (!x || !Number.isFinite(x.modeledDischargeM3s) || x.modeledDischargeM3s < 0 ||
      !validUtcDate(x.date)) return null;
  return ({
    'Within historical flow range': 0, 'Elevated river flow': 2,
    'Unusually high river flow': 3
  })[x.level] ?? null;
}
function consecutiveDates(days) {
  return days.every((d, i) => i === 0 ||
    Date.parse(d.date + 'T00:00:00Z') - Date.parse(days[i-1].date + 'T00:00:00Z') === 86400000);
}
export function combinedFloodOutlooks(rainfallConcerns, riverForecast, now = new Date()) {
  const todayUTC = now instanceof Date && Number.isFinite(now.getTime()) ? now.toISOString().slice(0, 10) : null;
  return [24, 48, 72].map((horizonHours, index) => {
    const rain = Array.isArray(rainfallConcerns) ? rainfallConcerns.find(x => x.horizonHours === horizonHours) : null;
    const localRain = rankRain(rain);
    const days = Array.isArray(riverForecast?.forecasts) ? riverForecast.forecasts.slice(0, index + 1) : [];
    const riverRanks = days.map(rankRiver);
    // Never shift the first available model day forward, or accept gaps / duplicate days.
    const usableRiver = Boolean(todayUTC && days.length === index + 1 &&
      days[0]?.date === todayUTC && riverRanks.every(Number.isInteger) && consecutiveDates(days));
    const river = usableRiver ? Math.max(...riverRanks) : null;
    const complete = localRain !== null && river !== null;
    const peak = Math.max(localRain ?? -1, river ?? -1);
    // An absent low signal cannot be treated as safety; a present elevated signal can still be reported.
    const category = peak >= 3 ? 'high' : peak === 2 ? 'elevated' : peak === 1 ? 'watch' : complete ? 'routine' : 'unknown';
    const [label, rank, className] = LABELS[category];
    const identityVerified = usableRiver && riverForecast?.localRiverIdentityVerified === true;
    const factors = [localRain === null ? 'Local rolling rainfall unavailable' : `Rolling ${horizonHours}h rainfall: ${rain.level}`];
    if (usableRiver) {
      factors.push(`Regional modeled river context (${days.map(x => x.date).join(', ')}): ${days.map(x => x.level).join(' / ')}`);
      if (!identityVerified) factors.push('Modeled river-to-local river connection not verified');
    } else factors.push('Comparable UTC model-day river forecasts unavailable or date-misaligned');
    return {
      horizonHours, label, rank, className,
      riskLevel: RISK_LEVELS[category], riskLevelOrdinal: rank,
      riskLevelBasis: 'Experimental rainfall and regional modeled river-flow screening; not a calibrated flood probability',
      rainfallAvailable: localRain !== null, riverAvailable: usableRiver,
      riverIdentityVerified: identityVerified,
      evidenceQuality: !complete ? 'Partial evidence — not a flood-safety clearance' :
        identityVerified ? 'Both model signals available; local river match independently verified' :
        'Both signals available; river context not locally verified',
      factors, modeledDays: usableRiver ? days.map(x => x.date) : [],
      isValidatedFloodPrediction: false, limitation: LIMITATION
    };
  });
}
