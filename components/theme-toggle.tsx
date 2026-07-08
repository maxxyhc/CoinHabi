"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import clsx from "clsx";
import { tx } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

type ThemeMode = "light" | "dark";

const options = [
  { value: "light" as const, labelKey: "Light", icon: Sun },
  { value: "dark" as const, labelKey: "Dark", icon: Moon },
];

function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeToggle({ compact = false, locale = "zh" }: { compact?: boolean; locale?: Locale }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const saved = window.localStorage.getItem("theme");
    const initial: ThemeMode = saved === "light" || saved === "dark" ? saved : media.matches ? "dark" : "light";
    setMode(initial);
    applyTheme(initial);

    // Until the user explicitly picks a theme, follow the system preference.
    const handleChange = () => {
      const stored = window.localStorage.getItem("theme");
      if (stored !== "light" && stored !== "dark") {
        const next: ThemeMode = media.matches ? "dark" : "light";
        setMode(next);
        applyTheme(next);
      }
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  function selectTheme(next: ThemeMode) {
    setMode(next);
    window.localStorage.setItem("theme", next);
    applyTheme(next);
  }

  return (
    <div className="theme-switcher" aria-label={tx(locale, "Theme")}>
      {options.map(({ value, labelKey, icon: Icon }) => {
        const label = tx(locale, labelKey);
        return (
        <button
          key={value}
          aria-label={label}
          aria-pressed={mode === value}
          className={clsx("theme-option focus-ring", mode === value && "is-active")}
          onClick={() => selectTheme(value)}
          title={label}
          type="button"
        >
          <Icon size={16} />
          {!compact && <span>{label}</span>}
        </button>
        );
      })}
    </div>
  );
}
