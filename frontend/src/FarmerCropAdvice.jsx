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

// FR-19: advisory screening based on provided concern signals and farmer observations.
// Unknown river information does NOT become a low-risk classification.
export function getFarmerAdvice(crop, stage, field, concerns = []) {
  function unique(items) { return [...new Set(items.filter(Boolean))]; }
  function hasUsableRank(outlook) {
    return typeof outlook?.rank === "number" && Number.isFinite(outlook.rank) && outlook.rank >= 0;
  }
  const observations = Array.isArray(concerns) ? concerns : [];
  const usable = observations.filter(hasUsableRank);
  const ranks = usable.map(x => x.rank);
  const high = ranks.some(x => x >= 2);
  const watch = ranks.some(x => x >= 1);
  const riverMissing = observations.some(x => x?.riverAvailable === false || x?.riverStatus === "unavailable" || x?.riverStatus === "unknown" || x?.evidence?.river?.available === false);
  const periods = usable.filter(x => x.rank >= 1).map(x => Number(x.horizonHours)).filter(x => [24,48,72].includes(x));
  let message = !ranks.length ? "Flood information is not available right now. Check local warnings." :
    high ? "Flood concern is high. Prepare your farm supplies and follow local warnings." :
    watch ? "There are signs to watch. Prepare in case water rises." :
    "No strong flood signal was found in the available forecast. This is not a flood-safety clearance.";
  if (field === "river") message = "You reported rising river water or a warning. Follow local authorities and keep yourself safe.";
  else if (field === "wet") message = "You reported water standing in your field. Take care even if the forecast shows little rain.";

  const before = ["Check weather, upstream river warnings and field water levels from a safe location."];
  const during = ["Do not enter floodwater or cross submerged roads to protect farm equipment."];
  const after = ["When authorities say it is safe, inspect crops and farm infrastructure from stable ground."];
  if (field === "river") before.unshift("Do not enter rising water. Follow local warnings and move supplies only if it is safe.");
  else if (field === "wet") before.unshift("If safe, clear blocked drains from dry ground. Avoid walking into floodwater.");
  else if (field === "normal") before.unshift("Check field drains and nearby water levels from a safe place.");
  else before.unshift("Check your field and nearby water levels safely before deciding what to do.");

  if (crop === "fish") {
    before.push("Store fish feed in a dry, raised place.");
    before.push(field === "river" || high ? "Check pond edges from a safe place; use barriers only when conditions are safe." : "Inspect pond edges regularly for leaks and overflow.");
    during.push("Do not enter a flooded pond or attempt to repair its banks in moving water.");
    after.push("Check pond-bank damage and water quality; ask fisheries staff before restocking or changing treatment.");
  } else if (crop === "vegetables") {
    before.push(stage === "seedling" ? "Move portable seedling trays to a higher, sheltered place if water threatens." : "Keep harvested vegetables and supplies in a dry, raised place.");
    before.push(stage === "harvest" ? "Protect harvested vegetables from rain and standing water." : "Check raised beds and drainage; ask a local agriculture adviser before changing treatments.");
    during.push("Do not harvest vegetables from submerged beds while floodwater remains.");
    after.push("Separate visibly contaminated produce and ask an agriculture adviser about safe handling.");
  } else if (crop.startsWith("rice_")) {
    const name = crop === "rice_boro" ? "Boro" : crop === "rice_aman" ? "Aman" : "Aus";
    if (stage === "planning") before.push(`Before planting ${name} rice, check soil moisture and local advice. Do not plant into standing floodwater.`);
    else if (stage === "seedling") before.push(`Check ${name} rice seedlings and nursery beds. Move portable nursery supplies to higher ground if safe.`);
    else if (stage === "growing") before.push(`Check ${name} rice plants for standing water and blocked drains. Do not apply extra fertiliser while the field is flooded.`);
    else if (stage === "harvest") before.push(`Keep harvested ${name} rice dry. Ask a local agriculture officer before deciding to harvest standing crops early.`);
    else before.push(`Check your ${name} rice field; selecting its growth stage gives more useful advice.`);
    before.push("Keep spare seed, fertiliser and harvested grain on raised, dry storage.");
    during.push("Avoid fertilizer, pesticide and machinery use in submerged rice fields.");
    after.push("Check surviving rice plants and soil condition before replanting or applying fertilizer; seek local DAE advice.");
  } else {
    before.push("Store seed, animal feed and farm tools in a raised, dry place.");
    before.push("Ask local agriculture or livestock staff for advice suited to what you grow.");
    during.push("Move animals or supplies only along safe, dry routes and follow evacuation instructions.");
    after.push("Inspect feed and stored seed for water damage; get local advice before reusing contaminated supplies.");
  }
  if (high && field !== "river") before.push("If water rises or authorities issue a warning, prioritise safety over field work.");
  if (riverMissing || !ranks.length) before.push("River evidence is incomplete; check official river warnings even if local rainfall is low.");
  if (field === "wet") during.unshift("Standing water in your field takes priority over a low forecast; stop unsafe field work.");
  if (field === "river") during.unshift("A local river warning takes priority over this experimental forecast.");
  const prepare = unique(before).slice(0, 5);
  const duringFlood = unique(during).slice(0, 3);
  const recovery = unique(after).slice(0, 3);
  return {
    message, actions: prepare.slice(0, 4), prepare, duringFlood, recovery,
    evidence: !ranks.length ? "Forecast information incomplete" : riverMissing ? "River evidence incomplete — local rainfall alone cannot rule out flooding" : "Experimental forecast screening; follow official warnings",
    periodText: periods.length ? `Signals detected in: ${[...new Set(periods)].sort((a,b) => a-b).map(h => `${h}h`).join(", ")}` : "No elevated forecast signal identified in the available windows",
    urgent: field === "river" || field === "wet" || high
  };
}

