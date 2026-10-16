import assert from "node:assert/strict";
import { exposureForDistrict } from "../frontend/src/landAttention.js";
const names=["Brahmanbaria","Habiganj","Kishoreganj","Moulvibazar","Netrakona","Sunamganj","Sylhet"];
const map={type:"FeatureCollection",features:Array.from({length:306},(_,i)=>({type:"Feature",properties:{district:names[i%7],cell_id:i,cell_area_ha:100,cropland_ha:40,...Object.fromEntries([24,48,72].map(h=>[`sar_candidate_fraction_${h}h`,i===5?0.2:0]))},geometry:{type:"Polygon",coordinates:[[[90,24],[90.01,24],[90.01,24.01],[90,24]]]}}))};
const now=Date.parse("2026-10-16T11:00:00Z");
const data={map,summary:{cells:306,generated_at:"2026-10-16T10:00:00Z",issue_anchor_date_utc:"2026-10-16",is_validated_flood_probability:false,is_validated_inundation_prediction:false}};
for(const h of [24,48,72]) {const x=exposureForDistrict(data,"Sunamganj",h,"2026-10-16",now); assert.equal(x.ok,true);assert.equal(x.landKm2,1);assert.equal(x.cropHa,40);}
assert.equal(exposureForDistrict(data,"Sunamganj",24,"2026-10-17",now).ok,false);
// 18:50 UTC on Oct 16 = 00:50 Oct 17 in Bangladesh: valid same issue.
const midnightBD=Date.parse("2026-10-16T18:50:00Z");
const fresh=structuredClone(data); fresh.summary.generated_at="2026-10-16T18:35:00Z";
assert.equal(exposureForDistrict(fresh,"Sunamganj",24,"2026-10-17",midnightBD).ok,true);
// A future Bangladesh forecast date must not reuse today's research scenario.
assert.equal(exposureForDistrict(fresh,"Sunamganj",24,"2026-10-18",midnightBD).ok,false);
// Changing only the issue metadata cannot justify old data.
const old=structuredClone(fresh);old.summary.issue_anchor_date_utc="2026-10-15";
assert.equal(exposureForDistrict(old,"Sunamganj",24,"2026-10-17",midnightBD).ok,false);
assert.equal(exposureForDistrict(data,"Sunamganj",24,"2026-10-16",now+24*3600000).ok,false);
assert.equal(exposureForDistrict(data,"unknown",24,"2026-10-16",now).ok,false);
assert.equal(exposureForDistrict(data,"Sunamganj",17,"2026-10-16",now).ok,false);
const damaged=structuredClone(data);damaged.map.features[0].properties.cell_area_ha=-1;assert.equal(exposureForDistrict(damaged,"Sunamganj",24,"2026-10-16",now).ok,false);
console.log("8 land-map checks passed");

// Null screening / area values are missing evidence, not legitimate zeros.
for (const property of ['sar_candidate_fraction_24h','cell_area_ha','cropland_ha']) {
  const broken=structuredClone(data);
  broken.map.features[0].properties[property]=null;
  assert.equal(exposureForDistrict(broken,'Sunamganj',24,'2026-10-16',now).ok,false,property);
}
console.log('PASS missing spatial fraction and area validation');

const badGeometry=structuredClone(data);badGeometry.map.features[0].geometry.coordinates=[];
assert.equal(exposureForDistrict(badGeometry,'Sunamganj',24,'2026-10-16',now).ok,false);
const missingGeometry=structuredClone(data);missingGeometry.map.features[0].geometry=null;
assert.equal(exposureForDistrict(missingGeometry,'Sunamganj',24,'2026-10-16',now).ok,false);
console.log('PASS invalid geographic geometry rejection');
