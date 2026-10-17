
// Polygon intersections are prepared against the published 306-cell research grids.
// No boundary available -> no upazila fill; never display the whole district as local.

export function placeKey(district, upazila) {
  const normalized = value => {
    const key = String(value || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace('netrokona', 'netrakona')
      .replace('brahamanbaria', 'brahmanbaria')
      .replace('maulvibazar', 'moulvibazar');

    // Handle the spelling difference between dropdown and GeoJSON.
    return key === 'dharmapasha' ? 'dharampasha' : key;
  };

  return `${normalized(district)}|${normalized(upazila)}`;
}

export function selectUpazilaBoundary(boundaries, district, upazila) {
  if (!upazila || !boundaries?.features) return null;

  const target = placeKey(district, upazila);

  const feature = boundaries.features.find(
    f => placeKey(
      f.properties?.district_name,
      f.properties?.name
    ) === target
  );

  return feature
    ? { type: 'FeatureCollection', features: [feature] }
    : null;
}

export function clipResearchCells(features, clips, district, upazila) {
  if (!upazila) return features;

  const match = clips?.upazilas?.[placeKey(district, upazila)];

  if (!match || !Array.isArray(features)) return [];

  return features.flatMap(feature => {
    const intersection = match[String(feature.properties?.cell_id)];

    if (!intersection) return [];

    return [{
      ...feature,
      geometry: intersection.geometry,
      properties: {
        ...feature.properties,
        overlapFraction: intersection.fraction
      }
    }];
  });
}

export function clipRainCells(features, clips, district, upazila) {
  if (!upazila) return features;

  const match = clips?.rainUpazilas?.[placeKey(district, upazila)];

  if (
    !match ||
    !Array.isArray(features) ||
    clips.source_cell_count !== features.length
  ) {
    return [];
  }

  return features.flatMap((feature, index) => {
    const intersection = match[String(index)];

    if (!intersection) return [];

    return [{
      ...feature,
      geometry: intersection.geometry,
      properties: {
        ...feature.properties,
        overlapFraction: intersection.fraction
      }
    }];
  });
}
