// Plain-language presentation of existing experimental signals; no new forecast model.
export function farmerHorizon(outlook, rainfall) {
  const validRank = Number.isInteger(outlook?.rank) && outlook.rank >= 0 && outlook.rank <= 3;
  const unknown = !validRank || /unavailable|insufficient|cannot assess|unknown/i.test(outlook?.label || '');
  const completeRain = rainfall?.complete === true && Number.isFinite(rainfall?.rainfallMm) && rainfall.rainfallMm >= 0;
  const rainText = completeRain ? `${rainfall.rainfallMm.toFixed(1)} mm rain expected` : 'Rain forecast incomplete';
  const levels = [
    { title: 'No strong warning sign', detail: 'No strong signal detected in available forecasts.', tone: 'sky', icon: '☁️' },
    { title: 'Keep watch', detail: 'Conditions need closer attention.', tone: 'amber', icon: '👀' },
    { title: 'Prepare now', detail: 'Forecast conditions suggest increased concern.', tone: 'orange', icon: '⚠️' },
    { title: 'High concern', detail: 'Take precautions and check official warnings.', tone: 'red', icon: '🚨' }
  ];
  return {
    ...(unknown ? {title: 'Not enough information', detail: 'Check official updates; the forecast is incomplete.', tone: 'slate', icon: '❔'} : levels[outlook.rank]),
    horizonHours: outlook?.horizonHours ?? rainfall?.horizonHours ?? null,
    rainText,
    rainAvailable: completeRain,
    riverAvailable: outlook?.riverAvailable === true,
    riverIdentityVerified: outlook?.riverIdentityVerified === true,
    uncertain: unknown
  };
}
export function farmerSummary(outlooks = [], riverForecast = null) {
  const valid = outlooks.filter(x => Number.isInteger(x?.rank) && x.rank >= 0 && x.rank <= 3);
  const max = valid.length ? Math.max(...valid.map(x => x.rank)) : null;
  const unknown = outlooks.some(x => !Number.isInteger(x?.rank) || x.rank < 0);
  const lines = [];
  if (max === null) {
    lines.push('There is not enough forecast information to judge current concern.');
  } else if (max >= 2) {
    lines.push('Rain or nearby modeled river conditions are showing a stronger warning sign.');
  } else if (max === 1) {
    lines.push('Some weather or river conditions need watching.');
  } else {
    lines.push('No strong signal was detected in the available forecasts.');
  }
  if (outlooks.some(x => x?.riverAvailable && !x?.riverIdentityVerified)) {
    lines.push('The nearby river forecast may not represent your local river.');
  } else if (!outlooks.some(x => x?.riverAvailable)) {
    lines.push('River forecast information is unavailable or cannot be matched to these days.');
  }
  if (unknown) lines.push('Some forecast information is missing.');
  const advice = max >= 2
    ? ['Move stored seeds, feed and tools to a dry, higher place if safe.', 'Watch nearby water levels and official flood warnings.', 'Do not enter flooded roads or fast-moving water.']
    : max === 1
      ? ['Check drains and nearby water levels from a safe place.', 'Keep important farm supplies ready to move.', 'Check official warnings again later.']
      : ['Continue checking local weather and river news.', 'Keep seeds and important supplies stored safely.', 'Follow official warnings if conditions change.'];
  return { lines, advice };
}
