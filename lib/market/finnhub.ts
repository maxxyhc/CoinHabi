import type { Currency, SymbolSearchResult } from "@/lib/types";

type StockMetadata = Pick<SymbolSearchResult, "assetType" | "currency" | "exchange" | "lotSize" | "market">;

const suffixMarkets: Array<{ suffixes: string[]; metadata: StockMetadata }> = [
  { suffixes: ["TWO"], metadata: { assetType: "tw_stock", currency: "TWD", exchange: "TPEX", lotSize: 1000, market: "TW" } },
  { suffixes: ["TW"], metadata: { assetType: "tw_stock", currency: "TWD", exchange: "TWSE", lotSize: 1000, market: "TW" } },
  { suffixes: ["T"], metadata: { assetType: "stock", currency: "JPY", exchange: "JPX", lotSize: 1, market: "JP" } },
  { suffixes: ["HK"], metadata: { assetType: "stock", currency: "HKD", exchange: "HKEX", lotSize: 1, market: "HK" } },
  { suffixes: ["KS", "KQ"], metadata: { assetType: "stock", currency: "KRW", exchange: "KRX", lotSize: 1, market: "KR" } },
  { suffixes: ["L"], metadata: { assetType: "stock", currency: "GBP", exchange: "LSE", lotSize: 1, market: "GB" } },
  { suffixes: ["TO", "V"], metadata: { assetType: "stock", currency: "CAD", exchange: "TSX", lotSize: 1, market: "CA" } },
  { suffixes: ["AX"], metadata: { assetType: "stock", currency: "AUD", exchange: "ASX", lotSize: 1, market: "AU" } },
  { suffixes: ["SI"], metadata: { assetType: "stock", currency: "SGD", exchange: "SGX", lotSize: 1, market: "SG" } },
  { suffixes: ["SS", "SZ"], metadata: { assetType: "stock", currency: "CNY", exchange: "SSE/SZSE", lotSize: 1, market: "CN" } },
  { suffixes: ["SW"], metadata: { assetType: "stock", currency: "CHF", exchange: "SIX", lotSize: 1, market: "CH" } },
  { suffixes: ["NS", "BO"], metadata: { assetType: "stock", currency: "INR", exchange: "NSE/BSE", lotSize: 1, market: "IN" } },
  { suffixes: ["SR"], metadata: { assetType: "stock", currency: "SAR", exchange: "TADAWUL", lotSize: 1, market: "SA" } },
  { suffixes: ["PA", "AS", "BR", "DE", "F", "MI", "MC"], metadata: { assetType: "stock", currency: "EUR", exchange: "EU", lotSize: 1, market: "EU" } },
];

export function inferStockMetadata(symbol: string): StockMetadata {
  const suffix = symbol.toUpperCase().split(".").pop();
  const match = suffixMarkets.find((entry) => suffix && entry.suffixes.includes(suffix));
  return match?.metadata ?? {
    assetType: "us_stock",
    currency: "USD" as Currency,
    exchange: "US",
    lotSize: 1,
    market: "US",
  };
}

type FinnhubSearchResponse = {
  result?: Array<{
    description?: string;
    displaySymbol?: string;
    symbol?: string;
    type?: string;
  }>;
};

export async function searchSymbols(query: string) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not configured.");
  }

  const url = new URL("https://finnhub.io/api/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("token", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Finnhub symbol search failed");
  }

  const data = (await response.json()) as FinnhubSearchResponse;
  return (data.result ?? [])
    .filter((item) => item.symbol && item.description)
    .slice(0, 10)
    .map<SymbolSearchResult>((item) => {
      const symbol = item.symbol ?? "";
      return {
        symbol,
        displaySymbol: item.displaySymbol ?? symbol,
        description: item.description ?? "",
        type: item.type ?? "",
        ...inferStockMetadata(symbol),
      };
    });
}
