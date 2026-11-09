import { fetchFxRates } from "@/lib/market/fx";
import { fetchContractQuotes, fetchCryptoQuotes } from "@/lib/market/coingecko";
import { supportedCurrencies } from "@/lib/types";
import type { Currency, Holding, MarketQuote, MarketResponse } from "@/lib/types";

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

export const fetchUsdTwdRate = fetchFxRates;

async function fetchYahooQuote(symbol: string, fx: Awaited<ReturnType<typeof fetchUsdTwdRate>>) {
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
    const nativeCurrency = (isTaiwanSymbol ? "TWD" : meta?.currency ?? "USD").toUpperCase();
    const usdRate = nativeCurrency === "USD" ? 1 : fx.usdRates[nativeCurrency as Currency];
    if (!usdRate || usdRate <= 0) return null;
    const priceUsd = price / usdRate;

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

export async function getMarketSnapshot(holdings: Holding[], cachedFx?: unknown): Promise<MarketResponse> {
  const fx = await fetchUsdTwdRate(cachedFx);
  const { twdToUsd, usdToTwd } = fx;

  const uniqueSymbols = [...new Set(holdings.map((holding) => holding.symbol.toUpperCase()))];
  const cryptoHoldings = holdings.filter((holding) => holding.asset_type === "crypto");
  const yahooSymbols = uniqueSymbols.filter((symbol) =>
    holdings.some((holding) => ["stock", "us_stock", "tw_stock"].includes(holding.asset_type) && holding.symbol.toUpperCase() === symbol),
  );

  const [cryptoQuotes, contractQuotes, stockQuotes] = await Promise.all([
    fetchCryptoQuotes(cryptoHoldings),
    fetchContractQuotes(cryptoHoldings),
    Promise.all(yahooSymbols.map((symbol) => fetchYahooQuote(symbol, fx))),
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
      const usdRate = fx.usdRates[symbol as Currency];
      if (!usdRate || usdRate <= 0) continue;
      const cashPriceUsd = 1 / usdRate;
      const cashCurrency = ((supportedCurrencies as readonly string[]).includes(symbol) ? symbol : "USD") as Currency;
      quotes[symbol] = {
        symbol,
        price: 1,
        currency: cashCurrency,
        priceUsd: cashPriceUsd,
        dayChangePercent: 0,
        source: "FX",
      };
    }
  }

  return {
    quotes,
    fx: {
      ...fx,
      usdToTwd,
      twdToUsd,
    },
    refreshedAt: new Date().toISOString(),
  };
}
