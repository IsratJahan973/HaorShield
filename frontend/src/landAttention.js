const DISTRICTS = new Set(["Brahmanbaria","Habiganj","Kishoreganj","Moulvibazar","Netrakona","Sunamganj","Sylhet"]);
export function exposureForDistrict(data, district, hours, forecastDate, nowMs=Date.now()) {
  const unavailable = message => ({ok:false,message});
  if (![24,48,72].includes(hours) || !DISTRICTS.has(district)) return unavailable("This area or period is not supported.");
  if (!data?.map || !data?.summary) return unavailable("The land map is not ready yet.");
  const {map,summary}=data;
  if(map.type!=="FeatureCollection" || map.features?.length!==306 || summary.cells!==306 || summary.is_validated_flood_probability!==false || summary.is_validated_inundation_prediction!==false) return unavailable("The land map could not be checked.");
  const issue=Date.parse(summary.generated_at || "");
  if(!Number.isFinite(issue) || issue>nowMs+3600000 || nowMs-issue>12*3600000) return unavailable("The land map is out of date. Wait for an updated map.");
  // A generated spatial issue is anchored to a UTC day, whereas the farmer's
  // selected weather date is in Asia/Dhaka. Around midnight Bangladesh time,
  // those dates can correctly differ. Verify each against its own clock.
  const utcIssueDate = new Date(nowMs).toISOString().slice(0, 10);
  const localDateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(nowMs));
  const part = type => localDateParts.find(x => x.type === type)?.value;
  const bangladeshDate = `${part("year")}-${part("month")}-${part("day")}`;
  if(summary.issue_anchor_date_utc !== utcIssueDate) return unavailable("The land map is for an older forecast issue. Wait for the next update.");
  if(forecastDate !== bangladeshDate) return unavailable("The land map is only available for today's outlook. Choose today to see it.");
  const seen=new Set();
  const features=[];
  for (const f of map.features) {
    const p=f?.properties;
    if(!p || !DISTRICTS.has(p.district) || p.cell_id===undefined || seen.has(String(p.cell_id))) return unavailable("The land map could not be checked.");
    seen.add(String(p.cell_id));
    if((p.cell_area_ha == null || !Number.isFinite(Number(p.cell_area_ha))) || Number(p.cell_area_ha)<=0 || (p.cropland_ha == null || !Number.isFinite(Number(p.cropland_ha))) || Number(p.cropland_ha)<0 || Number(p.cropland_ha)>Number(p.cell_area_ha)) return unavailable("The land map could not be checked.");
    for(const h of [24,48,72]) {
      const frac=Number(p[`sar_candidate_fraction_${h}h`]);
      if(p[`sar_candidate_fraction_${h}h`] == null || !Number.isFinite(frac) || frac<0 || frac>1) return unavailable("The land map could not be checked.");
    }
    if(p.district===district) features.push(f);
  }
  if(seen.size!==306 || !features.length) return unavailable("There is no checked map for this district.");
  const flagged=features.filter(f=>Number(f.properties[`sar_candidate_fraction_${hours}h`])>=0.10);
  const landKm2=flagged.reduce((s,f)=>s+Number(f.properties.cell_area_ha)/100,0);
  const cropHa=flagged.reduce((s,f)=>s+Number(f.properties.cropland_ha),0);
  return {ok:true,features,flaggedCount:flagged.length,landKm2,cropHa};
}
