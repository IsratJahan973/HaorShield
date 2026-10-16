import React from "react";
import { Waves } from "lucide-react";
import FloodRiskChecker from "./FloodRiskChecker.jsx";

// One public journey. Research pages remain in the repository but are not
// exposed to farmers as separate navigation destinations.
export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-sky-950 text-white px-4 py-4 md:px-8">
        <div className="mx-auto max-w-5xl flex gap-3 items-center">
          <Waves size={28} className="text-sky-300" aria-hidden="true" />
          <div><h1 className="font-bold text-2xl">HaorShield</h1>
          <p className="text-sm text-sky-100">Flood and rain updates for your area</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-5 md:px-6 md:py-8">
        <FloodRiskChecker />
      </main>
      <footer className="text-center text-xs text-slate-600 px-4 py-6">
        HaorShield shows early signs of possible flood concern, not a confirmed flood prediction. For urgent safety decisions follow official Bangladesh flood warnings.
      </footer>
    </div>
  );
}
