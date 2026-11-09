"use client";

import { BadgeDollarSign, Calculator, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import { getDictionary } from "@/lib/i18n";
import type { GainCalculationMode, Locale } from "@/lib/types";

const options: Array<{
  mode: GainCalculationMode;
  titleKey: "gainModeAverageCost" | "gainModeBreakEven" | "gainModeEstimated";
  helpKey: "gainModeAverageCostHelp" | "gainModeBreakEvenHelp" | "gainModeEstimatedHelp";
  icon: typeof Calculator;
}> = [
  {
    mode: "average_cost",
    titleKey: "gainModeAverageCost",
    helpKey: "gainModeAverageCostHelp",
    icon: Calculator,
  },
  {
    mode: "break_even",
    titleKey: "gainModeBreakEven",
    helpKey: "gainModeBreakEvenHelp",
    icon: BadgeDollarSign,
  },
  {
    mode: "estimated",
    titleKey: "gainModeEstimated",
    helpKey: "gainModeEstimatedHelp",
    icon: TriangleAlert,
  },
];

export function GainCalculationModeSelector({
  compact = false,
  locale,
  value,
  onChange,
}: {
  compact?: boolean;
  locale: Locale;
  value: GainCalculationMode;
  onChange: (mode: GainCalculationMode) => void;
}) {
  const t = getDictionary(locale);

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-titanium">
        {t.gainCalculationMethod}
      </legend>
      <div
        className={clsx(
          "grid gap-2",
          compact ? "grid-cols-1" : "md:grid-cols-3",
        )}
      >
        {options.map((option) => {
          const Icon = option.icon;
          const selected = value === option.mode;

          return (
            <label
              className={clsx(
                "focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--bg)]",
                "flex min-h-20 cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition",
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink shadow-sm"
                  : "border-line bg-[var(--surface-muted)] text-titanium hover:border-[var(--accent)] hover:bg-[var(--surface-raised)]",
              )}
              key={option.mode}
            >
              <input
                checked={selected}
                className="sr-only"
                name="gain-calculation-mode"
                onChange={() => onChange(option.mode)}
                type="radio"
                value={option.mode}
              />
              <span
                className={clsx(
                  "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                  selected
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "bg-[var(--surface-raised)] text-titanium",
                )}
              >
                <Icon aria-hidden="true" size={17} />
              </span>
              <span className="min-w-0">
                <span className={clsx("block text-sm font-semibold", selected && "text-ink")}>
                  {t[option.titleKey]}
                </span>
                <span className="mt-1 block text-xs leading-5 text-titanium">
                  {t[option.helpKey]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