// Presentation-only summaries. All crop/stage/field decisions stay in getFarmerAdvice.
function conciseAction(text) {
  const replacements = [
    [/Check your field and nearby water levels safely before deciding what to do\./, "Check field conditions and nearby water levels safely."],
    [/Check weather, upstream river warnings and field water levels from a safe location\./, "Check forecasts and nearby water levels."],
    [/When authorities say it is safe, inspect crops and farm infrastructure from stable ground\./, "When safe, inspect crops and farm structures."],
    [/Do not enter floodwater or cross submerged roads to protect farm equipment\./, "Never enter floodwater to save equipment."],
    [/Check field drains and nearby water levels from a safe place\./, "Check drainage and nearby water levels."],
    [/Check your (Boro|Aman|Aus) rice field; selecting its growth stage gives more useful advice\./, "Check crop condition; select a stage for tailored advice."],
    [/Keep spare seed, fertiliser and harvested grain on raised, dry storage\./, "Store seed, fertiliser and grain above water."],
    [/Check surviving rice plants and soil condition before replanting or applying fertilizer; seek local DAE advice\./, "Check surviving plants and soil before replanting."],
    [/Avoid fertilizer, pesticide and machinery use in submerged rice fields\./, "Pause fertiliser, pesticide and machinery use."],
    [/River evidence is incomplete; check official river warnings even if local rainfall is low\./, "Check local river updates."],
    [/Do not enter rising water\. Follow local warnings and move supplies only if it is safe\./, "Stay clear of rising water; move supplies only if safe."],
  ];
  let result = String(text || "");
  for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement);
  // Keep the first complete instruction when an exceptionally long instruction is present.
  if (result.length > 115 && result.includes(". ")) result = result.split(". ")[0] + ".";
  return result;
}

function visibleActions(items, phase) {
  const available = items || [];
  // First keep the immediate safety instruction, then crop-specific instructions.
  // Preparation normally includes a generic water-level check at index 1,
  // followed by the crop actions. Prefer those useful actions in a compact card.
  const chosen = phase === "prepare" && available.length >= 4
    ? [available[0], ...available.slice(2, 4)]
    : available.slice(0, 3);
  return chosen.map(conciseAction);
}

