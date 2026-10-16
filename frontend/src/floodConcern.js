/**
 * Rainfall-triggered flood CONCERN screening, not flood occurrence prediction.
 * Rainfall is an incomplete driver of riverine flooding; these project-specific
 * bands have not been fitted/calibrated on observed flood outcomes.
 */
export function floodConcernOutlooks(rollingOutlooks) {
  if (!Array.isArray(rollingOutlooks)) return [];
  return rollingOutlooks.map(w => {
    const h = Number(w.horizonHours);
    const total = w.rainfallMm == null ? NaN : Number(w.rainfallMm);
    const rate = w.rainfallPer24h == null ? NaN : Number(w.rainfallPer24h);
    // Reject contradictory upstream data instead of accepting whichever signal is higher.
    const expectedRate = total * 24 / h;
    const consistent = Number.isFinite(expectedRate) && Number.isFinite(rate) &&
      Math.abs(rate - expectedRate) <= Math.max(0.01, expectedRate * 0.001);
    if (![24,48,72].includes(h) || !w.complete || !Number.isFinite(total) || !Number.isFinite(rate) || total < 0 || rate < 0 || !consistent) {
      return { horizonHours: h, level: 'Unavailable', detail: 'Complete rainfall forecast unavailable', className: 'text-slate-700', usable: false };
    }
    // Cumulative totals capture persistent multi-day rainfall; rates capture bursts.
    // Nonvalidated screening thresholds, deliberately not framed as flood probabilities.
    const high = rate >= 100 || total >= (h / 24) * 100;
    const elevated = rate >= 50 || total >= (h / 24) * 50;
    const watch = rate >= 10 || total >= (h / 24) * 10;
    if (high) return { horizonHours: h, level: 'High rainfall concern', detail: 'Very heavy forecast rain could increase waterlogging and local flood concern', className: 'text-red-700', usable: true };
    if (elevated) return { horizonHours: h, level: 'Elevated rainfall concern', detail: 'Heavy forecast rain; monitor local drainage and official river bulletins', className: 'text-orange-700', usable: true };
    if (watch) return { horizonHours: h, level: 'Rainfall watch', detail: 'Rain could contribute to local waterlogging', className: 'text-amber-800', usable: true };
    return { horizonHours: h, level: 'Low local rainfall signal', detail: 'Upstream river flooding remains possible even with little local rain', className: 'text-sky-800', usable: true };
  });
}
