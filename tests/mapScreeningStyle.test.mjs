import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression checks for the current map design: keep all cells visible in
// light blue when no elevated concern is reported; color only selected-horizon
// screening cells when concern is elevated.
const source = readFileSync(new URL('../frontend/src/LandAttentionMap.jsx', import.meta.url), 'utf8');

assert.match(source, /const HOURS = \[24, 48, 72\]/);
assert.match(source, /\[`sar_candidate_fraction_\$\{hours\}h`\]/);
assert.match(source, /forecastHasConcern\s*&&\s*frac\s*>=\s*0\.10/);
assert.match(source, /if\s*\(!isTarget\)\s*\{[\s\S]*?fillColor:\s*["']#bfdbfe["']/);
assert.match(source, /const stronger = frac >= 0\.35/);
assert.match(source, /fillColor:\s*stronger\s*\?\s*["']#c2410c["']\s*:\s*["']#fdba74["']/);
assert.match(source, /Map color guide/);
assert.match(source, /key=\{`\$\{district\}-\$\{hours\}-\$\{forecastHasConcern \? 'risk' : 'norisk'\}`\}/);
console.log('PASS map visibility, selected-hour cells, color legend, and elevated-concern targeting');
