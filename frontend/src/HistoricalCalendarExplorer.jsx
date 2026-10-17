import React, {useEffect, useMemo, useState} from 'react';
import L from 'leaflet';
import {MapContainer, TileLayer, GeoJSON, useMap} from 'react-leaflet';
import {HISTORICAL_EVENTS, followingFourDays, eventsForDate, eventExposure, eventPercentagePointChange} from './historicalExplorerData.js';
const DISTRICTS=['All districts','Brahmanbaria','Habiganj','Kishoreganj','Moulvibazar','Netrakona','Sunamganj','Sylhet'];
const colors=['#2563eb','#0e7490','#d97706'];
function FitHistorical({data}) {
  const map=useMap();
  useEffect(()=>{if(!data?.features?.length)return;const b=L.geoJSON(data).getBounds();if(b.isValid())map.fitBounds(b,{padding:[16,16],maxZoom:9});},[data,map]);
  return null;
}
export default function HistoricalCalendarExplorer(){
  const [date,setDate]=useState('2017-08-01');
  const [district,setDistrict]=useState('All districts');
  const [eventId,setEventId]=useState(4508);
  const [summary,setSummary]=useState(null);
  const [layer,setLayer]=useState(null);
  const [districtLayer,setDistrictLayer]=useState(null);
  const [error,setError]=useState('');
  const [selectedDay,setSelectedDay]=useState(0);
  const days=useMemo(()=>followingFourDays(date),[date]);
  const matching=useMemo(()=>eventsForDate(days[selectedDay]),[days,selectedDay]);
  const selectedEvent=HISTORICAL_EVENTS.find(e=>e.id===eventId);
  const eventMatchesDate=matching.some(e=>e.id===eventId);
  useEffect(()=>{setSelectedDay(0);},[date]);
  useEffect(()=>{if(matching.length)setEventId(matching[0].id);},[matching]);
  useEffect(()=>{
    let active=true;
    fetch('/data/haorshield_dashboard_data.json').then(r=>{if(!r.ok)throw Error('Historical summary unavailable');return r.json();}).then(x=>{if(active)setSummary(x);}).catch(e=>{if(active)setError(e.message);});
    fetch('/data/haorshield_districts.geojson').then(r=>r.json()).then(x=>{if(active)setDistrictLayer(x);}).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{let active=true;setLayer(null);setError('');fetch(`/data/haorshield_flood_${eventId}.geojson`).then(r=>{if(!r.ok)throw Error('Historical map unavailable');return r.json();}).then(x=>{if(active)setLayer(x);}).catch(e=>{if(active)setError(e.message);});return ()=>{active=false;};},[eventId]);
  const exposure=eventExposure(summary,eventId,district);
  const prior=HISTORICAL_EVENTS.find((e,i)=>HISTORICAL_EVENTS[i+1]?.id===eventId);
  const difference=prior?eventPercentagePointChange(summary,prior.id,eventId,district):null;
  const visibleMap=eventMatchesDate ? layer:null;
  const shownBoundaries=useMemo(()=>{
    if(!districtLayer || district==='All districts')return districtLayer;
    return {...districtLayer,features:districtLayer.features.filter(f=>{
      const p=f.properties||{};const name=(p.ADM2_NAME||p.ADM2_EN||'').toLowerCase().replace(/[^a-z]/g,'');
      return name === district.toLowerCase().replace(/[^a-z]/g,'') || (district==='Brahmanbaria'&&name==='brahamanbaria') || (district==='Moulvibazar'&&name==='maulvibazar');
    })};
  },[district,districtLayer]);
  return <section className="space-y-4" aria-label="Historical flood explorer">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Historical Flood Explorer</h2><p className="text-sm text-slate-600">Explore available MODIS event maps from 2016–2017.</p></div><span className="text-xs bg-sky-100 text-sky-900 rounded-full px-3 py-1">Historical observations</span></div>
    <div className="rounded-2xl bg-white border p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-sm font-semibold">Starting date<input aria-label="Historical starting date" type="date" min="2016-01-01" max="2017-12-31" value={date} onChange={e=>setDate(e.target.value)} className="block mt-1 w-full rounded-lg border px-3 py-2" /></label>
      <label className="text-sm font-semibold">District<select aria-label="Historical district" value={district} onChange={e=>setDistrict(e.target.value)} className="block mt-1 w-full rounded-lg border px-3 py-2">{DISTRICTS.map(d=><option key={d}>{d}</option>)}</select></label>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2" aria-label="Four-day historical timeline">{days.map((d,i)=>{
      const matches=eventsForDate(d);
      const event=matches[0];
      return <button key={d} type="button" onClick={()=>{setSelectedDay(i);if(event)setEventId(event.id);}} aria-pressed={selectedDay===i} className={`rounded-xl p-3 text-left border ${selectedDay===i?'border-sky-600 bg-sky-50':'bg-white border-slate-200'}`}>
        <div className="text-xs text-slate-500">Day {i+1}</div><div className="font-bold text-sm">{d}</div><div className="text-xs mt-1">{event?'Event-era map available':'No daily observation'}</div>
      </button>;
    })}</div>
    <div className="rounded-2xl border bg-white p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between"><h3 className="font-bold">Recorded flood footprints</h3><div className="flex flex-wrap gap-1">{HISTORICAL_EVENTS.map((e,i)=><button type="button" key={e.id} onClick={()=>{setDate(e.start);setEventId(e.id);setSelectedDay(0);}} className={`text-xs rounded-lg border px-3 py-1.5 ${eventId===e.id&&eventMatchesDate?'bg-sky-800 text-white':'bg-white'}`}>{e.label}</button>)}</div></div>
      {eventMatchesDate ? <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-blue-50 p-3"><p className="text-xs text-slate-600">Archived flood event</p><p className="text-lg font-bold">Recorded · {selectedEvent.label}</p></div><div className="rounded-xl bg-cyan-50 p-3"><p className="text-xs text-slate-600">Event-wide cropland overlap</p><p className="text-lg font-bold">{exposure?`${exposure.percentage.toFixed(1)}%`:'Unavailable'}</p></div></div> : <div className="rounded-xl bg-slate-100 p-3 text-sm">No flood observation in the available archive for this date. This does not mean no flood occurred.</div>}
      {eventMatchesDate&&<p className="text-xs text-slate-600">{difference===null?'Event-to-event change: unavailable':`Change versus previous archived event: ${difference>=0?'+':''}${difference.toFixed(1)} percentage points`}. Daily percentage change: unavailable (event composite only).</p>}
      <div className="h-[340px] rounded-xl overflow-hidden border" aria-label="Historical event flood map"><MapContainer center={[24.6,91.2]} zoom={8} scrollWheelZoom={false} style={{height:'100%',width:'100%'}}><TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{shownBoundaries?.features?.length>0&&<GeoJSON key={'b-'+district} data={shownBoundaries} style={()=>({color:'#64748b',weight:1,fillOpacity:0.04})}/>} {visibleMap&&<><FitHistorical data={visibleMap}/><GeoJSON key={'f-'+eventId} data={visibleMap} style={()=>({color:colors[HISTORICAL_EVENTS.findIndex(e=>e.id===eventId)],weight:1,fillColor:colors[HISTORICAL_EVENTS.findIndex(e=>e.id===eventId)],fillOpacity:0.62})}/></>}</MapContainer></div>
      <p className="text-xs text-slate-600">Map shows the seven-district event footprint; district selection changes the exposure statistic. Map color identifies the selected archived event: <span className="font-semibold" style={{color:colors[HISTORICAL_EVENTS.findIndex(e=>e.id===eventId)]}}>{selectedEvent.label}</span>. MODIS maps are event-wide composites, not daily flood snapshots.</p>
      {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  </section>;
}
