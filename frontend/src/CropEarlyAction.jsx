import React, { useMemo, useState } from "react";

const CROPS = [
  { id: "rice_boro", en: "Boro rice" },
  { id: "rice_aman", en: "Aman rice" },
  { id: "rice_aus", en: "Aus rice" },
  { id: "vegetables", en: "Vegetables" },
  { id: "other", en: "Other / not sure" }
];

const STAGES = [
  { id: "unknown", en: "Not sure yet" },
  { id: "planning", en: "Planning / sowing" },
  { id: "seedling", en: "Seedling / transplanting" },
  { id: "growing", en: "Growing crop" },
  { id: "harvest", en: "Harvest-ready / harvested" }
];

const CONDITIONS = [
  { id: "unknown", en: "Not checked" },
  { id: "normal", en: "Field currently draining normally" },
  { id: "wet", en: "Waterlogged / drainage blocked" },
  { id: "river", en: "River rising / official warning received" }
];

const MESSAGES = {
    title: "What can I do for my crops?",
    summary: "Choose what is actually growing in your field. This guidance uses the selected location, date and rainfall; it does not predict crop losses.",
    crop: "Crop", stage: "Crop stage", condition: "What do you notice in your field?",
    issued: "Forecast rainfall for the selected date", window: "forecast hours",
    monitoring: "Keep checking official FFWC/BMD warnings and nearby river or drainage conditions. Low local rainfall does not rule out upstream flooding.",
    wet: "Waterlogging or blocked drainage is reported. Where safe, inspect field drainage and consult local agricultural extension staff; do not enter floodwater.",
    river: "River rise or an official warning is reported. Prioritize official instructions and your safety over field work.",
    heavy: "Rainfall screening is elevated for the selected forecast hours. Secure movable farm supplies and plan around possible access disruptions where safe.",
    low: "No elevated local rainfall signal is shown, but this is not a flood-safety clearance.",
    unknown: "Choose the actual crop stage for more specific advice. If unsure, monitor official warnings and local field conditions.",
    planting: "Before sowing or transplanting, check soil conditions and local extension advice; avoid assuming a safe planting window from rainfall data alone.",
    seedling: "Check seedlings or nursery beds from a safe location. Ask local extension staff about protection or relocation if flood warnings are issued.",
    growing: "Monitor drainage and visible crop conditions. Avoid applying additional inputs based on this experimental forecast alone.",
    harvest: "Keep harvested produce, seed and equipment in dry, safe storage. For crops still standing, discuss any harvesting decision with local extension staff.",
    vegetable: "Vegetable plots can be sensitive to standing water; inspect drainage safely and protect already harvested produce.",
    rice: "Rice varieties and growth stages respond differently to water. Consult a local extension officer before changing irrigation, planting or harvest plans.",
    seasonal: "Seasonal note", seasonalExplanation: "The month below is context only. Crop calendars and planting dates vary by locality and year; your chosen crop/stage takes priority.",
    stale: "The forecast or screening information may be outdated. Seek an updated official forecast before taking time-sensitive action.",
    caveat: "This is general preparedness information, not a verified flood probability, field-level inundation forecast, crop-loss estimate or official instruction.",
    official: "Bangladesh FFWC — official flood information",
    bmd: "Bangladesh Meteorological Department"
  }
};

export default function CropEarlyAction({ district, date, rainfallMm, forecastHours, isOutdated = false }) {
  const [crop, setCrop] = useState("other");
  const [stage, setStage] = useState("unknown");
  const [condition, setCondition] = useState("unknown");
  const t = MESSAGES;
  const intensity24h = forecastHours > 0 ? rainfallMm * 24 / forecastHours : 0;
  const month = Number((date || "").slice(5, 7));
  const season = useMemo(() => {
    if ([3, 4, 5].includes(month)) return "Mar–May: Boro harvesting occurs in some areas";
    if ([6, 7, 8].includes(month)) return "Jun–Aug: monsoon; Aus/Aman timing varies";
    if ([9, 10, 11].includes(month)) return "Sep–Nov: Aman growth/harvest timing varies";
    return "Dec–Feb: Boro preparation/transplanting varies";
  }, [month]);

  const advice = [
    t.monitoring,
    condition === "river" ? t.river : condition === "wet" ? t.wet : intensity24h >= 50 ? t.heavy : t.low,
    t[stage],
    crop === "vegetables" ? t.vegetable : crop.startsWith("rice_") ? t.rice : null
  ].filter(Boolean);

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 sm:p-6 space-y-4" aria-label="Crop-aware early action">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{t.title}</h3>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">{t.summary}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">{t.crop}
          <select aria-label="Crop" value={crop} onChange={e => setCrop(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-3">
            {CROPS.map(x => <option key={x.id} value={x.id}>{x.en}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">{t.stage}
          <select aria-label="Growth stage" value={stage} onChange={e => setStage(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-3">
            {STAGES.map(x => <option key={x.id} value={x.id}>{x.en}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">{t.condition}
          <select aria-label="Observed field condition" value={condition} onChange={e => setCondition(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-3">
            {CONDITIONS.map(x => <option key={x.id} value={x.id}>{x.en}</option>)}
          </select>
        </label>
      </div>
      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="font-semibold">{district} · {date} · {Number(rainfallMm).toFixed(1)} mm / {forecastHours} {t.window}</p>
        <p className="mt-1">{t.seasonal}: {season}. {t.seasonalExplanation}</p>
      </div>
      {isOutdated && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t.stale}</p>}
      <ul className="list-disc space-y-2 pl-5 text-sm text-slate-800">
        {advice.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
      <p className="text-xs leading-5 text-amber-900">{t.caveat}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <a href="https://ffwc.gov.bd/" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{t.official}</a>
        <a href="https://bmd.gov.bd/" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{t.bmd}</a>
      </p>
    </section>
  );
}
