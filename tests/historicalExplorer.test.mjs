import assert from 'node:assert/strict';
import fs from 'node:fs';
import {followingFourDays,eventsForDate,eventExposure,eventPercentagePointChange,HISTORICAL_EVENTS} from '../frontend/src/historicalExplorerData.js';
assert.deepEqual(followingFourDays('2016-07-31'),['2016-07-31','2016-08-01','2016-08-02','2016-08-03']);
assert.deepEqual(followingFourDays('2017-02-29'),[]);
assert.equal(eventsForDate('2017-08-05')[0].id,4508);
assert.equal(eventsForDate('2017-06-01').length,0);
assert.equal(HISTORICAL_EVENTS.length,3);
const summary=JSON.parse(fs.readFileSync(new URL('../frontend/public/data/haorshield_dashboard_data.json',import.meta.url),'utf8'));
assert.ok(eventExposure(summary,4382).percentage>40);
assert.ok(Number.isFinite(eventPercentagePointChange(summary,4382,4508,'All districts')));
const explorer = fs.readFileSync(
  new URL('../frontend/src/HistoricalCalendarExplorer.jsx', import.meta.url),
  'utf8'
);

assert.match(
  explorer,
  /entire archived event, not an individual day/i
);
console.log('Historical event composite, four-day calendar, unknown-day safety, event differences passed');
