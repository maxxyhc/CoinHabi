"use client";

import { useEffect, useId, useState } from "react";
import { Search } from "lucide-react";
import { tx } from "@/lib/i18n";
import type { Locale, SymbolSearchResult } from "@/lib/types";

const marketNames: Record<string, Record<Locale, string>> = {
  US: { en: "United States", zh: "美國", ja: "米国", ko: "미국", es: "Estados Unidos" },
  TW: { en: "Taiwan", zh: "台灣", ja: "台湾", ko: "대만", es: "Taiwán" },
  JP: { en: "Japan", zh: "日本", ja: "日本", ko: "일본", es: "Japón" },
  HK: { en: "Hong Kong", zh: "香港", ja: "香港", ko: "홍콩", es: "Hong Kong" },
  KR: { en: "South Korea", zh: "韓國", ja: "韓国", ko: "한국", es: "Corea del Sur" },
  GB: { en: "United Kingdom", zh: "英國", ja: "英国", ko: "영국", es: "Reino Unido" },
  CA: { en: "Canada", zh: "加拿大", ja: "カナダ", ko: "캐나다", es: "Canadá" },
  AU: { en: "Australia", zh: "澳洲", ja: "オーストラリア", ko: "호주", es: "Australia" },
  SG: { en: "Singapore", zh: "新加坡", ja: "シンガポール", ko: "싱가포르", es: "Singapur" },
  CN: { en: "China", zh: "中國", ja: "中国", ko: "중국", es: "China" },
  CH: { en: "Switzerland", zh: "瑞士", ja: "スイス", ko: "스위스", es: "Suiza" },
  IN: { en: "India", zh: "印度", ja: "インド", ko: "인도", es: "India" },
  SA: { en: "Saudi Arabia", zh: "沙烏地阿拉伯", ja: "サウジアラビア", ko: "사우디아라비아", es: "Arabia Saudita" },
  EU: { en: "Europe", zh: "歐洲", ja: "欧州", ko: "유럽", es: "Europa" },
};

export function StockSymbolSearch({
  value,
  locale,
  onChange,
  onSelect,
}: {
  value: string;
  locale: Locale;
  onChange: (value: string) => void;
  onSelect: (result: SymbolSearchResult) => void;
}) {
  const listboxId = useId();
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const query = value.trim();
    if (!query || !open) {
      setResults([]);
      setSearchError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const response = await fetch(`/api/symbol-search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { results?: SymbolSearchResult[]; error?: string };
        setResults(data.results ?? []);
        if (!response.ok) setSearchError(data.error ?? tx(locale, "Symbol search is unavailable"));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
          setSearchError(tx(locale, "Symbol search is unavailable"));
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locale, open, value]);

  return (
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 z-10 text-titanium" size={17} />
      <input
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open && Boolean(value.trim())}
        autoComplete="off"
        className="input-control focus-ring w-full pl-10 pr-3 text-ink"
        placeholder="AAPL, 2330, 7203, Samsung"
        required
        role="combobox"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && value.trim() && (
        <div className="glass-panel apple-card-sm absolute z-30 mt-2 max-h-72 w-full overflow-y-auto p-1" id={listboxId} role="listbox">
          {loading && <p className="px-3 py-3 text-sm text-titanium">{tx(locale, "Searching...")}</p>}
          {!loading && searchError && <p className="px-3 py-3 text-sm text-rose">{searchError}</p>}
          {!loading && !searchError && results.map((result) => {
            const market = marketNames[result.market]?.[locale] ?? result.market;
            return (
              <button
                className="focus-ring flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
                key={`${result.symbol}-${result.description}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(result);
                  setOpen(false);
                }}
                aria-selected="false"
                role="option"
                type="button"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{result.displaySymbol || result.symbol}</span>
                  <span className="block truncate text-xs text-titanium">{result.description}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-titanium">
                  <span className="block font-medium text-ink">{market}</span>
                  <span className="mt-0.5 block">{result.currency}</span>
                </span>
              </button>
            );
          })}
          {!loading && !searchError && !results.length && (
            <p className="px-3 py-3 text-sm text-titanium">{tx(locale, "No matching symbols")}</p>
          )}
        </div>
      )}
    </div>
  );
}
