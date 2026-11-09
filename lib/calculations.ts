import { tx } from "@/lib/i18n";
import { inferStockMetadata } from "@/lib/market/finnhub";
import { supportedCurrencies } from "@/lib/types";
import type {
  AssetType,
  CashflowTransaction,
  Currency,
  Debt,
  EnrichedHolding,
  GainCalculationMode,
  Holding,
  InvestmentPerformance,
  InvestmentTransaction,
  Locale,
  MarketResponse,
  MarketQuote,
  RecurringExpense,
} from "@/lib/types";

export type CurrencyFxInput = number | Partial<MarketResponse["fx"]>;

export function formatCurrency(value: number, currency: Currency = "USD") {
  const absolute = Math.abs(value);
  if (absolute >= 10_000) {
    const [divisor, suffix] = absolute >= 999_950 ? [1_000_000, "M"] : [1_000, "K"];
    return `${new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: suffix === "M" ? 2 : 1,
    }).format(value / divisor)}${suffix}`;
  }
  const noMinorUnits = currency === "JPY" || currency === "KRW";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: noMinorUnits || absolute > 1000 ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function resolveGainCalculationMode(
  holding: Pick<Holding, "break_even_price"> & Partial<Pick<Holding, "gain_calculation_mode">>,
): GainCalculationMode {
  if (
    holding.gain_calculation_mode === "average_cost" ||
    holding.gain_calculation_mode === "break_even" ||
    holding.gain_calculation_mode === "estimated"
  ) {
    return holding.gain_calculation_mode;
  }

  if (
    holding.break_even_price !== null &&
    Number.isFinite(holding.break_even_price) &&
    holding.break_even_price > 0
  ) {
    return "break_even";
  }

  return holding.break_even_price === 0 ? "average_cost" : "estimated";
}

/**
 * "stock" is the form default, so a symbol typed without picking a search
 * result is saved as a generic stock even when it is plainly US- or
 * Taiwan-listed. Fold those into 美股/台股; only other markets stay "stock".
 */
export function resolveAssetType(holding: Pick<Holding, "asset_type" | "symbol" | "market_code">): AssetType {
  if (holding.asset_type !== "stock") return holding.asset_type;
  const market = holding.market_code ?? inferStockMetadata(holding.symbol.toUpperCase()).market;
  return market === "US" ? "us_stock" : market === "TW" ? "tw_stock" : "stock";
}

export function enrichHoldings(
  holdings: Holding[],
  quotes: Record<string, MarketQuote>,
  fx: CurrencyFxInput,
): EnrichedHolding[] {
  const enriched = holdings.map((holding) => {
    const symbol = holding.symbol.toUpperCase();
    const quote = quotes[holding.id] ?? quotes[holding.market_data_id ?? ""] ?? quotes[symbol];
    const priceUsd = quote?.priceUsd ?? fallbackPriceUsd(holding, fx);
    const units = getHoldingUnits(holding);
    const valueUsd = units * priceUsd;
    const gainCalculationMode = resolveGainCalculationMode(holding);
    const breakEvenKnown = holding.asset_type !== "cash" &&
      gainCalculationMode === "break_even" &&
      holding.break_even_price !== null &&
      Number.isFinite(holding.break_even_price) &&
      holding.break_even_price > 0;
    const breakEvenUsd = breakEvenKnown
      ? currencyAmountToUsd(holding.break_even_price ?? 0, holding.cost_currency, fx)
      : 0;
    const averageCostKnown = holding.asset_type !== "cash" &&
      holding.cost_known !== false &&
      Number.isFinite(holding.average_cost) &&
      holding.average_cost >= 0;
    const averageCostUsd = averageCostKnown
      ? currencyAmountToUsd(holding.average_cost, holding.cost_currency, fx)
      : 0;
    const usesAverageCost = gainCalculationMode === "average_cost" ||
      gainCalculationMode === "estimated";
    const gainKnown = breakEvenKnown || (usesAverageCost && averageCostKnown);
    const gainConfirmed = gainKnown && gainCalculationMode !== "estimated";
    const gainEstimated = gainKnown && gainCalculationMode === "estimated";
    const costBasisUsd = gainKnown
      ? units * (breakEvenKnown ? breakEvenUsd : averageCostUsd)
      : 0;
    const gainUsd = gainKnown ? valueUsd - costBasisUsd : 0;
    const gainPercent = costBasisUsd ? (gainUsd / costBasisUsd) * 100 : 0;
    const dayChangeRate = quote ? quote.dayChangePercent / 100 : 0;
    const dayChangeUsd = dayChangeRate === -1 ? 0 : valueUsd - valueUsd / (1 + dayChangeRate);

    return {
      ...holding,
      asset_type: resolveAssetType(holding),
      gain_calculation_mode: gainCalculationMode,
      quote,
      valueUsd,
      costBasisUsd,
      breakEvenKnown,
      gainConfirmed,
      gainKnown,
      gainEstimated,
      gainUsd,
      gainPercent,
      dayChangeUsd,
      allocationPercent: 0,
    };
  });

  const totalValue = enriched.reduce((sum, holding) => sum + holding.valueUsd, 0);
  return enriched.map((holding) => ({
    ...holding,
    allocationPercent: totalValue ? (holding.valueUsd / totalValue) * 100 : 0,
  }));
}

export function getPortfolioTotals(holdings: EnrichedHolding[]) {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const investmentHoldings = holdings.filter((holding) => holding.asset_type !== "cash");
  const gainCalculatedHoldings = investmentHoldings.filter((holding) => holding.gainKnown);
  const confirmedGainHoldings = investmentHoldings.filter((holding) => holding.gainConfirmed);
  const totalCost = gainCalculatedHoldings.reduce((sum, holding) => sum + holding.costBasisUsd, 0);
  const totalGain = gainCalculatedHoldings.reduce((sum, holding) => sum + holding.gainUsd, 0);
  const totalReturn = totalCost ? (totalGain / totalCost) * 100 : 0;
  const dayChange = holdings.reduce((sum, holding) => sum + holding.dayChangeUsd, 0);
  const dayChangePercent = totalValue ? (dayChange / totalValue) * 100 : 0;
  const investmentValue = investmentHoldings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const gainCoverageValue = confirmedGainHoldings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const gainInvestmentCount = investmentHoldings.length;
  const gainKnownCount = confirmedGainHoldings.length;

  return {
    totalValue,
    totalCost,
    totalGain,
    totalReturn,
    dayChange,
    dayChangePercent,
    gainCoveragePercent: investmentValue ? (gainCoverageValue / investmentValue) * 100 : 0,
    gainCoverageValue,
    gainDataComplete: gainInvestmentCount > 0 && gainKnownCount === gainInvestmentCount,
    gainInvestmentCount,
    gainKnownCount,
    hasGainData: gainCalculatedHoldings.length > 0,
  };
}

export function aggregateHoldingsForOverview(holdings: EnrichedHolding[]) {
  const groups = holdings.reduce<Map<string, EnrichedHolding[]>>((acc, holding) => {
    const symbol = holding.symbol.toUpperCase();
    // Cash is an account balance, not a tradable ticker. Two USD accounts must
    // remain separate so each bank is visible throughout the app.
    const key = holding.asset_type === "cash"
      ? [holding.asset_type, holding.id].join(":")
      : [holding.asset_type, symbol, holding.market_data_id ?? symbol].join(":");
    acc.set(key, [...(acc.get(key) ?? []), holding]);
    return acc;
  }, new Map());

  const aggregated = [...groups.values()].map((items) => {
    if (items.length === 1) return items[0];

    const base = items[0];
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const valueUsd = items.reduce((sum, item) => sum + item.valueUsd, 0);
    const costBasisUsd = items.reduce((sum, item) => sum + item.costBasisUsd, 0);
    const gainUsd = items.reduce((sum, item) => sum + item.gainUsd, 0);
    const dayChangeUsd = items.reduce((sum, item) => sum + item.dayChangeUsd, 0);
    const allCostsKnown = items.every((item) => item.cost_known !== false);
    const allBreakEvenKnown = items.every((item) => item.breakEvenKnown);
    const allGainsConfirmed = items.every((item) => item.gainConfirmed);
    const allGainsKnown = items.every((item) => item.gainKnown);
    const sharedGainMode = items.every(
      (item) => item.gain_calculation_mode === base.gain_calculation_mode,
    )
      ? base.gain_calculation_mode
      : "estimated";
    const sameCostCurrency = items.every((item) => item.cost_currency === base.cost_currency);
    const totalUnits = items.reduce((sum, item) => sum + getHoldingUnits(item), 0);
    const weightedAverageCost = allCostsKnown && sameCostCurrency && quantity > 0
      ? items.reduce((sum, item) => sum + (item.average_cost * item.quantity), 0) / quantity
      : base.average_cost;
    const weightedBreakEvenPrice = allBreakEvenKnown && sameCostCurrency && totalUnits > 0
      ? items.reduce(
        (sum, item) => sum + ((item.break_even_price ?? 0) * getHoldingUnits(item)),
        0,
      ) / totalUnits
      : null;
    const sourceLabels = [...new Set(items.map((item) => item.source_label).filter(Boolean))];

    return {
      ...base,
      id: `overview:${base.asset_type}:${base.symbol.toUpperCase()}:${base.market_data_id ?? base.symbol.toUpperCase()}`,
      name: sourceLabels.length > 1 ? `${base.name} (${sourceLabels.length} sources)` : base.name,
      quantity,
      average_cost: weightedAverageCost,
      break_even_price: weightedBreakEvenPrice,
      gain_calculation_mode: sharedGainMode,
      valueUsd,
      costBasisUsd,
      gainUsd,
      gainPercent: allGainsKnown && costBasisUsd ? (gainUsd / costBasisUsd) * 100 : 0,
      dayChangeUsd,
      cost_known: allCostsKnown,
      breakEvenKnown: allBreakEvenKnown,
      gainConfirmed: allGainsConfirmed,
      gainKnown: allGainsKnown,
      gainEstimated: allGainsKnown && !allGainsConfirmed,
      source_label: sourceLabels.length > 1 ? `${sourceLabels.length} sources` : base.source_label,
    } satisfies EnrichedHolding;
  });

  const totalValue = aggregated.reduce((sum, holding) => sum + holding.valueUsd, 0);
  return aggregated
    .map((holding) => ({
      ...holding,
      allocationPercent: totalValue ? (holding.valueUsd / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export function getHoldingUnits(holding: Pick<Holding, "asset_type" | "quantity" | "lot_size">) {
  const lotSize = holding.lot_size ?? (holding.asset_type === "tw_stock" ? 1000 : 1);
  return holding.quantity * Math.max(1, lotSize);
}

export function getInvestmentPerformance(
  holdings: EnrichedHolding[],
  transactions: InvestmentTransaction[],
  fx: CurrencyFxInput,
): InvestmentPerformance {
  const investmentHoldings = holdings.filter((holding) => holding.asset_type !== "cash");
  const knownHoldings = investmentHoldings.filter((holding) => holding.gainKnown);
  const sales = transactions.filter((transaction) => transaction.transaction_type === "sell");
  const knownSales = sales.filter(
    (transaction) => transaction.realized_gain !== null && transaction.cost_basis !== null,
  );

  const unrealizedGainUsd = knownHoldings.reduce((sum, holding) => sum + holding.gainUsd, 0);
  const currentCostUsd = knownHoldings.reduce((sum, holding) => sum + holding.costBasisUsd, 0);
  const realizedGainUsd = knownSales.reduce(
    (sum, transaction) => sum + currencyAmountToUsd(transaction.realized_gain ?? 0, transaction.currency, fx),
    0,
  );
  const soldCostUsd = knownSales.reduce(
    (sum, transaction) => sum + currencyAmountToUsd(transaction.cost_basis ?? 0, transaction.currency, fx),
    0,
  );
  const trackedCostUsd = currentCostUsd + soldCostUsd;
  const cumulativeGainUsd = unrealizedGainUsd + realizedGainUsd;
  const dates = [
    ...investmentHoldings.map((holding) => holding.created_at),
    ...transactions.map((transaction) => transaction.transaction_date),
  ].filter(Boolean).sort();

  return {
    realizedGainUsd,
    unrealizedGainUsd,
    cumulativeGainUsd,
    trackedCostUsd,
    cumulativeReturnPercent: trackedCostUsd ? (cumulativeGainUsd / trackedCostUsd) * 100 : 0,
    hasPerformanceData: knownHoldings.length > 0 || knownSales.length > 0,
    knownSaleCount: knownSales.length,
    saleCount: sales.length,
    startedAt: dates[0] ?? null,
  };
}

export function groupBy<T extends string>(
  holdings: EnrichedHolding[],
  getKey: (holding: EnrichedHolding) => T,
) {
  const totals = holdings.reduce<Record<T, number>>((acc, holding) => {
    const key = getKey(holding);
    acc[key] = (acc[key] ?? 0) + holding.valueUsd;
    return acc;
  }, {} as Record<T, number>);

  return Object.entries(totals)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value);
}

function fallbackPriceUsd(holding: Holding, fx: CurrencyFxInput) {
  if (holding.asset_type === "cash") {
    const symbol = holding.symbol.toUpperCase();
    const cashCurrency = (supportedCurrencies as readonly string[]).includes(symbol)
      ? symbol as Currency
      : holding.cost_currency;
    return currencyAmountToUsd(1, cashCurrency, fx);
  }
  return currencyAmountToUsd(holding.average_cost, holding.cost_currency, fx);
}

export type CurrencyBuckets = Record<Currency, number>;

export type MonthlyCashflowOverview = {
  income: CurrencyBuckets;
  expenses: CurrencyBuckets;
  recurring: CurrencyBuckets;
  debtPayments: CurrencyBuckets;
  leftover: CurrencyBuckets;
  pressureRatio: number;
};

export function parseDateOnly(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`);
}

export function isSameMonth(dateValue: string) {
  const date = parseDateOnly(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function emptyCurrencyBuckets(): CurrencyBuckets {
  return supportedCurrencies.reduce((acc, currency) => {
    acc[currency] = 0;
    return acc;
  }, {} as CurrencyBuckets);
}

export function currencyBucketTotal(values: CurrencyBuckets) {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

export function currencyAmountToUsd(value: number, currency: Currency, fxInput: CurrencyFxInput) {
  const fallback = {
    twdToUsd: 1 / 32,
    eurToUsd: 1 / 0.92,
    jpyToUsd: 1 / 157,
    krwToUsd: 1 / 1380,
  };
  const fx = typeof fxInput === "number"
    ? { ...fallback, twdToUsd: fxInput }
    : { ...fallback, ...fxInput };

  if (typeof fxInput !== "number") {
    const usdRate = fxInput.usdRates?.[currency];
    if (usdRate && usdRate > 0) return value / usdRate;
  }

  if (currency === "TWD") return value * fx.twdToUsd;
  if (currency === "EUR") return value * fx.eurToUsd;
  if (currency === "JPY") return value * fx.jpyToUsd;
  if (currency === "KRW") return value * fx.krwToUsd;
  return value;
}

export function currencyBucketsToUsd(values: CurrencyBuckets, fxInput: CurrencyFxInput) {
  return (Object.entries(values) as Array<[Currency, number]>).reduce(
    (sum, [currency, value]) => sum + currencyAmountToUsd(value, currency, fxInput),
    0,
  );
}

export const currencySymbols: Record<Currency, string> = {
  USD: "$",
  TWD: "NT$",
  EUR: "€",
  JPY: "¥",
  KRW: "₩",
  HKD: "HK$",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  SGD: "S$",
  CNY: "CN¥",
  CHF: "CHF",
  INR: "₹",
  SAR: "SAR",
};

export function usdToCurrency(valueUsd: number, currency: Currency, fxInput: CurrencyFxInput) {
  const fallback = {
    usdToTwd: 32,
    usdToEur: 0.92,
    usdToJpy: 157,
    usdToKrw: 1380,
  };
  const fx = typeof fxInput === "number"
    ? { ...fallback, usdToTwd: fxInput > 0 ? 1 / fxInput : fallback.usdToTwd }
    : { ...fallback, ...fxInput };

  if (typeof fxInput !== "number") {
    const usdRate = fxInput.usdRates?.[currency];
    if (usdRate && usdRate > 0) return valueUsd * usdRate;
  }

  if (currency === "TWD") return valueUsd * fx.usdToTwd;
  if (currency === "EUR") return valueUsd * fx.usdToEur;
  if (currency === "JPY") return valueUsd * fx.usdToJpy;
  if (currency === "KRW") return valueUsd * fx.usdToKrw;
  return valueUsd;
}

export function formatUsdIn(valueUsd: number, displayCurrency: Currency, fxInput: CurrencyFxInput) {
  return formatCurrency(usdToCurrency(valueUsd, displayCurrency, fxInput), displayCurrency);
}

export function convertAmount(value: number, fromCurrency: Currency, displayCurrency: Currency, fxInput: CurrencyFxInput) {
  if (fromCurrency === displayCurrency) return value;
  return usdToCurrency(currencyAmountToUsd(value, fromCurrency, fxInput), displayCurrency, fxInput);
}

export function getMonthlyCashflowOverview(
  transactions: CashflowTransaction[],
  recurringExpenses: RecurringExpense[],
  debts: Debt[],
): MonthlyCashflowOverview {
  const income = emptyCurrencyBuckets();
  const expenses = emptyCurrencyBuckets();
  const recurring = emptyCurrencyBuckets();
  const debtPayments = emptyCurrencyBuckets();

  transactions.forEach((transaction) => {
    if (transaction.transaction_type === "income") {
      income[transaction.currency] += transaction.amount;
    } else {
      expenses[transaction.currency] += transaction.amount;
    }
  });

  recurringExpenses.forEach((expense) => {
    const monthlyAmount = expense.frequency === "monthly" ? expense.amount : expense.amount / 12;
    recurring[expense.currency] += monthlyAmount;
  });

  debts.forEach((debt) => {
    debtPayments[debt.currency] += debt.minimum_payment;
  });

  const leftover = emptyCurrencyBuckets();
  (Object.keys(leftover) as Currency[]).forEach((currency) => {
    leftover[currency] = income[currency] - expenses[currency] - recurring[currency] - debtPayments[currency];
  });

  const incomeTotal = currencyBucketTotal(income);
  const fixedTotal = currencyBucketTotal(recurring) + currencyBucketTotal(debtPayments);

  return {
    income,
    expenses,
    recurring,
    debtPayments,
    leftover,
    pressureRatio: incomeTotal > 0 ? (fixedTotal / incomeTotal) * 100 : 0,
  };
}

export function formatHealthRatio(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}

export function buildFinancialHealthNotes({
  dataIssues,
  debtIncomeRatio,
  fixedPressure,
  incomeUsd,
  locale,
  overBudgetCount,
  savingsRate,
  subscriptionsToReviewCount,
  unknownCostCount,
}: {
  dataIssues: number;
  debtIncomeRatio: number | null;
  fixedPressure: number | null;
  incomeUsd: number;
  locale: Locale;
  overBudgetCount: number;
  savingsRate: number | null;
  subscriptionsToReviewCount: number;
  unknownCostCount: number;
}) {
  const zh = locale === "zh";
  const notes: string[] = [];

  if (incomeUsd <= 0) {
    notes.push(tx(locale, "Add this month's income so savings rate, fixed pressure, and debt-to-income become meaningful."));
  }
  if (savingsRate !== null && savingsRate < 0) {
    notes.push(tx(locale, "Estimated leftover is negative after expenses, recurring bills, and debt minimums."));
  } else if (savingsRate !== null && savingsRate < 10) {
    notes.push(tx(locale, "Savings rate is low. Start by reviewing recurring costs or over-budget categories."));
  }
  if (fixedPressure !== null && fixedPressure > 70) {
    notes.push(tx(locale, "Fixed-cost pressure is high; recurring bills and debt minimums are taking a large share of income."));
  }
  if (debtIncomeRatio !== null && debtIncomeRatio > 36) {
    notes.push(tx(locale, "Debt-to-income is elevated. Review high-interest debts and minimum payment plans first."));
  }
  if (overBudgetCount > 0) {
    notes.push(zh ? `目前有 ${overBudgetCount} 個預算分類超支。` : `${overBudgetCount} budget categories are currently over budget.`);
  }
  if (subscriptionsToReviewCount > 0) {
    notes.push(zh ? `有 ${subscriptionsToReviewCount} 個訂閱或固定支出標記為少用/可取消。` : `${subscriptionsToReviewCount} subscriptions or recurring items are marked as rarely used or cancel candidates.`);
  }
  if (unknownCostCount > 0) {
    notes.push(zh ? `有 ${unknownCostCount} 筆資產成本未知，總損益與報酬率會不完整。` : `${unknownCostCount} holdings have unknown cost, so gain/loss and return are incomplete.`);
  }
  if (dataIssues > unknownCostCount) {
    notes.push(tx(locale, "Some holdings are missing price data, so total value may be understated or incomplete."));
  }
  if (!notes.length) {
    notes.push(tx(locale, "No major warnings right now. Keep income, spending, budgets, and cost basis updated to improve this view."));
  }

  return notes;
}
