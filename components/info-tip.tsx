"use client";

import { useState } from "react";
import { Info } from "lucide-react";

/**
 * Small info icon that explains a metric. Shows the text on hover (desktop)
 * and toggles it on tap/click (touch). The explanation doubles as the
 * button's accessible name, so screen readers hear it directly.
 */
export function InfoTip({ align = "right", text }: { align?: "left" | "right"; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="group relative inline-flex h-6 w-6 shrink-0">
      <button
        aria-expanded={open}
        aria-label={text}
        className="focus-ring absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-titanium transition hover:text-ink"
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        type="button"
      >
        <Info size={14} />
      </button>
      <span
        aria-hidden={!open}
        className={`${align === "left" ? "left-0" : "right-0"} absolute bottom-full z-50 mb-2 w-52 rounded-xl border border-line bg-panel p-3 text-left text-xs font-normal leading-5 text-ink shadow-xl transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${open ? "visible opacity-100" : "invisible opacity-0"}`}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}
