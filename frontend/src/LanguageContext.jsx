import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import {
  DICTIONARY,
  DISTRICTS_BN,
  UPAZILAS_BN,
  CROP_ACTIONS_BN,
  WEATHER_CONDITIONS_BN,
  CONCERN_LEVELS_BN,
  toBengaliNumerals
} from "./translations.js";

const LanguageContext = createContext(null);

export { toBengaliNumerals };

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem("haorshield_language");
      return saved === "bn" ? "bn" : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("haorshield_language", language);
    } catch {
      // Ignore storage restrictions
    }
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = language;
    }
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => (prev === "en" ? "bn" : "en"));
  };

  const t = useMemo(() => {
    return (key, paramsOrFallback = {}, maybeParams = {}) => {
      let text;
      let params = {};

      if (typeof paramsOrFallback === "string") {
        text = DICTIONARY[language]?.[key] || DICTIONARY.en?.[key] || paramsOrFallback || key;
        params = maybeParams || {};
      } else {
        text = DICTIONARY[language]?.[key] || DICTIONARY.en?.[key] || key;
        params = paramsOrFallback || {};
      }

      // Variable interpolation {varName}
      if (text && typeof text === "string" && params && typeof params === "object") {
        Object.entries(params).forEach(([pKey, pVal]) => {
          let formattedVal = pVal;
          if (language === "bn" && typeof pVal === "number") {
            formattedVal = toBengaliNumerals(pVal);
          }
          text = text.replace(new RegExp(`\\{${pKey}\\}`, "g"), formattedVal ?? "");
        });
      }

      return text;
    };
  }, [language]);

  const tDistrict = (name) => {
    if (!name) return "";
    if (language === "bn") {
      return DISTRICTS_BN[name] || name;
    }
    return name;
  };

  const tUpazila = (name) => {
    if (!name) return "";
    if (language === "bn") {
      return UPAZILAS_BN[name] || name;
    }
    return name;
  };

  const tAction = (actionText) => {
    if (!actionText) return "";
    if (language === "bn") {
      return CROP_ACTIONS_BN[actionText] || actionText;
    }
    return actionText;
  };

  const tWeather = (desc) => {
    if (!desc) return "";
    if (language === "bn") {
      return WEATHER_CONDITIONS_BN[desc] || desc;
    }
    return desc;
  };

  const tRisk = (level) => {
    if (!level) return "";
    if (language === "bn") {
      return CONCERN_LEVELS_BN[level] || level;
    }
    return level;
  };

  const formatNumber = (num, maximumFractionDigits = 1) => {
    if (num === null || num === undefined || Number.isNaN(Number(num))) return "—";
    const n = Number(num);
    const formatted = n.toLocaleString("en-US", { maximumFractionDigits });
    return language === "bn" ? toBengaliNumerals(formatted) : formatted;
  };

  const formatInteger = (num) => {
    if (num === null || num === undefined || Number.isNaN(Number(num))) return "—";
    const n = Math.round(Number(num));
    const formatted = n.toLocaleString("en-US");
    return language === "bn" ? toBengaliNumerals(formatted) : formatted;
  };

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t,
    tDistrict,
    tUpazila,
    tAction,
    tWeather,
    tRisk,
    formatNumber,
    formatInteger
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language selection"
      className="inline-flex items-center rounded-xl bg-sky-900/80 p-1 border border-sky-700/60 shadow-sm"
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        aria-label="Switch to English"
        className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 ${
          language === "en"
            ? "bg-white text-sky-950 shadow-sm"
            : "text-sky-200 hover:text-white hover:bg-sky-800/60"
        }`}
      >
        EN
      </button>
      <span className="text-sky-400/60 px-0.5 select-none" aria-hidden="true">
        |
      </span>
      <button
        type="button"
        onClick={() => setLanguage("bn")}
        aria-pressed={language === "bn"}
        aria-label="বাংলা ভাষায় পরিবর্তন করুন"
        className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 ${
          language === "bn"
            ? "bg-white text-sky-950 shadow-sm"
            : "text-sky-200 hover:text-white hover:bg-sky-800/60"
        }`}
      >
        বাংলা
      </button>
    </div>
  );
}
