import React, {useEffect, useMemo, useState} from "react";
import L from "leaflet";
import {MapContainer, TileLayer, GeoJSON, useMap} from "react-leaflet";

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
export default function SimpleRainMap({district, hours=24}) {
  const [geo,setGeo]=useState(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    fetch("/data/haorshield_rainfall_risk.geojson")
      .then(r=>{if(!r.ok)throw new Error("Rain map is not available right now.");return r.json();})
      .then(data=>{if(data?.type!=="FeatureCollection" || !Array.isArray(data.features)) throw new Error("Rain map is not available right now.");setGeo(data);})
      .catch(e=>setError(e.message));
  },[]);
  const features=useMemo(()=>geo?.features?.filter(f=>String(f.properties?.district || "").toLowerCase()===String(district).toLowerCase()) || [],[geo,district]);
  const data=useMemo(()=>({type:"FeatureCollection",features}),[features]);
  return <section className="bg-white rounded-2xl border p-4 space-y-3" aria-label="Rain forecast map">
    <h3 className="text-lg font-bold">Rain map — {district}</h3>
    <p className="text-sm text-slate-700">Colors show how much rain is expected over the next {hours} hours. They do not show flooded land.</p>
    <div className="flex flex-wrap gap-3 text-sm" aria-label="Rain color key">
      {LEGEND.map(([color,label])=><span className="flex items-center gap-2" key={label}><span style={{backgroundColor:color}} className="w-4 h-4 rounded-sm border"/>{label}</span>)}
    </div>
    {error ? <p role="status">{error}</p> : !geo ? <p>Loading rain map…</p> : !features.length ? <p>No rain map is available for this district.</p> :
      <div className="h-[290px] sm:h-[380px] rounded-xl overflow-hidden"><MapContainer key={district} center={[24.65,91.05]} zoom={8} minZoom={6} maxZoom={12} maxBounds={[[20,87],[27,95]]} maxBoundsViscosity={1} style={{height:"100%",width:"100%"}}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <GeoJSON key={`${district}-${hours}`} data={data} style={feature=>({color:"#475569", weight:.5,fillColor:COLORS[feature.properties?.[`alert${hours}`]]||"#93c5fd",fillOpacity:.6})} onEachFeature={(feature,layer)=>{
          const mm=Number(feature.properties?.[`rain${hours}_mm`]);
          layer.bindPopup(`${district}: ${Number.isFinite(mm)?`${mm.toFixed(1)} mm rain expected`:"Rain amount unavailable"}`);
        }}/><Fit features={features}/>
      </MapContainer></div>}
    <p className="text-xs text-slate-500">Rain colors are not flood warnings. River water can rise even when local rain is low.</p>
  </section>;
}
