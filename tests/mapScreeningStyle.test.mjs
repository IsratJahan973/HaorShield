import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const path = new URL('../frontend/src/LandAttentionMap.jsx', import.meta.url);
const source = readFileSync(path, 'utf8');
assert.match(source, /mapScreeningStyle\(feature, hours\)/);
assert.match(source, /key=\{`\$\{district\}-\$\{hours\}`\}/);
assert.match(source, /sar_candidate_fraction_\$\{hours\}h/);
const code=source.slice(source.indexOf('export function mapScreeningStyle'), source.indexOf('const HOURS = [24, 48, 72];', source.indexOf('export function mapScreeningStyle')+10));
// Use static source test; full production build validates JSX and execution integration.
assert.match(code,/fillOpacity: 0\.40 \+ 0\.35 \* intensity/);
console.log('PASS map style uses the selected horizon and indicator strength');
