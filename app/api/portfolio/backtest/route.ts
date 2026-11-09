import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";
import { getHoldingUnits } from "@/lib/calculations";
import { fetchDailyCloses } from "@/lib/market/history";
import type { Holding } from "@/lib/types";

export const runtime = "nodejs";

const BENCHMARKS = { SPY: "SPY", "0050": "0050.TW" };

function yahooSymbol(holding: Holding) {
  const symbol = holding.symbol.toUpperCase();
  return holding.asset_type === "crypto" ? `${symbol}-USD` : symbol;
}

export async function POST(request: Request) {
  const { holdings = [] } = (await request.json()) as { holdings?: Holding[] };
  const investments = holdings.filter((holding) => holding.asset_type !== "cash");

  const symbols = [...new Set([...investments.map(yahooSymbol), ...Object.values(BENCHMARKS)])];
  const histories = new Map(await Promise.all(symbols.map(async (symbol) => [symbol, await fetchDailyCloses(symbol)] as const)));

  const currencies = [...new Set([...histories.values()].flatMap((history) => history && history.currency !== "USD" ? [history.currency] : []))];
  // Yahoo's "TWD=X" quotes TWD per USD, the same orientation as usdRates.
  const usdRates = Object.fromEntries(await Promise.all(currencies.map(async (currency) => [currency, await fetchDailyCloses(`${currency}=X`)] as const)));

  const result = runBacktest(
    investments.map((holding) => ({
      symbol: holding.symbol.toUpperCase(),
      units: getHoldingUnits(holding),
      history: histories.get(yahooSymbol(holding)) ?? null,
    })),
    Object.fromEntries(Object.entries(BENCHMARKS).map(([name, symbol]) => [name, histories.get(symbol) ?? null])),
    usdRates,
  );

  return NextResponse.json(result);
}
