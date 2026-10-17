import React from "react";

// FR-13/14: Explain existing screening evidence without recalculating risk.
// Important: never describe missing evidence as a low or safe forecast.
export default function OutlookEvidence({ outlook }) {
  const factors = Array.isArray(outlook?.factors)
    ? outlook.factors.filter(x => typeof x === "string" && x.trim()) : [];
  const rain = outlook?.rainfallAvailable === true;
  const river = outlook?.riverAvailable === true;
  const complete = rain && river;
  const riverVerified = outlook?.riverIdentityVerified === true;
  const quality = !complete ? "Limited data" : riverVerified ? "Both signals available" : "Regional river match unverified";

  return (
    <details className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-700">
      <summary className="cursor-pointer font-semibold text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
        Why this outlook? · Data confidence
      </summary>
      <div className="mt-2 space-y-2">
        <p className="font-medium">Evidence: {quality}</p>
        <ul className="list-disc space-y-1 pl-5">
          {factors.map((factor, i) => <li key={i}>{factor}</li>)}
          {factors.length === 0 && <li>Supporting evidence details are unavailable.</li>}
        </ul>
        {!rain && <p>Rainfall evidence is incomplete.</p>}
        {!river && <p>Comparable river-flow evidence is unavailable or date-misaligned.</p>}
        {river && !riverVerified && <p>Nearby modeled river flow has not been verified as the river affecting this location.</p>}
        <p className="text-xs text-slate-600">
          Experimental concern categories and the 0–100 screening index are not measured flood probabilities.
          Local flooding, upstream flow and field-level inundation may not be captured.
        </p>
      </div>
    </details>
  );
}
