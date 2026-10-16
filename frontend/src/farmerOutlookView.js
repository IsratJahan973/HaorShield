// Clear presentation of available evidence; never imply calibrated flood probability.
export function farmerHorizon(outlook, rainfall) {
  const rank = Number.isInteger(outlook?.rank) && outlook.rank >= 0 && outlook.rank <= 3 ? outlook.rank : null;
  const completeRain = rainfall?.complete === true && Number.isFinite(rainfall?.rainfallMm) && rainfall.rainfallMm >= 0;
  const riverAvailable = outlook?.riverAvailable === true;
  const rainText = completeRain ? `${rainfall.rainfallMm.toFixed(1)} mm rain expected` : 'Rain forecast unavailable';
  const levels = [
    {title:'No elevated signal in checked forecasts',detail:'Keep watching local water levels. This does not guarantee safety.',tone:'sky',icon:'☁️'},
    {title:'Watch for possible flooding',detail:'Some forecast conditions need closer attention.',tone:'amber',icon:'👀'},
    {title:'Elevated flood concern',detail:'Prepare farm supplies and follow official flood updates.',tone:'orange',icon:'⚠️'},
    {title:'High flood concern',detail:'Take precautions and follow official flood warnings.',tone:'red',icon:'🚨'}
  ];
  if (rank !== null && rank > 0) return {...levels[rank],horizonHours:outlook.horizonHours,rainText,rainAvailable:completeRain,riverAvailable,uncertain:!completeRain || !riverAvailable};
  if (completeRain && !riverAvailable) return {
    title:'Rain checked · river flood concern unknown',
    detail:'Rain information is available, but the river forecast cannot be checked for this period.',
    tone:'slate',icon:'🌧️',horizonHours:outlook?.horizonHours ?? rainfall?.horizonHours,
    rainText,rainAvailable:true,riverAvailable:false,uncertain:true
  };
  if (!completeRain && riverAvailable) return {
    title:'River checked · rain information missing',
    detail:'The available river forecast shows no elevated signal, but rain information is incomplete.',
    tone:'slate',icon:'🌊',horizonHours:outlook?.horizonHours ?? rainfall?.horizonHours,
    rainText,rainAvailable:false,riverAvailable:true,uncertain:true
  };
  if (rank===0 && completeRain && riverAvailable) return {...levels[0],horizonHours:outlook.horizonHours,rainText,rainAvailable:true,riverAvailable:true,uncertain:false};
  return {title:'Flood concern cannot be checked yet',detail:'Rain and river forecasts are missing or incomplete. Check official updates.',tone:'slate',icon:'❔',horizonHours:outlook?.horizonHours ?? rainfall?.horizonHours,rainText,rainAvailable:completeRain,riverAvailable,uncertain:true};
}
export function farmerSummary(outlooks=[],riverForecast=null){
  const ranks=outlooks.filter(x=>Number.isInteger(x?.rank)&&x.rank>=0&&x.rank<=3).map(x=>x.rank);
  const peak=ranks.length?Math.max(...ranks):null;
  const lines=[];
  if(peak>=2) lines.push('Available weather or nearby river signals suggest increased flood concern.');
  else if(peak===1) lines.push('Some forecast conditions need watching.');
  else if(outlooks.some(x=>x?.rainfallAvailable===true)) lines.push('Local rain information is available. River flooding may still happen even when local rain is low.');
  else lines.push('There is not enough information to judge flood concern.');
  if(!outlooks.some(x=>x?.riverAvailable===true)) lines.push('The river forecast could not be checked for these periods.');
  else if(outlooks.some(x=>x?.riverAvailable===true&&!x?.riverIdentityVerified)) lines.push('The nearby modeled river may not be your local river.');
  if(outlooks.some(x=>x?.rainfallAvailable===false)) lines.push('Some rainfall forecasts are incomplete.');
  const advice=peak>=2?['Move seeds, feed and equipment to higher, dry ground when safe.','Check nearby river levels and official warnings.','Avoid flooded roads and flowing water.']:['Monitor local water levels and official warnings.','Keep farm supplies dry and protected.','Recheck the forecast later.'];
  return {lines,advice};
}
