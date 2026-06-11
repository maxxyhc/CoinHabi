export type AssetType = "crypto" | "us_stock" | "tw_stock" | "cash";
export type Currency = "USD" | "TWD";
export type Locale = "en" | "zh";

export type Holding = {
  id: string;
  user_id: string;
  asset_type: AssetType;
  symbol: string;
  name: string;
  quantity: number;
  average_cost: number;
  cost_currency: Currency;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type HoldingInput = {
  asset_type: AssetType;
  symbol: string;
  name: string;
  quantity: number;
  average_cost: number;
  cost_currency: Currency;
  notes?: string | null;
};

export type MarketQuote = {
  symbol: string;
  price: number;
  currency: string;
  priceUsd: number;
  dayChangePercent: number;
  source: string;
};

export type MarketResponse = {
  quotes: Record<string, MarketQuote>;
  fx: {
    usdToTwd: number;
    twdToUsd: number;
  };
  refreshedAt: string;
};

export type EnrichedHolding = Holding & {
  quote?: MarketQuote;
  valueUsd: number;
  costBasisUsd: number;
  gainUsd: number;
  gainPercent: number;
  dayChangeUsd: number;
  allocationPercent: number;
};
