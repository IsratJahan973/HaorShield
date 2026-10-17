import assert from 'node:assert/strict';
import { combinedFloodOutlooks } from '../frontend/src/floodOutlook.js';

const now = new Date('2026-10-16T09:00:00Z');
const low = 'Low local rainfall signal';
const normal = 'Within historical flow range';
const rain = levels => [24,48,72].map((horizonHours,i) => ({ horizonHours, level: levels[i], usable: levels[i] !== null }));
const river = levels => ({ localRiverIdentityVerified: false, forecasts: levels.map((level,i) => ({date:`2026-10-${16+i}`,modeledDischargeM3s:500,level})) });
const score = (r,v) => combinedFloodOutlooks(r,v,now);
const names = o => o.map(x => x.riskLevel);
assert.deepEqual(names(score(rain([low,low,low]),river([normal,normal,normal]))),['Low','Low','Low']);
assert.deepEqual(names(score(rain(['Rainfall watch','Elevated rainfall concern','High rainfall concern']),river([normal,normal,normal]))),['Moderate','High','Very High']);
assert.deepEqual(names(score(rain([low,low,low]),river([normal,'Unusually high river flow',normal]))),['Low','Very High','Very High']);
assert.deepEqual(names(score(rain([low,low,low]),null)),[null,null,null]);
assert.deepEqual(names(score(null,river(['Elevated river flow',normal,normal]))),['High','High','High']);
assert.deepEqual(names(score(rain(['High rainfall concern',low,low]),null)),['Very High',null,null]);
const partial = score(rain([low,low,low]),null);
assert.ok(partial.every(x => x.evidenceQuality.includes('Partial evidence')));
assert.ok(partial.every(x => x.riskLevelBasis.includes('not a calibrated flood probability')));
assert.ok(partial.every(x => x.isValidatedFloodPrediction === false));
assert.deepEqual(score(rain([low,low,low]),river([normal,normal,normal])).map(x => x.riskLevelOrdinal),[0,0,0]);
const gap = river([normal,normal,normal]); gap.forecasts[1].date='2026-10-20';
assert.deepEqual(names(score(rain([low,low,low]),gap)),['Low',null,null]);
console.log('PASS FR-07: four ordinal categories, missing/partial evidence, strong signals and horizon alignment');

import fs from 'node:fs';
const ui = fs.readFileSync(new URL('../frontend/src/FloodRiskChecker.jsx', import.meta.url), 'utf8');
assert.ok(ui.includes('Experimental concern level: {outlook.riskLevel ?? "Unavailable"}'));
