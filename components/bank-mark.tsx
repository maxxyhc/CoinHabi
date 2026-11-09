"use client";

import { detectBank } from "@/lib/banks";

/**
 * Circular account badge: shows the detected bank's brand color and short
 * name; falls back to a neutral monogram when no bank matches.
 */
export function BankMark({ fallback, name }: { fallback?: string; name: string }) {
  const bank = detectBank(name);
  if (bank) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white"
        style={{ backgroundColor: bank.color, fontSize: bank.label.length > 2 ? 9 : 11 }}
        title={name}
      >
        {bank.label}
      </span>
    );
  }
  const initials = (fallback ?? name).replace(/\..*$/, "").slice(0, 3).toUpperCase();
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ backgroundColor: "rgba(141, 153, 171, 0.14)", color: "#8d99ab" }}
      title={name}
    >
      {initials}
    </span>
  );
}
