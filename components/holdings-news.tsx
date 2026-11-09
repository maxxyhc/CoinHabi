"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ExternalLink, Newspaper } from "lucide-react";
import type { NewsItem } from "@/lib/market/news";
import type { EnrichedHolding, Locale } from "@/lib/types";

const copy: Record<Locale, { title: string; subtitle: string; all: string; more: string; loading: string; empty: string; none: string; failed: string }> = {
  en: {
    title: "News on your US stocks",
    subtitle: "Past 7 days, only articles that name the company. Tickers are ordered by position size.",
    all: "All",
    more: "Show more",
    loading: "Loading news…",
    empty: "Add US stocks to see news about them here.",
    none: "No company-specific news in the past 7 days.",
    failed: "News is unavailable right now.",
  },
  zh: {
    title: "你的美股新聞",
    subtitle: "過去 7 天、標題或摘要有提到該公司的新聞；代號依持倉大小排序。新聞為英文原文。",
    all: "全部",
    more: "顯示更多",
    loading: "正在載入新聞…",
    empty: "新增美股持倉後，這裡會顯示相關新聞。",
    none: "過去 7 天沒有直接提到這些公司的新聞。",
    failed: "目前無法取得新聞。",
  },
  ja: {
    title: "保有米国株のニュース",
    subtitle: "過去7日間、企業名に言及した記事のみ。ティッカーは保有額順です。記事は英語です。",
    all: "すべて",
    more: "さらに表示",
    loading: "ニュースを読み込み中…",
    empty: "米国株を追加すると、関連ニュースがここに表示されます。",
    none: "過去7日間、これらの企業に関するニュースはありません。",
    failed: "現在ニュースを取得できません。",
  },
  ko: {
    title: "보유 미국 주식 뉴스",
    subtitle: "최근 7일, 회사를 직접 언급한 기사만 표시합니다. 티커는 보유 비중 순이며 기사는 영어입니다.",
    all: "전체",
    more: "더 보기",
    loading: "뉴스를 불러오는 중…",
    empty: "미국 주식을 추가하면 관련 뉴스가 여기에 표시됩니다.",
    none: "최근 7일 동안 이 회사들을 다룬 뉴스가 없습니다.",
    failed: "지금은 뉴스를 불러올 수 없습니다.",
  },
  es: {
    title: "Noticias de tus acciones de EE. UU.",
    subtitle: "Últimos 7 días, solo artículos que nombran a la empresa. Los tickers se ordenan por tamaño de posición. Noticias en inglés.",
    all: "Todas",
    more: "Ver más",
    loading: "Cargando noticias…",
    empty: "Añade acciones de EE. UU. para ver sus noticias aquí.",
    none: "No hay noticias específicas de estas empresas en los últimos 7 días.",
    failed: "Las noticias no están disponibles ahora.",
  },
};

const PAGE = 8;

export function HoldingsNews({ holdings, locale }: { holdings: EnrichedHolding[]; locale: Locale }) {
  const c = copy[locale];
  const stocks = useMemo(() => {
    const bySymbol = new Map<string, { symbol: string; name: string; value: number }>();
    for (const holding of holdings) {
      if (holding.asset_type !== "us_stock") continue;
      const symbol = holding.symbol.toUpperCase();
      const entry = bySymbol.get(symbol) ?? { symbol, name: holding.name, value: 0 };
      entry.value += holding.valueUsd;
      bySymbol.set(symbol, entry);
    }
    return [...bySymbol.values()].sort((a, b) => b.value - a.value);
  }, [holdings]);
  const signature = stocks.map((stock) => stock.symbol).sort().join(",");

  const [state, setState] = useState<{ signature: string; items: NewsItem[] | null } | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    if (!signature) return;
    let cancelled = false;
    fetch("/api/market/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stocks: stocks.map(({ symbol, name }) => ({ symbol, name })) }),
    })
      .then((response) => response.ok ? response.json() as Promise<{ items: NewsItem[] }> : Promise.reject(new Error(String(response.status))))
      .then(({ items }) => { if (!cancelled) setState({ signature, items }); })
      .catch(() => { if (!cancelled) setState({ signature, items: null }); });
    return () => { cancelled = true; };
    // `signature` changes exactly when the set of symbols does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const current = state?.signature === signature ? state : null;
  const items = current?.items ?? [];
  const visible = items.filter((item) => !filter || item.symbol === filter);
  const status = !signature ? c.empty : !current ? c.loading : !current.items ? c.failed : !visible.length ? c.none : null;
  const time = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  return (
    <section className="glass-panel apple-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Newspaper size={20} style={{ color: "var(--accent)" }} />
        <h3 className="text-xl font-semibold text-ink">{c.title}</h3>
      </div>
      <p className="mt-1 text-sm text-titanium">{c.subtitle}</p>

      {stocks.length > 1 && current?.items && (
        <div className="mt-4 flex flex-wrap gap-2">
          {[null, ...stocks.map((stock) => stock.symbol)].map((symbol) => (
            <button
              key={symbol ?? "all"}
              className={clsx(
                "focus-ring rounded-full px-3 py-1.5 text-xs font-semibold transition",
                filter === symbol ? "bg-[var(--accent)] text-[#14110a]" : "bg-[var(--surface-muted)] text-titanium hover:text-ink",
              )}
              type="button"
              onClick={() => { setFilter(symbol); setLimit(PAGE); }}
            >
              {symbol ?? c.all}
              {symbol && <span className="ml-1 opacity-70">{items.filter((item) => item.symbol === symbol).length}</span>}
            </button>
          ))}
        </div>
      )}

      {status ? (
        <p className="mt-4 rounded-2xl bg-[var(--surface-muted)] p-4 text-sm text-titanium">{status}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {visible.slice(0, limit).map((item) => (
            <li key={`${item.symbol}-${item.id}`}>
              <a className="group flex items-start gap-3 py-3" href={item.url} rel="noopener noreferrer" target="_blank">
                <span className="mt-0.5 w-12 shrink-0 rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-center text-[11px] font-semibold text-ink">{item.symbol}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-5 text-ink group-hover:text-[var(--accent)]">{item.headline}</span>
                  <span className="mt-1 block text-xs text-titanium">{item.source} · {relative(time, item.datetime)}</span>
                </span>
                <ExternalLink className="mt-1 shrink-0 text-titanium opacity-0 transition group-hover:opacity-100" size={14} />
              </a>
            </li>
          ))}
        </ul>
      )}
      {!status && visible.length > limit && (
        <button className="focus-ring mt-2 w-full rounded-xl py-2 text-sm font-semibold text-[var(--accent)]" type="button" onClick={() => setLimit((value) => value + PAGE)}>
          {c.more}
        </button>
      )}
    </section>
  );
}

function relative(format: Intl.RelativeTimeFormat, unixSeconds: number) {
  const minutes = Math.round((unixSeconds * 1000 - Date.now()) / 60000);
  if (minutes > -60) return format.format(minutes, "minute");
  if (minutes > -60 * 24) return format.format(Math.round(minutes / 60), "hour");
  return format.format(Math.round(minutes / 1440), "day");
}
