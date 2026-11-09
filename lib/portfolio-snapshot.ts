import { enrichHoldings, getHoldingUnits } from "@/lib/calculations";
import type { Holding, MarketQuote, MarketResponse } from "@/lib/types";

export function buildPortfolioSnapshot(
  userId: string,
  snapshotDate: string,
  holdings: Holding[],
  quotes: Record<string, MarketQuote>,
  fx: MarketResponse["fx"],
) {
  const enriched = enrichHoldings(holdings, quotes, fx);
  let investmentValue = 0;
  let cashValue = 0;
  let costBasis = 0;
  let unpriced = 0;

  const rows = enriched.map((holding) => {
    const isCash = holding.asset_type === "cash";
    const priced = Boolean(holding.quote);
    if (isCash) cashValue += holding.valueUsd;
    else investmentValue += holding.valueUsd;
    costBasis += holding.costBasisUsd;
    if (!priced) unpriced += 1;
    return {
      id: holding.id,
      symbol: holding.symbol.toUpperCase(),
      asset_type: holding.asset_type,
      units: getHoldingUnits(holding),
      value_usd: holding.valueUsd,
      cost_basis_usd: holding.costBasisUsd,
      priced,
    };
  });

  return {
    user_id: userId,
    snapshot_date: snapshotDate,
    total_value_usd: investmentValue + cashValue,
    investment_value_usd: investmentValue,
    cash_value_usd: cashValue,
    cost_basis_usd: costBasis,
    unpriced_count: unpriced,
    holdings: rows,
    usd_rates: fx.usdRates,
  };
}
