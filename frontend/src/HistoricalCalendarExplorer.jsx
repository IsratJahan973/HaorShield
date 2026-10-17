import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { HISTORICAL_EVENTS, followingFourDays, eventsForDate, eventExposure, eventPercentagePointChange } from './historicalExplorerData.js';

const DISTRICTS = ['All districts', 'Brahmanbaria', 'Habiganj', 'Kishoreganj', 'Moulvibazar', 'Netrakona', 'Sunamganj', 'Sylhet'];
// Colors distinguish archived events, NOT within-event flood severity.
const EVENT_COLORS = { 4382: '#f97316', 4459: '#dc2626', 4508: '#b45309' };
const fmt = n => Math.round(n).toLocaleString('en-BD');
function FitHistorical({ features, selectedDistrict }) {
  const map = useMap();
  useEffect(() => {
    const bounds = features?.features?.length ? L.geoJSON(features).getBounds() : null;
    if (bounds?.isValid()) map.fitBounds(bounds, { padding: [18,18], maxZoom: selectedDistrict === 'All districts' ? 9 : 10 });
  }, [features, selectedDistrict, map]);
  return null;
}
function normalized(name) { return String(name || '').toLowerCase().replace(/[^a-z]/g, ''); }
function districtMatch(properties, district) {
  const raw = normalized(properties?.ADM2_NAME || properties?.ADM2_EN);
  const target = normalized(district);
  return raw === target || (target === 'brahmanbaria' && raw === 'brahamanbaria') || (target === 'moulvibazar' && raw === 'maulvibazar') || (target === 'netrakona' && raw === 'netrokona');
}