export default function FarmerCropAdvice({ concerns = [] }) {
  const [crop, setCrop] = useState("rice_aman");
  const [stage, setStage] = useState("unknown");
  const [field, setField] = useState("unknown");
  const advice = getFarmerAdvice(crop, stage, field, concerns);
  const isObserved = field === "wet" || field === "river";
  const lackData = concerns.length === 0 || concerns.some(x => x?.riverAvailable === false || x?.riverStatus === "unknown" || x?.riverStatus === "unavailable");
  const anyHigh = concerns.some(x => typeof x?.rank === "number" && x.rank >= 2);
  const anyWatch = concerns.some(x => typeof x?.rank === "number" && x.rank === 1);
  const heading = field === "river" ? "River rising — take precautions"
    : field === "wet" ? "Standing water reported"
    : anyHigh ? "Elevated flood concern"
    : anyWatch ? "Conditions to watch"
    : concerns.length === 0 ? "Forecast unavailable"
    : lackData ? "No strong signal in available data"
    : "No elevated signal detected";
  const statusDetail = isObserved ? "Your field report takes priority."
    : anyHigh || anyWatch ? advice.periodText
    : lackData ? "Some forecast evidence is incomplete."
    : "Continue routine field checks.";
  const cards = [
    { title: "Prepare now", items: visibleActions(advice.prepare, "prepare"), accent: "border-emerald-200", icon: "🌱", tint: "bg-emerald-50" },
    { title: "If water rises", items: visibleActions(advice.duringFlood, "during"), accent: "border-amber-200", icon: "💧", tint: "bg-amber-50" },
    { title: "After water recedes", items: visibleActions(advice.recovery, "recovery"), accent: "border-sky-200", icon: "🌤️", tint: "bg-sky-50" }
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 space-y-5" aria-label="Crop advice">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Protect your crops</h3>
        <p className="text-sm text-slate-500 mt-1">Choose your crop, growth stage and field condition.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-slate-800">What do you grow?
          <select className="mt-1 block w-full rounded-xl border border-slate-200 p-3 text-base bg-white" value={crop} onChange={e => setCrop(e.target.value)}>{CROPS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        </label>
        <label className="text-sm font-semibold text-slate-800">Crop stage
          <select className="mt-1 block w-full rounded-xl border border-slate-200 p-3 text-base bg-white" value={stage} onChange={e => setStage(e.target.value)}>{STAGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        </label>
        <label className="text-sm font-semibold text-slate-800">Field condition
          <select className="mt-1 block w-full rounded-xl border border-slate-200 p-3 text-base bg-white" value={field} onChange={e => setField(e.target.value)}>{FIELD.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        </label>
      </div>
      <div className={`rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${advice.urgent ? "bg-amber-50 text-amber-950 border border-amber-200" : lackData ? "bg-slate-50 text-slate-900 border border-slate-200" : "bg-emerald-50 text-emerald-950 border border-emerald-200"}`} role="status">
        <p className="font-semibold">{heading}</p>
        <p className="text-sm">{statusDetail}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map(card => (
          <div key={card.title} className={`rounded-xl border ${card.accent} bg-white p-4`}>
            <div className={`inline-flex items-center gap-2 rounded-lg ${card.tint} px-2 py-1 mb-3`}>
              <span aria-hidden="true">{card.icon}</span>
              <h4 className="font-semibold text-slate-900">{card.title}</h4>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-700">
              {card.items.map((item, i) => <li key={`${i}-${item}`} className="flex items-start gap-2"><span className="text-slate-400 mt-0.5" aria-hidden="true">•</span><span>{item}</span></li>)}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">For local crop-specific decisions, consult agriculture or fisheries staff.</p>
    </section>
  );
}
