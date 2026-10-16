/**
 * Experimental, physically motivated hydrometeorological flood CONCERN SCREENING.
 * This must never be relabelled as a calibrated flood-event prediction or
 * flood probability. Open-Meteo GloFAS daily UTC model-day flows are NOT
 * observed station danger-level exceedances or local inundation outcomes.
 */
const LEVELS = Object.freeze({
  unknown: {label:'Flood concern cannot be assessed', rank:null, color:'text-slate-700'},
  routine: {label:'No elevated signal detected', rank:0, color:'text-sky-800'},
  watch: {label:'Watch: possible rising flood concern', rank:1, color:'text-amber-800'},
  elevated: {label:'Elevated flood concern', rank:2, color:'text-orange-700'},
  high: {label:'High flood concern', rank:3, color:'text-red-700'},
});
function classifyRain(item) {
  if (!item?.usable) return null;
  const txt = String(item.level || '').toLowerCase();
  if (txt.includes('high rainfall')) return 3;
  if (txt.includes('elevated rainfall')) return 2;
  if (txt.includes('watch')) return 1;
  if (txt.includes('low local rainfall')) return 0;
  return null;
}
function classifyRiver(item) {
  if (!item || !Number.isFinite(item.modeledDischargeM3s)) return null;
  if (item.level === 'Unusually high river flow') return 3;
  if (item.level === 'Elevated river flow') return 2;
  if (item.level === 'Within historical flow range') return 0;
  return null;
}
/** The first 1/2/3 UTC GloFAS model days are combined with rolling 24/48/72h rain.
 * They are NOT exact rolling river forecast horizons; dates are made explicit.
 */
export function combinedFloodOutlooks(rainfallConcerns, riverForecast) {
  return [24,48,72].map((hours, index) => {
    const rain = rainfallConcerns?.find(v => v.horizonHours === hours);
    const rainRank = classifyRain(rain);
    const coveredRiverDays = riverForecast?.forecasts?.slice(0, index + 1) || [];
    const riverRanks = coveredRiverDays.map(classifyRiver);
    const riverValid = coveredRiverDays.length === index+1 && riverRanks.every(Number.isInteger);
    const riverRank = riverValid ? Math.max(...riverRanks) : null;
    // Do not declare a low-risk result from one benign factor if the other is unknown.
    let key = 'unknown';
    if (rainRank !== null || riverRank !== null) {
      const highest = Math.max(rainRank ?? -1, riverRank ?? -1);
      if (highest === 3) key='high';
      else if (highest === 2) key='elevated';
      else if (highest === 1) key='watch';
      else if (rainRank !== null && riverRank !== null) key='routine';
    }
    const row = LEVELS[key];
    return {
      horizonHours:hours,
      label:row.label,
      rank:row.rank,
      className:row.color,
      rainfallAvailable:rainRank !== null,
      riverAvailable:riverRank !== null,
      modeledDays:riverValid ? coveredRiverDays.map(v=>v.date) : [],
      limitation: 'Experimental flood-concern screening, NOT predicted local inundation or verified flood-event probability. River discharge is by UTC model day; rainfall is a rolling hour window. Upstream flooding can occur without local rain.'
    };
  });
}
