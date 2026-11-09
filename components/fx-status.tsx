"use client";

import { useEffect, useState } from "react";
import { FX_MAX_AGE_MS, type FxRates } from "@/lib/market/fx";
import type { Locale } from "@/lib/types";

const copy = {
  zh: { label: "匯率更新", unavailable: "暫時無法取得匯率，尚未顯示資產總額。請重試。", retry: "重新整理" },
  en: { label: "FX updated", unavailable: "Exchange rates are unavailable. Portfolio totals are hidden until you retry.", retry: "Refresh" },
  ja: { label: "為替更新", unavailable: "為替レートを取得できません。再試行するまで資産合計は表示されません。", retry: "更新" },
  ko: { label: "환율 업데이트", unavailable: "환율을 불러올 수 없습니다. 다시 시도할 때까지 자산 총액이 숨겨집니다.", retry: "새로고침" },
  es: { label: "Cambio actualizado", unavailable: "Tipos de cambio no disponibles. Los totales se ocultan hasta que lo reintentes.", retry: "Actualizar" },
};
export const fxCopy = (locale: Locale) => copy[locale];

export function FxStatus({ fx, locale, failed = false }: { fx: FxRates; locale: Locale; failed?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!fx.updatedAt) return null; // Demo data has no live provider timestamp.
  const stale = failed || fx.status === "cached" || now - Date.parse(fx.updatedAt) > FX_MAX_AGE_MS;
  if (!stale) return null;
  const c = copy[locale];
  return <div role="status" className={`mb-4 rounded-xl border p-3 text-xs leading-5 ${stale ? "border-amber-500/40 bg-amber-500/10 text-ink" : "border-line text-titanium"}`}>
    <p>{c.label}: {new Date(fx.updatedAt).toLocaleString(locale === "zh" ? "zh-TW" : locale)} · <a className="underline" href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">ExchangeRate-API</a></p>
  </div>;
}
