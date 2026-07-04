import { fetchContractQuotes, fetchCryptoQuotes } from "@/lib/market/coingecko";
import type { Holding, MarketQuote, MarketResponse } from "@/lib/types";

type YahooResult = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        currency?: string;
        shortName?: string;
        longName?: string;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

export async function fetchUsdTwdRate() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 60 * 30 },
    });
    if (!response.ok) {
      throw new Error("FX request failed");
    }
    const data = (await response.json()) as { rates?: Record<string, number> };
    const usdToTwd = data.rates?.TWD;
    if (!usdToTwd) {
      throw new Error("Missing TWD rate");
    }
    return { usdToTwd, twdToUsd: 1 / usdToTwd };
  } catch {
    return { usdToTwd: 32, twdToUsd: 1 / 32 };
  }
}

async function fetchYahooQuote(symbol: string, twdToUsd: number) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`,
      { next: { revalidate: 60 } },
    );
    if (!response.ok) {
      throw new Error("Yahoo request failed");
    }
    const data = (await response.json()) as YahooResult;
    const result = data.chart?.result?.[0];
    const meta = result?.meta;
    const price = meta?.regularMarketPrice;
    if (!price) {
      return null;
    }

    const closes = result?.indicators?.quote?.[0]?.close?.filter((value): value is number => typeof value === "number");
    const previousClose = closes && closes.length > 1 ? closes[closes.length - 2] : meta?.chartPreviousClose;
    const dayChangePercent = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
    const isTaiwanSymbol = symbol.endsWith(".TW") || symbol.endsWith(".TWO");
    const nativeCurrency = isTaiwanSymbol ? "TWD" : meta?.currency ?? "USD";
    const priceUsd = nativeCurrency === "TWD" ? price * twdToUsd : price;

    return {
      symbol,
      price,
      currency: nativeCurrency,
      priceUsd,
      dayChangePercent,
      source: "Yahoo Finance",
    } satisfies MarketQuote;
  } catch {
    return null;
  }
}

export async function getMarketSnapshot(holdings: Holding[]): Promise<MarketResponse> {
  const { twdToUsd, usdToTwd } = await fetchUsdTwdRate();

  const uniqueSymbols = [...new Set(holdings.map((holding) => holding.symbol.toUpperCase()))];
  const cryptoHoldings = holdings.filter((holding) => holding.asset_type === "crypto");
  const yahooSymbols = uniqueSymbols.filter((symbol) =>
    holdings.some((holding) => ["us_stock", "tw_stock"].includes(holding.asset_type) && holding.symbol.toUpperCase() === symbol),
  );

  const [cryptoQuotes, contractQuotes, stockQuotes] = await Promise.all([
    fetchCryptoQuotes(cryptoHoldings),
    fetchContractQuotes(cryptoHoldings),
    Promise.all(yahooSymbols.map((symbol) => fetchYahooQuote(symbol, twdToUsd))),
  ]);

  const quotes = stockQuotes.reduce<Record<string, MarketQuote>>((acc, quote) => {
    if (quote) {
      acc[quote.symbol] = quote;
    }
    return acc;
  }, { ...cryptoQuotes, ...contractQuotes });

  for (const holding of holdings) {
    if (holding.asset_type === "cash") {
      const symbol = holding.symbol.toUpperCase();
      quotes[symbol] = {
        symbol,
        price: 1,
        currency: symbol === "TWD" ? "TWD" : "USD",
        priceUsd: symbol === "TWD" ? twdToUsd : 1,
        dayChangePercent: 0,
        source: "FX",
      };
    }
  }

  return {
    quotes,
    fx: {
      usdToTwd,
      twdToUsd,
    },
    refreshedAt: new Date().toISOString(),
  };
}
