// FR-18 farmer presentation. Never turn partial forecast evidence into a safety clearance.
export function riverStatusExplanation(error) {
  const e = String(error || '').toLowerCase();
  if (e.includes('within 8 km') || e.includes('no nearby modeled river cell'))
    return 'No suitable modeled river cell is close enough to this location.';
  if (e.includes('historical') && (e.includes('reference') || e.includes('compare') || e.includes('grid')))
    return 'The river model lacks a comparable historical reference for this point.';
  if (e.includes('three-day') || e.includes('forecast date') || e.includes('date-misaligned') || e.includes('coverage'))
    return 'The available river forecast dates do not fully match this period.';
  if (e.includes('channel') || e.includes('cell') || e.includes('disagree'))
    return 'The available river-model grid cells could not be checked reliably.';
  if (e.includes('429') || e.includes('timeout') || e.includes('abort') || e.includes('unavailable') || e.includes('503') || e.includes('500'))
    return 'The river-data service could not supply a usable forecast right now.';
  return 'A reliable modeled river assessment is not available for this location or period.';
}

const LEVELS = [
  {title:'No elevated signal in checked forecasts',detail:'Both available screening inputs are within the normal screening band. This is not a guarantee of safety.',tone:'sky',icon:'☁️',action:'Continue monitoring nearby water levels and official bulletins.'},
  {title:'Conditions to watch',detail:'At least one forecast input indicates changing conditions worth monitoring.',tone:'amber',icon:'👀',action:'Check updated weather and official river warnings regularly.'},
  {title:'Elevated flood concern',detail:'At least one forecast input indicates elevated flood-related conditions.',tone:'orange',icon:'⚠️',action:'Prepare to protect crops and supplies where safe, and follow official flood warnings.'},
  {title:'High flood concern',detail:'At least one forecast input indicates unusually high flood-related conditions.',tone:'red',icon:'🚨',action:'Take appropriate precautions and follow official instructions. Do not enter floodwater.'}
];

export function farmerHorizon(outlook, rainfall, riverForecastError = null) {
  const rank = Number.isInteger(outlook?.rank) && outlook.rank >= 0 && outlook.rank <= 3 ? outlook.rank : null;
  const completeRain = rainfall?.complete === true && Number.isFinite(rainfall?.rainfallMm) && rainfall.rainfallMm >= 0;
  const riverAvailable = outlook?.riverAvailable === true;
  const rainText = completeRain ? `${rainfall.rainfallMm.toFixed(1)} mm rain forecast` : 'Rainfall forecast unavailable';
  const reason = riverStatusExplanation(riverForecastError);
  const common = {
    horizonHours: outlook?.horizonHours ?? rainfall?.horizonHours,
    rainText, rainAvailable:completeRain, riverAvailable,
    riverText: riverAvailable
      ? (outlook?.riverIdentityVerified === true ? 'Modeled river evidence available (local match verified)' : 'Regional modeled river evidence available (local river not verified)')
      : 'River evidence unavailable for this period',
    evidenceText: outlook?.evidenceQuality || 'Experimental screening evidence; not a verified flood prediction'
  };
  if (rank !== null && rank >= 1) return {
    ...common,...LEVELS[rank],
    uncertain:!completeRain || !riverAvailable || outlook?.riverIdentityVerified !== true,
    detail:`${LEVELS[rank].detail}${!riverAvailable ? ` River assessment incomplete: ${reason}` : ''}${!completeRain ? ' Rainfall data are incomplete.' : ''}`
  };
  if (completeRain && !riverAvailable) return {
    ...common,title:'Flood concern cannot be fully assessed',
    detail:`Local rainfall is forecast at ${rainfall.rainfallMm.toFixed(1)} mm, but ${reason} River flooding cannot be ruled out from local rainfall alone.`,
    tone:'slate',icon:'🌧️',uncertain:true,
    action:'Watch local water levels, check official river alerts, and try again when river data become available.'
  };
  if (!completeRain && riverAvailable) return {
    ...common,title:'Flood concern cannot be fully assessed',
    detail:'Modeled river conditions are available, but the local rainfall forecast is incomplete. A low-concern conclusion is not justified.',
    tone:'slate',icon:'🌊',uncertain:true,
    action:'Check official weather and river alerts and retry when the rainfall data are available.'
  };
  if (rank === 0 && completeRain && riverAvailable) return {
    ...common,...LEVELS[0],uncertain:outlook?.riverIdentityVerified !== true,
    detail:outlook?.riverIdentityVerified === true ? LEVELS[0].detail : 'Available rainfall and regional modeled river signals are not elevated. The river model has not been confirmed as representing the local river, so local flooding cannot be excluded.'
  };
  return {
    ...common,title:'Flood concern cannot be assessed',
    detail:'Not enough verified rainfall and river forecast inputs are available. This is not a low-risk result.',
    tone:'slate',icon:'❔',uncertain:true,
    action:'Check official flood bulletins and local water levels, then retry later.'
  };
}

export function farmerSummary(outlooks=[],riverForecast=null,riverForecastError=null){
  const ranks=outlooks.filter(x=>Number.isInteger(x?.rank)&&x.rank>=0&&x.rank<=3).map(x=>x.rank);
  const peak=ranks.length?Math.max(...ranks):null;
  const lines=[];
  if(peak>=2) lines.push('At least one forecast period has an elevated rain or modeled river signal. This does not specify which fields will flood.');
  else if(peak===1) lines.push('Some forecast conditions need watching.');
  else if(outlooks.some(x=>x?.rainfallAvailable===true)) lines.push('Local rain information is available. Flooding can still occur through upstream river flows or existing water levels.');
  else lines.push('There is not enough information to assess flood concern.');
  if(!outlooks.some(x=>x?.riverAvailable===true)) lines.push(`River assessment unavailable: ${riverStatusExplanation(riverForecastError)}`);
  else if(outlooks.some(x=>x?.riverAvailable===true&&!x?.riverIdentityVerified)) lines.push('A modeled river signal is available, but its connection to the local river is not verified.');
  if(outlooks.some(x=>x?.rainfallAvailable===false)) lines.push('Some rainfall forecast periods are incomplete.');
  const advice=peak>=2?['Move seeds, feed and equipment to higher, dry ground when safe.','Check nearby river levels and official warnings.','Avoid flooded roads and flowing water.']:['Monitor local water levels and official warnings.','Keep farm supplies dry and protected.','Recheck the forecast later.'];
  return {lines,advice};
}
