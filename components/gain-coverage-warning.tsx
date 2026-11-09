"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";

export function GainCoverageWarning({
  compact = false,
  label,
  text,
}: {
  compact?: boolean;
  label: string;
  text: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        aria-expanded={open}
        aria-label={label}
        className={`focus-ring grid place-items-center rounded-full text-rose transition hover:bg-rose/10 ${compact ? "h-6 w-6" : "h-7 w-7"}`}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            event.currentTarget.blur();
          }
        }}
        type="button"
      >
        <CircleAlert aria-hidden="true" size={compact ? 15 : 17} />
      </button>
      {open && (
        <span
          className="absolute right-0 top-full z-[80] mt-2 w-72 max-w-[calc(100vw-2rem)] whitespace-normal break-words rounded-2xl border border-rose/25 bg-panel p-3 text-left text-xs font-normal leading-5 text-ink shadow-xl [overflow-wrap:anywhere]"
          role="tooltip"
        >
          {text}
        </span>
      )}
    </span>
  );
}
