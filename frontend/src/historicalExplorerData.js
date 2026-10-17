// MODIS event composites: only month/year ranges are available in this archive.
// Never infer observations on individual days from an event-wide polygon.
export const HISTORICAL_EVENTS = Object.freeze([
  { id: 4382, label: 'Jul–Aug 2016', start: '2016-07-01', end: '2016-08-31' },
  { id: 4459, label: 'Mar–Apr 2017', start: '2017-03-01', end: '2017-04-30' },
  { id: 4508, label: 'Aug 2017', start: '2017-08-01', end: '2017-08-31' }
]);
export function validISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function followingFourDays(start) {
  if (!validISODate(start)) return [];
  const ms = Date.parse(start + 'T00:00:00Z');
  return [0,1,2,3].map(n => new Date(ms + n*86400000).toISOString().slice(0,10));
}
export function eventsForDate(date) {
  if (!validISODate(date)) return [];
  return HISTORICAL_EVENTS.filter(e => date >= e.start && date <= e.end);
}
export function eventExposure(summary, eventId, district = 'All districts') {
  const records = district === 'All districts' ? summary?.event_summary : summary?.district_event_exposure;
  const row = records?.find(r => Number(r.event_id) === Number(eventId) &&
    (district === 'All districts' || normalizeDistrict(r.district) === district));
  if (!row) return null;
  const percentage = Number(row.flooded_pct_total_cropland);
  return Number.isFinite(percentage) ? {percentage, floodedHa:Number(row.flooded_cropland_ha)} : null;
}
function normalizeDistrict(value) {
  return ({Brahamanbaria:'Brahmanbaria',Maulvibazar:'Moulvibazar',Netrokona:'Netrakona'})[value] || value;
}
export function eventPercentagePointChange(summary, fromId, toId, district) {
  const a=eventExposure(summary,fromId,district), b=eventExposure(summary,toId,district);
  return a && b ? b.percentage-a.percentage : null;
}
