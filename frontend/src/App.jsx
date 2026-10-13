import ExperimentalFloodForecast from "./ExperimentalFloodForecast.jsx";
import FloodRiskChecker from "./FloodRiskChecker.jsx";
import RainfallRiskMap from "./RainfallRiskMap.jsx";
import FloodExposureMap from "./FloodExposureMap.jsx";
import LiveWeather from "./LiveWeather.jsx";
import Classification from "./Classification.jsx";
import FloodMap from "./FloodMap.jsx";
import React, { useEffect, useState } from "react";
import {
  CloudSun,
  CloudRain,
  LayoutDashboard,
  Map,
  Sprout,
  BrainCircuit,
  Waves,
  ShieldCheck,
  Menu,
  X
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

const NAV = [
  { id: "checker", label: "Check My Risk", icon: ShieldCheck },
  { id: "rainfall-risk", label: "Rainfall Risk Map", icon: CloudRain },
  { id: "flood-exposure", label: "Flood Exposure", icon: Map },
  { id: "weather", label: "Live Weather", icon: CloudSun },
  { id: "model", label: "Classification", icon: BrainCircuit }
];

const formatHa = (value) =>
  Math.round(Number(value)).toLocaleString("en-US");

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <p className="text-sm text-slate-500">{title}</p>
      <h3 className="text-3xl font-bold mt-2 text-slate-900">
        {value}
      </h3>
      <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("checker");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/data/haorshield_dashboard_data.json")
      .then((res) => {
        if (!res.ok) throw new Error("Dashboard data unavailable");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const events = data?.event_summary || [];
  const districts = data?.district_event_exposure || [];

  const chartData = events.map((event) => ({
    event: data?.event_labels?.[String(event.event_id)] ||
      String(event.event_id),
    flooded: Math.round(event.flooded_cropland_ha)
  }));

  const sidebar = (
    <>
      <div className="px-6 py-8 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/20 p-3 rounded-xl">
            <Waves className="text-cyan-300" size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">HaorShield</h1>
            <p className="text-xs text-slate-400">
              Flood Intelligence Platform
            </p>
          </div>
        </div>
      </div>

      <nav className="p-4 space-y-2">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setPage(id);
              setMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3
              rounded-xl text-sm transition ${
                page === id
                  ? "bg-cyan-600 text-white"
                  : "text-slate-300 hover:bg-white/10"
              }`}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-6 mt-8 text-xs text-slate-400">
        Flood and rainfall research
        <br />
        Northeastern Bangladesh
      </div>
    </>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden lg:block w-64 bg-navy min-h-screen shrink-0">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <aside className="w-64 bg-navy overflow-y-auto">
            {sidebar}
          </aside>
          <button
            className="flex-1 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
        </div>
      )}

      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 px-5 lg:px-9 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={23} />
            </button>
            <div>
              <h2 className="font-bold text-xl text-slate-900">
                {NAV.find((item) => item.id === page)?.label}
              </h2>
              <p className="text-xs text-slate-500">
                Live weather and flood intelligence for northeastern Bangladesh
              </p>
            </div>
          </div>
          <ShieldCheck className="text-cyan-700" />
        </header>

        <div className="p-5 lg:p-9 max-w-7xl mx-auto">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl">
              {error}
            </div>
          )}

          {!data && !error && <p>Loading dashboard data...</p>}

          {page === "checker" && (
            <>
<FloodRiskChecker
              onOpenMap={() => setPage("rainfall-risk")}
            />
<ExperimentalFloodForecast />
</>
          )}
          {page === "weather" && <LiveWeather />}
          {page === "rainfall-risk" && <RainfallRiskMap />}
          {page === "flood-exposure" && <FloodExposureMap />}

          {data && page === "overview" && (
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-bold">
                  Historical Flood Overview
                </h2>
                <p className="text-slate-500 mt-2">
                  MODIS-detected flood extent and mapped cropland
                  exposure across seven districts.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
                <StatCard
                  title="Districts Covered"
                  value="7"
                  subtitle="Northeastern Bangladesh"
                />
                <StatCard
                  title="Historical Events"
                  value="3"
                  subtitle="2016–2017"
                />
                <StatCard
                  title="Mapped Cropland"
                  value="1,211,011 ha"
                  subtitle="ESA WorldCover 2021"
                />
                <StatCard
                  title="District–Event Records"
                  value={districts.length}
                  subtitle="Agricultural exposure estimates"
                />
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-6 mt-7 shadow-sm">
                <h3 className="text-lg font-semibold mb-1">
                  Estimated Flooded Cropland by Event
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Hectares of mapped 2021 cropland overlapping
                  historical MODIS flood detections.
                </p>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="event" fontSize={12} />
                      <YAxis tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip
                        formatter={(v) => [
                          `${formatHa(v)} ha`,
                          "Flooded cropland"
                        ]}
                      />
                      <Bar
                        dataKey="flooded"
                        fill="#0891b2"
                        radius={[7, 7, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {data && page === "map" && (
            <FloodMap dashboardData={data} />
          )}

          {data && page === "agriculture" && (
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <h2 className="text-xl font-bold mb-5">
                District Agricultural Exposure
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-3">Event</th>
                      <th className="p-3">District</th>
                      <th className="p-3">Flooded ha</th>
                      <th className="p-3">Exposure %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {districts.map((row) => (
                      <tr
                        key={`${row.event_id}-${row.district}`}
                        className="border-b border-slate-100"
                      >
                        <td className="p-3">
                          {data.event_labels[String(row.event_id)]}
                        </td>
                        <td className="p-3">{row.district}</td>
                        <td className="p-3">
                          {formatHa(row.flooded_cropland_ha)}
                        </td>
                        <td className="p-3">
                          {Number(
                            row.flooded_pct_total_cropland
                          ).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data && page === "model" && (
            <Classification />
          )}

          <p className="text-xs text-slate-400 mt-8">
            HaorShield provides retrospective MODIS flood-detection
            classifications and estimated agricultural exposure.
            It does not forecast future floods or verify crop damage.
          </p>
        </div>
      </main>
    </div>
  );
}
