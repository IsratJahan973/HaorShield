/** Calendar-day rainfall summary, with a transparent rolling-24h fallback at midnight. */
export function selectForecastDay(hours, selectedDate, todayDate, rolling24, nowMs) {
  const validHours = (Array.isArray(hours) ? hours : []).filter(h =>
    Number.isFinite(new Date(h.timestamp).getTime()) &&
    new Date(h.timestamp).getTime() > nowMs &&
    new Date(h.timestamp).getTime() <= nowMs + 72 * 3600000
  );
  const selected = validHours.filter(h => h.time?.slice(0, 10) === selectedDate);
  const useRolling = selected.length === 0 && selectedDate === todayDate;
  const availableDates = [...new Set(validHours.map(h => h.time?.slice(0,10)).filter(Boolean))];
  if (!selected.length && !useRolling) {
    return { ok: false, message: availableDates.length
      ? `No usable forecast hours for ${selectedDate}. Available dates within the next 72 hours: ${availableDates.join(', ')}.`
      : 'The weather service returned no usable future hourly forecasts. Please try again later.' };
  }
  if (useRolling) {
    if (!rolling24?.complete || !Number.isFinite(rolling24.rainfallMm))
      return {ok:false, message:'There is no complete rolling 24-hour rainfall forecast available. Please retry shortly.'};
    return {ok:true, rainfall:rolling24.rainfallMm, hours:24,
      maxChance:rolling24.rainChanceMax, rollingFallback:true};
  }
  if (selected.some(h => typeof h.value !== 'number' || !Number.isFinite(h.value) || h.value<0))
    return {ok:false,message:'Some rainfall data is missing.'};
  const chances = selected.map(h=>h.probability);
  const completeChance = chances.every(p => typeof p === 'number' && Number.isFinite(p) && p>=0 && p<=100);
  return {ok:true, rainfall:selected.reduce((s,h)=>s+Number(h.value),0),hours:selected.length,
    maxChance:completeChance ? Math.max(...chances.map(Number)) : null,rollingFallback:false};
}
