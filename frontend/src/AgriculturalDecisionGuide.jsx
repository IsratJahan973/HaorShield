import React, { useEffect, useMemo, useState } from "react";

const GEO_URL =
  "/data/haorshield_cropland_rainfall_screening.geojson";

const SUMMARY_URL =
  "/data/haorshield_cropland_rainfall_screening_summary.json";

const HORIZONS = [24, 48, 72];

const formatNumber = (value) =>
  Number(value).toLocaleString("en-BD", {
    maximumFractionDigits: 0
  });

const formatTime = (value) => {
  const date = new Date(value || "");

  if (!Number.isFinite(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleString("en-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export default function AgriculturalDecisionGuide() {

  const [geo, setGeo] = useState(null);
  const [summary, setSummary] = useState(null);
  const [district, setDistrict] = useState("All Districts");
  const [hours, setHours] = useState(24);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const [geoResponse, summaryResponse] =
          await Promise.all([
            fetch(GEO_URL, {
              cache: "no-store",
              signal: controller.signal
            }),
            fetch(SUMMARY_URL, {
              cache: "no-store",
              signal: controller.signal
            })
          ]);

        if (!geoResponse.ok || !summaryResponse.ok) {
          throw new Error(
            "Agricultural screening data is unavailable."
          );
        }

        const [geoData, summaryData] =
          await Promise.all([
            geoResponse.json(),
            summaryResponse.json()
          ]);

        if (
          geoData.type !== "FeatureCollection" ||
          geoData.features?.length !== 306 ||
          summaryData.cells !== 306 ||
          summaryData.is_flood_inundation_prediction !== false ||
          summaryData.predicted_flooded_cropland_ha !== null
        ) {
          throw new Error(
            "Agricultural screening data failed validation."
          );
        }

        const timestamp =
          geoData.metadata?.generated_at;

        if (
          !timestamp ||
          timestamp !== summaryData.generated_at
        ) {
          throw new Error(
            "Agricultural map and summary are out of sync."
          );
        }

        for (const feature of geoData.features) {
          const p = feature.properties || {};

          if (
            !Number.isFinite(p.mapped_cropland_ha) ||
            p.mapped_cropland_ha < 0
          ) {
            throw new Error(
              "Invalid mapped cropland area."
            );
          }

          for (const h of HORIZONS) {
            if (
              typeof p[`elevated_rainfall_${h}h`] !==
                "boolean" ||
              !Number.isFinite(p[`rain${h}_mm`])
            ) {
              throw new Error(
                "Invalid rainfall-screening attributes."
              );
            }
          }
        }

        setGeo(geoData);
        setSummary(summaryData);
        setError("");

      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            err.message || "Unable to load agricultural data."
          );
          setGeo(null);
          setSummary(null);
        }

      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, []);

  const districtNames = useMemo(() => {
    if (!geo) return [];

    return [...new Set(
      geo.features.map(
        (feature) => feature.properties.district
      )
    )].sort();
  }, [geo]);

  const statistics = useMemo(() => {
    if (!geo) return null;

    const rows = geo.features.filter(
      (feature) =>
        district === "All Districts" ||
        feature.properties.district === district
    );

    let mappedCrop = 0;
    let screenedCrop = 0;
    let flaggedCells = 0;
    let highestCellRain = 0;

    for (const feature of rows) {
      const p = feature.properties;
      const crop = Number(p.mapped_cropland_ha);
      const rain = Number(p[`rain${hours}_mm`]);
      const elevated = p[`elevated_rainfall_${hours}h`];

      mappedCrop += crop;
      highestCellRain = Math.max(
        highestCellRain, rain
      );

      if (elevated) {
        flaggedCells += 1;
        screenedCrop += crop;
      }
    }

    return {
      cells: rows.length,
      mappedCrop,
      screenedCrop,
      flaggedCells,
      highestCellRain
    };
  }, [geo, district, hours]);

  const issued = summary
    ? new Date(summary.generated_at)
    : null;

  const ageHours = issued &&
    Number.isFinite(issued.getTime())
      ? (Date.now() - issued.getTime()) / 3600000
      : Infinity;

  const stale = ageHours < -1 || ageHours > 12;

  const observationsAvailable =
    Boolean(geo && summary && statistics);

  const elevated = observationsAvailable &&
    statistics.flaggedCells > 0;

  return (
    <section className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-900">
          Agricultural Decision Guidance
        </h2>

        <p className="text-sm leading-6 text-slate-600">
          District-level agricultural planning based on
          mapped cropland and experimental rainfall screening.
          This is not an independently validated flood forecast
          or a crop-loss prediction.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-slate-600">
          Loading agricultural screening data...
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {observationsAvailable && (
        <>
          <div className="grid gap-4 md:grid-cols-2">

            <label className="space-y-1 text-sm font-medium text-slate-700">
              District
              <select
                value={district}
                onChange={(event) =>
                  setDistrict(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white p-3"
              >
                <option value="All Districts">
                  All Districts
                </option>

                {districtNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Rainfall screening window
              <select
                value={hours}
                onChange={(event) =>
                  setHours(Number(event.target.value))
                }
                className="w-full rounded-lg border border-slate-300 bg-white p-3"
              >
                {HORIZONS.map((h) => (
                  <option key={h} value={h}>
                    {h} hours
                  </option>
                ))}
              </select>
            </label>
          </div>

          {stale && (
            <div
              role="status"
              className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
            >
              <strong>Outdated screening data.</strong>{" "}
              These results may no longer reflect current
              rainfall conditions. Do not use them alone for
              time-sensitive agricultural decisions.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {[
              [
                "Geographic cells",
                formatNumber(statistics.cells)
              ],
              [
                "Mapped cropland",
                `${formatNumber(statistics.mappedCrop)} ha`
              ],
              [
                "Cells meeting rainfall-screening rule",
                formatNumber(statistics.flaggedCells)
              ],
              [
                "Cropland inside screened cells",
                `${formatNumber(statistics.screenedCrop)} ha`
              ]
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="text-xs text-slate-600">
                  {label}
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">
              Agricultural planning considerations
            </h3>

            {stale ? (
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Because the screening is outdated, no current
                district-level risk conclusion can be drawn.
                Consult the latest official flood bulletin,
                check local drainage and field conditions,
                and follow agricultural extension guidance.
              </p>
            ) : elevated ? (
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Some cells meet the experimental elevated-rainfall
                screening rule. Check official flood and weather
                warnings, inspect drainage where safe, and consider
                protecting harvested produce, seeds and agricultural
                equipment from potential water exposure.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-slate-700">
                No elevated-rainfall signal appears in the
                available screening for this selection.
                This does not establish flood safety:
                upstream rainfall and river conditions can
                still create flooding. Continue checking
                official warnings and local conditions.
              </p>
            )}

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Maximum cell rainfall shown in this selection:
              {" "}
              {statistics.highestCellRain.toFixed(1)} mm
              over the selected window. This value is
              informational and is not a flood probability.
            </p>
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <p>
              Source screening issued:{" "}
              <strong>{formatTime(summary.generated_at)}</strong>
            </p>

            <p>
              Mapped cropland is a land-cover baseline.
              Cropland within flagged cells is not necessarily
              inundated, damaged or exposed to confirmed flooding.
            </p>

            <p>
              For operational river and flood warnings, visit{" "}
              <a
                href="https://ffwc.gov.bd/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 underline"
              >
                Bangladesh FFWC
              </a>.
            </p>

            <p className="font-medium text-slate-800">
              Verified future flooded cropland:
              Not available.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
