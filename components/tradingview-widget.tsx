"use client";

import { useEffect, useRef } from "react";
import { tradingViewLocale, tx } from "@/lib/i18n";
import type { EnrichedHolding, Locale } from "@/lib/types";

export function toTradingViewSymbol(holding: EnrichedHolding) {
  const symbol = holding.symbol.toUpperCase();
  if (holding.asset_type === "crypto") {
    const cryptoSymbols: Record<string, string> = {
      ADA: "BINANCE:ADAUSDT",
      AVAX: "BINANCE:AVAXUSDT",
      BNB: "BINANCE:BNBUSDT",
      BTC: "BINANCE:BTCUSDT",
      DOGE: "BINANCE:DOGEUSDT",
      DOT: "BINANCE:DOTUSDT",
      ETH: "BINANCE:ETHUSDT",
      LINK: "BINANCE:LINKUSDT",
      MATIC: "BINANCE:MATICUSDT",
      POL: "BINANCE:POLUSDT",
      SOL: "BINANCE:SOLUSDT",
      XRP: "BINANCE:XRPUSDT",
    };
    return cryptoSymbols[symbol] ?? null;
  }

  if (holding.asset_type === "tw_stock") {
    const ticker = symbol.replace(/\.(TW|TWO)$/i, "");
    if (symbol.endsWith(".TWO")) return `TPEX:${ticker}`;
    return `TWSE:${ticker}`;
  }

  if (holding.asset_type === "us_stock") {
    const nasdaq = new Set(["AAPL", "AMD", "AMZN", "AVGO", "COST", "GOOGL", "GOOG", "META", "MSFT", "NVDA", "NFLX", "QQQ", "TSLA"]);
    return `${nasdaq.has(symbol) ? "NASDAQ" : "NYSE"}:${symbol}`;
  }

  return null;
}

export function TradingViewWidget({
  height = 360,
  locale,
  symbol,
  theme,
}: {
  height?: number;
  locale: Locale;
  symbol: string | null;
  theme: "dark" | "light";
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !symbol) return;

    container.innerHTML = "";
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    container.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      calendar: false,
      hide_side_toolbar: false,
      interval: "D",
      locale: tradingViewLocale[locale],
      save_image: false,
      style: "1",
      symbol,
      theme,
      timezone: "Etc/UTC",
      withdateranges: true,
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [locale, symbol, theme]);

  if (!symbol) {
    return (
      <div className="subtle-panel apple-card-sm flex items-center justify-center text-center text-sm text-titanium" style={{ height }}>
        {tx(locale, "No TradingView symbol is available for this asset yet.")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-line" style={{ height }}>
      <div className="tradingview-widget-container h-full w-full" ref={containerRef} />
    </div>
  );
}
