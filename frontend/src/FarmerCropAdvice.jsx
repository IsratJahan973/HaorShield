import React, { useState } from "react";

const CROPS = [
  ["rice_boro", "Boro rice"], ["rice_aman", "Aman rice"], ["rice_aus", "Aus rice"],
  ["vegetables", "Vegetables"], ["fish", "Fish pond"], ["other", "Other crops / livestock"]
];
const STAGES = [
  ["unknown", "Not sure"], ["planning", "Preparing / planting"],
  ["seedling", "Young plants"], ["growing", "Growing"], ["harvest", "Ready to harvest / harvested"]
];
const FIELD = [
  ["unknown", "Not checked"], ["normal", "Field is dry / draining well"],
  ["wet", "Water is standing in my field"], ["river", "River is rising / warning received"]
];

export function getFarmerAdvice(crop, stage, field, concerns = []) {
  const ranks = concerns.map(x => x?.rank).filter(x => typeof x === "number" && Number.isFinite(x) && x >= 0);
  const high = ranks.some(x => x >= 2);
  const watch = ranks.some(x => x >= 1);
  let message = !ranks.length ? "Flood information is not available right now. Check local warnings." :
    high ? "Flood concern is high. Prepare your farm supplies and follow local warnings." :
    watch ? "There are signs to watch. Prepare in case water rises." :
    "No strong flood signal was found. Continue checking river and weather updates.";
  if (field === "river") message = "You reported rising river water or a warning. Follow local authorities and keep yourself safe.";
  else if (field === "wet") message = "You reported water standing in your field. Take care even if the forecast shows little rain.";

  const tasks = [];
  if (field === "river") tasks.push("Do not enter rising water. Follow local warnings and move supplies only if it is safe.");
  else if (field === "wet") tasks.push("If safe, clear blocked drains from dry ground. Avoid walking into floodwater.");
  else if (field === "normal") tasks.push("Check field drains and nearby water levels from a safe place.");
  else tasks.push("Check your field and nearby water levels safely before deciding what to do.");

  if (crop === "fish") {
    tasks.push("Store fish feed in a dry, raised place.");
    tasks.push(field === "river" || high ? "Check pond edges from a safe place; use barriers only when conditions are safe." : "Inspect pond edges regularly for leaks and overflow.");
  } else if (crop === "vegetables") {
    tasks.push(stage === "seedling" ? "Move portable seedling trays to a higher, sheltered place if water threatens." : "Keep harvested vegetables and supplies in a dry, raised place.");
    tasks.push(stage === "harvest" ? "Protect harvested vegetables from rain and standing water." : "Check beds and drainage; ask a local agriculture adviser before changing treatments.");
  } else if (crop.startsWith("rice_")) {
    const name = crop === "rice_boro" ? "Boro" : crop === "rice_aman" ? "Aman" : "Aus";
    if (stage === "planning") tasks.push(`Before planting ${name} rice, check soil moisture and local advice. Do not plant into standing floodwater.`);
    else if (stage === "seedling") tasks.push(`Check ${name} rice seedlings and nursery beds. Move portable nursery supplies to higher ground if safe.`);
    else if (stage === "growing") tasks.push(`Check ${name} rice plants for standing water and blocked drains. Do not apply extra fertiliser while the field is flooded.`);
    else if (stage === "harvest") tasks.push(`Keep harvested ${name} rice dry. Ask a local agriculture officer before deciding to harvest standing crops early.`);
    else tasks.push(`Check your ${name} rice field; selecting its growth stage gives more useful advice.`);
    tasks.push("Keep spare seed, fertiliser and harvested grain on raised, dry storage.");
  } else {
    tasks.push("Store seed, animal feed and farm tools in a raised, dry place.");
    tasks.push("Ask local agriculture or livestock staff for advice suited to what you grow.");
  }
  if (high && field !== "river") tasks.push("If water rises or authorities issue a warning, prioritise safety over field work.");
  return { message, actions: tasks.slice(0, 4) };
}

export default function FarmerCropAdvice({ concerns = [] }) {
  const [crop, setCrop] = useState("rice_aman");
  const [stage, setStage] = useState("unknown");
  const [field, setField] = useState("unknown");
  const { message, actions } = getFarmerAdvice(crop, stage, field, concerns);
  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 md:p-6 space-y-4" aria-label="Crop advice">
      <div><h3 className="text-xl font-bold text-slate-900">Protect your crops</h3><p className="text-sm text-slate-600 mt-1">Tell us what you grow and what you see in your field.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">What do you grow?
          <select className="mt-1 block w-full rounded-xl border p-3 text-base bg-white" value={crop} onChange={e => setCrop(e.target.value)}>{CROPS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        </label>
        <label className="text-sm font-semibold">Crop stage
          <select className="mt-1 block w-full rounded-xl border p-3 text-base bg-white" value={stage} onChange={e => setStage(e.target.value)}>{STAGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        </label>
        <label className="text-sm font-semibold">What is happening in your field?
          <select className="mt-1 block w-full rounded-xl border p-3 text-base bg-white" value={field} onChange={e => setField(e.target.value)}>{FIELD.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        </label>
      </div>
      <p className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-950" role="status">{message}</p>
      <div><h4 className="font-semibold mb-2">What to do now</h4><ol className="list-decimal pl-6 space-y-2 text-slate-800">{actions.map((a, i) => <li key={i}>{a}</li>)}</ol></div>
      <p className="text-xs text-slate-600">These are preparation tips, not a prediction of crop damage. For urgent warnings, follow local authorities.</p>
    </section>
  );
}
