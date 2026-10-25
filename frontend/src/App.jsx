import React, { useState } from "react";
import HistoricalCalendarExplorer from "./HistoricalCalendarExplorer.jsx";
import { Waves } from "lucide-react";
import FloodRiskChecker from "./FloodRiskChecker.jsx";
import { LanguageProvider, useLanguage, LanguageSwitcher } from "./LanguageContext.jsx";
import ChatWidget from "./ChatWidget.jsx";

function MainApp() {
  const [mode, setMode] = useState("live");
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-sky-950 text-white px-4 py-4 md:px-8">
        <div className="mx-auto max-w-5xl flex gap-3 items-center justify-between">
          <div className="flex gap-3 items-center min-w-0">
            <Waves size={28} className="text-sky-300 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="font-bold text-2xl tracking-tight">HaorShield</h1>
              <p className="text-sm text-sky-100">{t("app.tagline", "Flood and rain updates for your area")}</p>
            </div>
          </div>
          <div className="shrink-0 pl-2">
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-5 md:px-6 md:py-8">
        <nav className="grid grid-cols-2 gap-2 mb-5" aria-label="Choose forecast or history">
          <button
            onClick={() => setMode("live")}
            className={`min-w-0 rounded-xl px-2 sm:px-4 py-3 text-sm font-semibold transition-colors ${
              mode === "live" ? "bg-sky-900 text-white" : "bg-white border text-slate-800 hover:bg-slate-100"
            }`}
          >
            {t("nav.live", "Live forecast")}
          </button>
          <button
            onClick={() => setMode("history")}
            className={`min-w-0 rounded-xl px-2 sm:px-4 py-3 text-sm font-semibold transition-colors ${
              mode === "history" ? "bg-sky-900 text-white" : "bg-white border text-slate-800 hover:bg-slate-100"
            }`}
          >
            {t("nav.history", "Historical explorer")}
          </button>
        </nav>
        {mode === "live" ? <FloodRiskChecker /> : <HistoricalCalendarExplorer />}
      </main>
      <footer className="text-center text-xs text-slate-600 px-4 pt-6 pb-24 max-w-3xl mx-auto leading-relaxed">
        {t("footer.disclaimer", "HaorShield shows early signs of possible flood concern, not a confirmed flood prediction. For urgent safety decisions follow official Bangladesh flood warnings.")}
      </footer>
      <ChatWidget />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}
