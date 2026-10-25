import React, {useEffect, useMemo, useState} from "react";
import L from "leaflet";
import {MapContainer, TileLayer, GeoJSON, useMap} from "react-leaflet";
import {selectUpazilaBoundary,clipRainCells} from "./upazilaPolygonOverlay.js";
import {useLanguage} from "./LanguageContext.jsx";

const COLORS = {
  "Low Forecast Rainfall":"#93c5fd",
  "Moderate Rainfall":"#facc15",
  "Heavy Rainfall":"#fb923c",
  "Very Heavy Rainfall":"#dc2626"
};
const LEGEND = [
  ["#93c5fd", "Little / no rain"],
  ["#facc15", "Some rain"],
  ["#fb923c", "Heavy rain"],
  ["#dc2626", "Very heavy rain"]
];
function Fit({features}) {
  const map=useMap();
  useEffect(()=>{
    if (!features.length) return;
    const bounds=L.geoJSON({type:"FeatureCollection", features}).getBounds();
    if(bounds.isValid()) map.fitBounds(bounds,{padding:[12,12], maxZoom:10, animate:false});
  },[features,map]);
  return null;
}
export default function SimpleRainMap({district, hours=24, selectedUpazila=null}) {
  const {t, tDistrict, tUpazila} = useLanguage();
  const [boundaries,setBoundaries]=useState(null);
  const [clips,setClips]=useState(null);
  const [districtBoundaries,setDistrictBoundaries]=useState(null);
  const [geo,setGeo]=useState(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    fetch("/data/haorshield_rainfall_risk.geojson")
      .then(r=>{if(!r.ok)throw new Error(t("rainMap.unavailable", "Rain map is not available right now."));return r.json();})
      .then(data=>{if(data?.type!=="FeatureCollection" || !Array.isArray(data.features)) throw new Error(t("rainMap.unavailable", "Rain map is not available right now."));setGeo(data);})
      .catch(e=>setError(e.message));
  },[]);
  useEffect(()=>{
    let active=true;
    Promise.all([
      fetch('/data/haorshield_upazila_boundaries.geojson').then(r=>{if(!r.ok)throw Error('missing upazila boundaries');return r.json();}),
      fetch('/data/haorshield_upazila_cell_clips.json').then(r=>{if(!r.ok)throw Error('missing polygon clips');return r.json();}),
      fetch('/data/haorshield_districts.geojson').then(r=>{if(!r.ok)throw Error('missing district boundaries');return r.json();})
    ]).then(([u,c,d])=>{if(active){setBoundaries(u);setClips(c);setDistrictBoundaries(d);}}).catch(()=>{if(active){setBoundaries(null);setClips(null);setDistrictBoundaries(null);}});
    return()=>{active=false};
  },[]);
  const selectedBoundary=useMemo(()=>selectUpazilaBoundary(boundaries,district,selectedUpazila),[boundaries,district,selectedUpazila]);
  const districtBoundary=useMemo(()=>{
    const normal=x=>String(x||'').toLowerCase().replace(/[^a-z]/g,'').replace('netrokona','netrakona').replace('brahamanbaria','brahmanbaria').replace('maulvibazar','moulvibazar');
    const f=districtBoundaries?.features?.filter(f=>normal(f.properties?.ADM2_NAME)===normal(district))||[];
    return f.length?{type:'FeatureCollection',features:f}:null;
  },[districtBoundaries,district]);
  const features=useMemo(()=>geo?.features?.filter(f=>String(f.properties?.district || "").toLowerCase()===String(district).toLowerCase()) || [],[geo,district]);
  const visibleFeatures=useMemo(()=>selectedUpazila ? selectedBoundary ? clipRainCells(geo?.features||[],clips,district,selectedUpazila) : [] : features,[selectedUpazila,selectedBoundary,geo,clips,district,features]);
  const data=useMemo(()=>({type:"FeatureCollection",features:visibleFeatures}),[visibleFeatures]);

  const legendItems = [
    ["#93c5fd", t("rainMap.noRain", "Little / no rain")],
    ["#facc15", t("rainMap.someRain", "Some rain")],
    ["#fb923c", t("rainMap.heavyRain", "Heavy rain")],
    ["#dc2626", t("rainMap.veryHeavyRain", "Very heavy rain")]
  ];

  return <section className="bg-white rounded-2xl border p-4 space-y-3" aria-label="Rain forecast map">
    <h3 className="text-lg font-bold">{t("rainMap.title", "Rain map — {area}", { area: `${selectedUpazila ? `${tUpazila(selectedUpazila)}, ` : ""}${tDistrict(district)}` })}</h3>
    <p className="text-sm text-slate-700">{t("rainMap.desc", "Colors show the mapped rainfall-screening cells for the next {hours} hours. Upazila selections clip the existing district-level data to the actual administrative polygon; this is not an upazila-calibrated forecast or flooded land.", { hours })}</p>
    <div className="flex flex-wrap gap-3 text-sm" aria-label="Rain color key">
      {legendItems.map(([color,label])=><span className="flex items-center gap-2" key={label}><span style={{backgroundColor:color}} className="w-4 h-4 rounded-sm border"/>{label}</span>)}
    </div>
    {error ? <p role="status">{error}</p> : !geo ? <p>{t("rainMap.loading", "Loading rain map…")}</p> : selectedUpazila && !selectedBoundary ? <p role="status">{t("rainMap.upazilaUnavailable", "Selected upazila boundary unavailable. District-wide shading is hidden to prevent a misleading map.")}</p> : !visibleFeatures.length ? <p>{t("rainMap.noCells", "No rainfall research cells overlap this area.")}</p> :
      <div className="h-[280px] sm:h-[380px] rounded-xl overflow-hidden"><MapContainer key={`${district}-${selectedUpazila||"all"}`} center={[24.65,91.05]} zoom={8} minZoom={6} maxZoom={12} maxBounds={[[20,87],[27,95]]} maxBoundsViscosity={1} style={{height:"100%",width:"100%"}}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <GeoJSON key={`${district}-${selectedUpazila||"all"}-${hours}-${Boolean(clips)}`} data={data} style={feature=>({color:"#475569", weight:.5,fillColor:COLORS[feature.properties?.[`alert${hours}`]]||"#93c5fd",fillOpacity:.6})} onEachFeature={(feature,layer)=>{
          const mm=Number(feature.properties?.[`rain${hours}_mm`]);
          layer.bindPopup(`${district}: ${Number.isFinite(mm)?`${mm.toFixed(1)} mm rain expected`:"Rain amount unavailable"}`);
        }}/>
        {districtBoundary && <GeoJSON key={`district-${district}`} data={districtBoundary} style={()=>({color:'#0f172a',weight:2.6,fillOpacity:0,opacity:.95})}/>}
        {selectedBoundary && <GeoJSON key={`upazila-${district}-${selectedUpazila}`} data={selectedBoundary} style={()=>({color:'#0369a1',weight:2.7,fillOpacity:0,opacity:.95})}/>}
        <Fit features={selectedBoundary?.features||districtBoundary?.features||visibleFeatures}/>
      </MapContainer></div>}
    <p className="text-xs text-slate-500">{t("rainMap.warning", "Rain colors are not flood warnings. River water can rise even when local rain is low.")}</p>
  </section>;
}
