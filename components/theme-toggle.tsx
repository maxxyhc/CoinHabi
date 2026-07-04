"use client";

import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import clsx from "clsx";

type ThemeMode = "light" | "dark" | "system";

const options = [
  { value: "light" as const, label: "淺色", icon: Sun },
  { value: "dark" as const, label: "深色", icon: Moon },
  { value: "system" as const, label: "系統", icon: Laptop },
];

function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const saved = window.localStorage.getItem("theme") as ThemeMode | null;
    const initial = saved && ["light", "dark", "system"].includes(saved) ? saved : "system";
    setMode(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if ((window.localStorage.getItem("theme") ?? "system") === "system") applyTheme("system");
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
    <div className="theme-switcher" aria-label="Color theme">
      {options.map(({ value, label, icon: Icon }) => (
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
      ))}
    </div>
  );
}
