import React, { useState } from "react";

// Practical preparedness, not crop-loss or flood-depth predictions.
export function getFarmerAdvice(crop, concerns = []) {
  const elevated = concerns.some(c => Number.isFinite(c?.rank) && c.rank >= 2);
  const watch = elevated || concerns.some(c => c?.rank === 1);
  const anyValid = concerns.some(c => Number.isFinite(c?.rank) && c.rank >= 0);
  const shared = !anyValid
    ? "The flood outlook is unavailable. Check local river conditions and official warnings."
    : elevated
      ? "Flood warning signs are elevated. Prepare now and follow official local instructions."
      : watch
        ? "Watch rain and river conditions. Be ready if water starts to rise."
        : "No strong warning sign was found. Keep checking nearby water levels.";
  const byCrop = {
    rice: ["Check field drains and water channels if it is safe.", "Keep spare seed and fertiliser in a dry, raised place.", "Ask your local agriculture officer before changing planting or harvest plans."],
    vegetables: ["Keep drains around vegetable beds clear if safe.", "Move seedlings and stored supplies to a higher dry place when needed.", "Check crops after rain and ask for local advice before treatment."],
    fish: ["Check pond banks from a safe place.", "Keep fish feed in a dry, raised place.", "Prepare screens or nets if authorities warn that water may overflow."],
    other: ["Keep seeds, animal feed and tools above possible water levels.", "Check drains and nearby river levels from a safe place.", "Follow local agriculture and flood-warning advice."]
  };
  return { message: shared, actions: byCrop[crop] || byCrop.other };
}

export default function FarmerCropAdvice({ concerns = [] }) {
  const [crop, setCrop] = useState("rice");
  const { message, actions } = getFarmerAdvice(crop, concerns);
  return <section className="rounded-2xl border border-emerald-200 bg-white p-5 md:p-6 space-y-3" aria-label="Crop advice">
    <h3 className="text-xl font-bold">Protect your crops</h3>
    <label className="block text-sm font-semibold" htmlFor="farmer-crop">What do you grow?</label>
    <select id="farmer-crop" className="w-full rounded-xl border p-3 text-base" value={crop} onChange={e=>setCrop(e.target.value)}>
      <option value="rice">Rice / paddy</option>
      <option value="vegetables">Vegetables</option>
      <option value="fish">Fish pond</option>
      <option value="other">Other crops / livestock</option>
    </select>
    <p className="rounded-lg bg-emerald-50 p-3 font-medium">{message}</p>
    <ul className="list-disc space-y-2 pl-5 text-base">{actions.map(item=><li key={item}>{item}</li>)}</ul>
    <p className="text-xs text-slate-600">For urgent flood warnings, follow local authorities. These are general preparation tips.</p>
  </section>;
}
