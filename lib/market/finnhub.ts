import type { SymbolSearchResult } from "@/lib/types";

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
    .map<SymbolSearchResult>((item) => ({
      symbol: item.symbol ?? "",
      displaySymbol: item.displaySymbol ?? item.symbol ?? "",
      description: item.description ?? "",
      type: item.type ?? "",
    }));
}
