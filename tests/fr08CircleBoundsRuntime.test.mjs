import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../frontend/src/LandAttentionMap.jsx", import.meta.url), "utf8");
// Leaflet Circle.getBounds() needs map projection, which is undefined before mount.
assert.doesNotMatch(source, /L\.circle\(point,\s*\{\s*radius:\s*20000\s*\}\)\.getBounds\(\)/);
assert.match(source, /L\.latLng\(point\[0\],\s*point\[1\]\)\.toBounds\(40000\)/);
assert.match(source, /map\.fitBounds\(bounds,/);
assert.match(source, /<Circle center=\{focusPoint\} radius=\{20000\}/);
console.log("PASS: map fitting does not call getBounds on an unmounted Leaflet circle");
