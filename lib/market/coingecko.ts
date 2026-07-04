import type { CryptoSearchResult, Holding, MarketQuote } from "@/lib/types";

type CoinGeckoSearch = {
  coins?: Array<{
    id: string;
    name: string;
    symbol: string;
    thumb?: string;
    market_cap_rank?: number | null;
  }>;
};

export const cryptoIds: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOGE: "dogecoin",
  XRP: "ripple",
  BNB: "binancecoin",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  MATIC: "matic-network",
  DOT: "polkadot",
};

export async function fetchCoinGecko(url: URL) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.ok) return response;
    if (response.status !== 429 && response.status < 500) return response;
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  throw new Error("CoinGecko request failed");
}

export async function searchCryptoAssets(query: string) {
  const url = new URL("https://api.coingecko.com/api/v3/search");
  url.searchParams.set("query", query);
  const response = await fetch(url, { next: { revalidate: 60 * 10 } });
  if (!response.ok) {
    throw new Error("CoinGecko search failed");
  }

  const data = (await response.json()) as CoinGeckoSearch;
  return (data.coins ?? []).slice(0, 10).map<CryptoSearchResult>((coin) => ({
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    thumb: coin.thumb ?? null,
    marketCapRank: coin.market_cap_rank ?? null,
  }));
}

export async function fetchCryptoQuotes(holdings: Holding[]) {
  const ids = holdings
    .map((holding) => holding.market_data_id || cryptoIds[holding.symbol.toUpperCase()])
    .filter((id): id is string => Boolean(id));

  if (!ids.length) {
    return {};
  }

  try {
    const url = new URL("https://api.coingecko.com/api/v3/simple/price");
    url.searchParams.set("ids", [...new Set(ids)].join(","));
    url.searchParams.set("vs_currencies", "usd");
    url.searchParams.set("include_24hr_change", "true");

    const response = await fetchCoinGecko(url);
    if (!response.ok) {
      throw new Error("Crypto request failed");
    }
    const data = (await response.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;

    return holdings.reduce<Record<string, MarketQuote>>((quotes, holding) => {
      const symbol = holding.symbol.toUpperCase();
      const id = holding.market_data_id || cryptoIds[symbol];
      const price = data[id]?.usd;
      if (price) {
        const dayChangePercent = data[id]?.usd_24h_change ?? 0;
        const quote = {
          symbol,
          price,
          currency: "USD",
          priceUsd: price,
          dayChangePercent,
          source: "CoinGecko",
        };
        quotes[holding.id] = quote;
        quotes[id] = quote;
        if (!quotes[symbol]) quotes[symbol] = quote;
      }
      return quotes;
    }, {});
  } catch {
    return {};
  }
}

export async function fetchContractQuotes(holdings: Holding[]) {
  const platforms: Partial<Record<string, string>> = {
    ethereum: "ethereum",
    base: "base",
    arbitrum: "arbitrum-one",
    optimism: "optimistic-ethereum",
    polygon: "polygon-pos",
    solana: "solana",
  };
  const groups = holdings.reduce<Record<string, Holding[]>>((acc, holding) => {
    const [chain, contract] = holding.source_asset_id?.split(":") ?? [];
    const platform = platforms[chain];
    if (!platform || !contract || holding.market_data_id) return acc;
    (acc[platform] ??= []).push(holding);
    return acc;
  }, {});

  const entries = await Promise.all(Object.entries(groups).map(async ([platform, items]) => {
    try {
      const contracts = items.map((item) => item.source_asset_id?.slice(item.source_asset_id.indexOf(":") + 1)).filter(Boolean) as string[];
      const url = new URL(`https://api.coingecko.com/api/v3/simple/token_price/${platform}`);
      url.searchParams.set("contract_addresses", contracts.join(","));
      url.searchParams.set("vs_currencies", "usd");
      url.searchParams.set("include_24hr_change", "true");
      const response = await fetchCoinGecko(url);
      if (!response.ok) return {};
      const data = (await response.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
      return items.reduce<Record<string, MarketQuote>>((quotes, holding) => {
        const contract = holding.source_asset_id?.slice(holding.source_asset_id.indexOf(":") + 1) ?? "";
        const price = data[contract]?.usd ?? data[contract.toLowerCase()]?.usd;
        if (!price) return quotes;
        quotes[holding.id] = {
          symbol: holding.symbol,
          price,
          currency: "USD",
          priceUsd: price,
          dayChangePercent: data[contract]?.usd_24h_change ?? data[contract.toLowerCase()]?.usd_24h_change ?? 0,
          source: "CoinGecko",
        };
        return quotes;
      }, {});
    } catch {
      return {};
    }
  }));
  return Object.assign({}, ...entries) as Record<string, MarketQuote>;
}
