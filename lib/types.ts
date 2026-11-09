export type AssetType = "crypto" | "stock" | "us_stock" | "tw_stock" | "cash";
export type GainCalculationMode = "average_cost" | "break_even" | "estimated";
export type Locale = "en" | "zh" | "ja" | "ko" | "es";
export const supportedCurrencies = [
  "USD",
  "TWD",
  "EUR",
  "JPY",
  "KRW",
  "HKD",
  "GBP",
  "CAD",
  "AUD",
  "SGD",
  "CNY",
  "CHF",
  "INR",
  "SAR",
] as const;
export type Currency = (typeof supportedCurrencies)[number];

export const totalBudgetCategory = "total";
export type CashflowType = "income" | "expense";
export type InvestmentTransactionType = "opening" | "buy" | "sell";
export type RecurringFrequency = "monthly" | "yearly";
export type SubscriptionUsageStatus = "active" | "rarely_used" | "consider_canceling";
export type DebtType = "mortgage" | "car_loan" | "student_loan" | "credit_card" | "personal_loan" | "other";
export type EvmWalletChain = "ethereum" | "base" | "arbitrum" | "optimism" | "polygon";
export type WalletChain = EvmWalletChain | "bitcoin" | "solana" | "cardano";
export type WalletAddressKind = "address" | "xpub";

export type Holding = {
  id: string;
  user_id: string;
  asset_type: AssetType;
  symbol: string;
  name: string;
  quantity: number;
  average_cost: number;
  break_even_price: number | null;
  gain_calculation_mode: GainCalculationMode;
  cost_currency: Currency;
  notes: string | null;
  market_data_id?: string | null;
  market_code?: string | null;
  exchange_code?: string | null;
  quote_currency?: string | null;
  lot_size?: number | null;
  source_kind?: "manual" | "wallet";
  source_label?: string | null;
  source_account_id?: string | null;
  source_asset_id?: string | null;
  cost_known?: boolean;
  created_at: string;
  updated_at: string;
};

export type HoldingInput = {
  asset_type: AssetType;
  symbol: string;
  name: string;
  quantity: string;
  average_cost: string;
  break_even_price: string;
  gain_calculation_mode: GainCalculationMode;
  cost_currency: Currency;
  market_data_id?: string | null;
  market_code?: string | null;
  exchange_code?: string | null;
  quote_currency?: string | null;
  lot_size?: number | null;
  cost_known?: boolean;
};

export type InvestmentTransaction = {
  id: string;
  user_id: string;
  holding_id: string | null;
  asset_type: Exclude<AssetType, "cash">;
  symbol: string;
  name: string;
  transaction_type: InvestmentTransactionType;
  quantity: number;
  price_per_unit: number | null;
  fees: number;
  currency: Currency;
  cost_basis: number | null;
  proceeds: number | null;
  realized_gain: number | null;
  transaction_date: string;
  notes: string | null;
  created_at: string;
};

export type InvestmentSaleInput = {
  holdingId: string;
  quantity: number;
  pricePerUnit: number;
  fees: number;
  transactionDate: string;
  notes: string;
};

export type InvestmentPerformance = {
  realizedGainUsd: number;
  unrealizedGainUsd: number;
  cumulativeGainUsd: number;
  trackedCostUsd: number;
  cumulativeReturnPercent: number;
  hasPerformanceData: boolean;
  knownSaleCount: number;
  saleCount: number;
  startedAt: string | null;
};

export type CashflowTransaction = {
  id: string;
  user_id: string;
  transaction_type: CashflowType;
  amount: number;
  currency: Currency;
  category: string;
  description: string;
  transaction_date: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CashflowTransactionInput = {
  transaction_type: CashflowType;
  amount: string;
  currency: Currency;
  category: string;
  description: string;
  transaction_date: string;
  payment_method: string;
  notes: string;
};

export type RecurringExpense = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: Currency;
  category: string;
  frequency: RecurringFrequency;
  next_due_date: string;
  payment_method: string | null;
  is_active: boolean;
  is_subscription?: boolean;
  usage_status?: SubscriptionUsageStatus;
  reminder_days?: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringExpenseInput = {
  name: string;
  amount: string;
  currency: Currency;
  category: string;
  frequency: RecurringFrequency;
  next_due_date: string;
  payment_method: string;
  is_active: boolean;
  is_subscription: boolean;
  usage_status: SubscriptionUsageStatus;
  reminder_days: string;
  notes: string;
};

export type Debt = {
  id: string;
  user_id: string;
  name: string;
  debt_type: DebtType;
  original_principal: number;
  remaining_principal: number;
  currency: Currency;
  interest_rate: number;
  minimum_payment: number;
  next_payment_date: string;
  lender: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DebtInput = {
  name: string;
  debt_type: DebtType;
  original_principal: string;
  remaining_principal: string;
  currency: Currency;
  interest_rate: string;
  minimum_payment: string;
  next_payment_date: string;
  lender: string;
  is_active: boolean;
  notes: string;
};

export type MonthlyBudget = {
  id: string;
  user_id: string;
  month: string;
  category: string;
  amount: number;
  currency: Currency;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyBudgetInput = {
  month: string;
  category: string;
  amount: string;
  currency: Currency;
  notes: string;
};

export type SymbolSearchResult = {
  symbol: string;
  description: string;
  displaySymbol: string;
  type: string;
  assetType: Extract<AssetType, "stock" | "us_stock" | "tw_stock">;
  market: string;
  exchange: string;
  currency: Currency;
  lotSize: number;
};

export type WalletAccount = {
  id: string;
  user_id: string;
  chain: WalletChain;
  address_kind?: WalletAddressKind;
  label: string;
  address: string;
  derivation_purpose?: number | null;
  account_index?: number;
  gap_limit?: number;
  sync_status: "idle" | "syncing" | "synced" | "error";
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type WalletAsset = {
  assetId: string;
  symbol: string;
  name: string;
  quantity: number;
  priceUsd: number | null;
  dayChangePercent: number;
  contractAddress?: string | null;
  marketDataId?: string | null;
};

export type CryptoSearchResult = {
  id: string;
  symbol: string;
  name: string;
  thumb: string | null;
  marketCapRank: number | null;
};

export type WalletScanResponse = {
  chain: WalletChain;
  address: string;
  assets: WalletAsset[];
  warnings: string[];
  refreshedAt: string;
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
    status?: "fresh" | "cached";
    updatedAt?: string;
    source?: string;
    usdToTwd: number;
    twdToUsd: number;
    usdToEur: number;
    eurToUsd: number;
    usdToJpy: number;
    jpyToUsd: number;
    usdToKrw: number;
    krwToUsd: number;
    usdRates: Partial<Record<Currency, number>>;
  };
  refreshedAt: string;
};

export type EnrichedHolding = Holding & {
  quote?: MarketQuote;
  valueUsd: number;
  costBasisUsd: number;
  breakEvenKnown: boolean;
  gainConfirmed: boolean;
  gainKnown: boolean;
  gainEstimated: boolean;
  gainUsd: number;
  gainPercent: number;
  dayChangeUsd: number;
  allocationPercent: number;
};
