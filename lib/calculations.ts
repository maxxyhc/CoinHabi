import type { EnrichedHolding, Holding, MarketQuote } from "@/lib/types";

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value > 1000 ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function enrichHoldings(
  holdings: Holding[],
  quotes: Record<string, MarketQuote>,
  twdToUsd: number,
): EnrichedHolding[] {
  const enriched = holdings.map((holding) => {
    const symbol = holding.symbol.toUpperCase();
    const quote = quotes[symbol];
    const priceUsd = quote?.priceUsd ?? fallbackPriceUsd(holding, twdToUsd);
    const costUsd = holding.cost_currency === "TWD" ? holding.average_cost * twdToUsd : holding.average_cost;
    const valueUsd = holding.quantity * priceUsd;
    const costBasisUsd = holding.quantity * costUsd;
    const gainUsd = valueUsd - costBasisUsd;
    const gainPercent = costBasisUsd ? (gainUsd / costBasisUsd) * 100 : 0;
    const dayChangeRate = quote ? quote.dayChangePercent / 100 : 0;
    const dayChangeUsd = dayChangeRate === -1 ? 0 : valueUsd - valueUsd / (1 + dayChangeRate);

    return {
      ...holding,
      quote,
      valueUsd,
      costBasisUsd,
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
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costBasisUsd, 0);
  const totalGain = totalValue - totalCost;
  const totalReturn = totalCost ? (totalGain / totalCost) * 100 : 0;
  const dayChange = holdings.reduce((sum, holding) => sum + holding.dayChangeUsd, 0);
  const dayChangePercent = totalValue ? (dayChange / totalValue) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalGain,
    totalReturn,
    dayChange,
    dayChangePercent,
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

function fallbackPriceUsd(holding: Holding, twdToUsd: number) {
  if (holding.asset_type === "cash") {
    return holding.symbol.toUpperCase() === "TWD" ? twdToUsd : 1;
  }
  return holding.cost_currency === "TWD" ? holding.average_cost * twdToUsd : holding.average_cost;
}
