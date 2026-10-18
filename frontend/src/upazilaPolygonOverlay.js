// Display names and stored clip keys have different spellings/suffixes.
// Keep normalized display matching separate from lookup of the published clip keys.
export function placeKey(district, upazila) {
  const normalized = value => {
    const key = String(value || '').toLowerCase().replace(/[^a-z]/g, '')
      .replace('netrokona', 'netrakona')
      .replace('brahamanbaria', 'brahmanbaria')
      .replace('maulvibazar', 'moulvibazar')
      .replace(/upazilla$/, '')
      .replace(/upazila$/, '');
    // Only verified historical names and spelling aliases. Do not guess boundaries.
    const aliases = {
      dharmapasha: 'dharampasha',
      baniachong: 'baniachang',
      bishwambarpur: 'bishwamvarpur',
      shalla: 'sulla',
      shantiganj: 'dakshinsunamganj',
      dakshinsunamganj: 'dakshinsunamganj',
      golabganj: 'golapganj'
    };
    return aliases[key] || key;
  };
  return `${normalized(district)}|${normalized(upazila)}`;
}

function matchedClips(table, district, upazila) {
  if (!table || typeof table !== 'object') return null;
  const key = placeKey(district, upazila);
  // Published clips are keyed with their original names, e.g. "madanupazilla".
  // Exact match is preferred; aliases are resolved only within the same district.
  if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  const candidates = Object.keys(table).filter(stored => {
    const separator = stored.indexOf('|');
    return separator >= 0 && placeKey(stored.slice(0, separator), stored.slice(separator + 1)) === key;
  });
  return candidates.length === 1 ? table[candidates[0]] : null;
}

export function selectUpazilaBoundary(boundaries, district, upazila) {
  if (!upazila || !Array.isArray(boundaries?.features)) return null;
  const target = placeKey(district, upazila);
  const f = boundaries.features.find(f => placeKey(f.properties?.district_name, f.properties?.name) === target);
  return f ? { type: 'FeatureCollection', features: [f] } : null;
}

export function clipResearchCells(features, clips, district, upazila) {
  if (!upazila) return features;
  const match = matchedClips(clips?.upazilas, district, upazila);
  if (!match || !Array.isArray(features)) return [];
  return features.flatMap(f => {
    const x = match[String(f.properties?.cell_id)];
    return x ? [{ ...f, geometry: x.geometry, properties: { ...f.properties, overlapFraction: x.fraction } }] : [];
  });
}

export function clipRainCells(features, clips, district, upazila) {
  if (!upazila) return features;
  const match = matchedClips(clips?.rainUpazilas, district, upazila);
  if (!match || !Array.isArray(features) || clips.source_cell_count !== features.length) return [];
  return features.flatMap((f, i) => {
    const x = match[String(i)];
    return x ? [{ ...f, geometry: x.geometry, properties: { ...f.properties, overlapFraction: x.fraction } }] : [];
  });
}