export default function HistoricalCalendarExplorer() {
  const [date, setDate] = useState('2017-03-28');
  const [district, setDistrict] = useState('Sunamganj');
  const [eventId, setEventId] = useState(4459);
  const [summary, setSummary] = useState(null);
  const [layer, setLayer] = useState(null);
  const [districtLayer, setDistrictLayer] = useState(null);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const days = useMemo(() => followingFourDays(date), [date]);
  const matches = useMemo(() => eventsForDate(days[selectedDay]), [days, selectedDay]);
  const selectedEvent = HISTORICAL_EVENTS.find(e => e.id === eventId);
  const eventMatchesDate = matches.some(e => e.id === eventId);
  const exposure = eventMatchesDate ? eventExposure(summary, eventId, district) : null;
  const eventIndex = HISTORICAL_EVENTS.findIndex(e => e.id === eventId);
  const preceding = eventIndex > 0 ? HISTORICAL_EVENTS[eventIndex - 1] : null;
  const difference = eventMatchesDate && preceding ? eventPercentagePointChange(summary, preceding.id, eventId, district) : null;
  const color = EVENT_COLORS[eventId] || '#ea580c';

  useEffect(() => { setSelectedDay(0); }, [date]);
  useEffect(() => { if (matches.length && !matches.some(e => e.id === eventId)) setEventId(matches[0].id); }, [matches, eventId]);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/data/haorshield_dashboard_data.json').then(r => { if (!r.ok) throw Error('Historical summary unavailable'); return r.json(); }),
      fetch('/data/haorshield_districts.geojson').then(r => { if (!r.ok) throw Error('District boundaries unavailable'); return r.json(); })
    ]).then(([s, d]) => { if (active) { setSummary(s); setDistrictLayer(d); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setLayer(null);
    if (!eventMatchesDate) return () => { active = false; };
    fetch(`/data/haorshield_flood_${eventId}.geojson`)
      .then(r => { if (!r.ok) throw Error('Recorded flood map unavailable'); return r.json(); })
      .then(x => { if (active) setLayer(x); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [eventId, eventMatchesDate]);

  const focusBoundary = useMemo(() => {
    if (!districtLayer?.features?.length) return null;
    if (district === 'All districts') return districtLayer;
    const features = districtLayer.features.filter(f => districtMatch(f.properties, district));
    return features.length ? { type: 'FeatureCollection', features } : null;
  }, [districtLayer, district]);

  function chooseEvent(event) { setDate(event.start); setSelectedDay(0); setEventId(event.id); }
  return <section className="space-y-4" aria-label="Historical flood explorer">
    <div><h2 className="text-xl font-bold text-slate-900">Historical Flood Explorer</h2><p className="text-sm text-slate-500">Recorded flood maps · 2016–2017</p></div>
    <div className="rounded-2xl border bg-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-sm font-semibold">Starting date<input aria-label="Historical starting date" type="date" min="2016-01-01" max="2017-12-31" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
      <label className="text-sm font-semibold">District<select aria-label="Historical district" value={district} onChange={e => setDistrict(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2">{DISTRICTS.map(d => <option key={d}>{d}</option>)}</select></label>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2" aria-label="Four-day historical timeline">
      {days.map((d, i) => <button type="button" key={d} aria-pressed={selectedDay === i} onClick={() => { setSelectedDay(i); const found = eventsForDate(d); if (found.length) setEventId(found[0].id); }} className={`min-w-0 rounded-xl text-left p-2 sm:p-3 border ${selectedDay === i ? 'bg-orange-50 border-orange-500' : 'bg-white border-slate-200'}`}>
        <span className="block text-xs text-slate-500">Day {i + 1}</span><span className="font-semibold text-sm">{d}</span><span className="block text-xs mt-1 text-slate-600">{eventsForDate(d).length ? 'Archived event period' : 'No dated map'}</span>
      </button>)}
    </div>
    <div className="rounded-2xl border bg-white p-4 space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between"><h3 className="font-bold text-lg">Recorded flood footprint</h3><div className="flex flex-wrap gap-1" aria-label="Archived flood events">{HISTORICAL_EVENTS.map(e => <button type="button" key={e.id} onClick={() => chooseEvent(e)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${eventMatchesDate && eventId === e.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>{e.label}</button>)}</div></div>
      {eventMatchesDate ? <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 rounded-xl p-4 border" style={{ backgroundColor: '#fff7ed', borderColor: '#fed7aa' }}>
            <div className="text-sm font-semibold text-orange-950">Recorded cropland flood overlap</div>
            <div className="text-4xl font-extrabold text-orange-800 mt-1">{exposure ? `${exposure.percentage.toFixed(1)}%` : '—'}</div>
            <div className="text-xs text-orange-900 mt-2">{district} · {selectedEvent?.label} event total</div>
          </div>
          <div className="rounded-xl bg-slate-50 border p-4"><div className="text-sm text-slate-600">Versus previous archived event</div><div className="text-2xl font-bold mt-2">{difference === null ? '—' : `${difference > 0 ? '+' : ''}${difference.toFixed(1)} pp`}</div><div className="text-xs text-slate-600 mt-2">{preceding ? `Compared with ${preceding.label}` : 'First event in archive'}</div></div>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-sm"><span className="font-semibold">{selectedEvent?.label}:</span><span className="inline-flex items-center gap-2"><span className="inline-block h-4 w-5 rounded-sm border" style={{ backgroundColor: color, borderColor: '#7f1d1d' }} /> Recorded flood footprint</span><span className="text-slate-500">Gray outline: district boundary</span></div>
      </> : <div className="bg-slate-50 rounded-xl border p-4 text-sm">No dated flood observation for this selection.</div>}
      <div className="h-[280px] sm:h-[360px] rounded-xl overflow-hidden border" aria-label="Historical recorded flood map">
        <MapContainer center={[24.6,91.2]} zoom={8} scrollWheelZoom={false} style={{ height:'100%', width:'100%' }}>
          <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {districtLayer?.features?.length > 0 && <GeoJSON key={'boundary-'+district} data={districtLayer} style={f => ({ color: districtMatch(f.properties, district) || district === 'All districts' ? '#334155' : '#94a3b8', weight: districtMatch(f.properties,district) && district !== 'All districts' ? 2.5 : 0.8, fillOpacity: 0 })} />}
          {focusBoundary && <FitHistorical features={focusBoundary} selectedDistrict={district} />}
          {eventMatchesDate && layer?.features?.length > 0 && <GeoJSON key={'historical-'+eventId} data={layer} style={() => ({ color:'#9a3412', weight:1.3, fillColor:color, fillOpacity:0.63 })} />}
        </MapContainer>
      </div>
      <p className="text-xs text-slate-500">Percentages and colored footprints summarize the entire archived event, not an individual day. The map displays the wider event footprint; selecting a district changes the map focus and district percentage.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  </section>;
}
