import type { DailyCloses } from "@/lib/market/history";

// Replays today's positions over past prices: "how would what I hold now have
// done?" It needs no trade dates, which most users cannot supply, and is not
// the user's realised performance (that comes from portfolio_snapshots).

export type BacktestPosition = { symbol: string; units: number; history: DailyCloses | null };

export type BacktestStats = { totalReturn: number; maxDrawdown: number; volatility: number | null };

export type BacktestResult = {
  points: Array<{ date: string; portfolio: number } & Record<string, number | string>>;
  portfolio: BacktestStats;
  benchmarks: Record<string, BacktestStats>;
  excluded: string[];
};

// A position whose history starts this long after the window opens (recent
// IPO, new coin, unknown symbol) is dropped rather than shrinking the window
// for everything else.
const LATE_START_DAYS = 14;

export function runBacktest(
  positions: BacktestPosition[],
  benchmarks: Record<string, DailyCloses | null>,
  usdRates: Record<string, DailyCloses | null>,
): BacktestResult | null {
  const rateFor = (currency: string) => currency === "USD" ? null : usdRates[currency];
  const usable = (history: DailyCloses | null): history is DailyCloses =>
    Boolean(history) && (history!.currency === "USD" || Boolean(rateFor(history!.currency)));

  const held = positions.filter((position) => position.units > 0);
  const candidates = held.filter((position) => usable(position.history));
  if (!candidates.length) return null;

  const firstDates = candidates.map((position) => [...position.history!.closes.keys()].sort()[0]);
  const windowOpen = firstDates.reduce((earliest, date) => date < earliest ? date : earliest);
  const cutoff = shiftDays(windowOpen, LATE_START_DAYS);
  const included = candidates.filter((_, index) => firstDates[index] <= cutoff);
  const includedSet = new Set(included);
  const excluded = held.filter((position) => !includedSet.has(position)).map((position) => position.symbol);

  const start = included.reduce((latest, position) => {
    const first = [...position.history!.closes.keys()].sort()[0];
    return first > latest ? first : latest;
  }, windowOpen);
  const dates = [...new Set(included.flatMap((position) => [...position.history!.closes.keys()]))]
    .filter((date) => date >= start)
    .sort();
  if (dates.length < 2) return null;

  const usdSeries = (history: DailyCloses) => {
    const closes = alignTo(dates, history.closes);
    const rate = rateFor(history.currency);
    if (!rate) return closes;
    const rates = alignTo(dates, rate.closes);
    return closes.map((close, index) => close / rates[index]);
  };

  const positionSeries = included.map((position) => usdSeries(position.history!).map((price) => price * position.units));
  const portfolioValues = dates.map((_, index) => positionSeries.reduce((sum, series) => sum + series[index], 0));
  const benchmarkValues = Object.fromEntries(
    Object.entries(benchmarks)
      .filter((entry): entry is [string, DailyCloses] => usable(entry[1]))
      .map(([name, history]) => [name, usdSeries(history)]),
  );

  const points = dates.map((date, index) => ({
    date,
    portfolio: percentFromStart(portfolioValues, index),
    ...Object.fromEntries(Object.entries(benchmarkValues).map(([name, values]) => [name, percentFromStart(values, index)])),
  }));

  return {
    points,
    portfolio: stats(dates, portfolioValues),
    benchmarks: Object.fromEntries(Object.entries(benchmarkValues).map(([name, values]) => [name, stats(dates, values)])),
    excluded,
  };
}

/**
 * Forward-fills `series` onto `dates` (both sorted ascending). Markets close on
 * different days, so each value is the last close on or before that date;
 * before a series' first observation its first close stands in.
 */
function alignTo(dates: string[], series: Map<string, number>) {
  const entries = [...series].sort((a, b) => a[0].localeCompare(b[0]));
  let cursor = 0;
  let current = entries[0][1];
  return dates.map((date) => {
    while (cursor < entries.length && entries[cursor][0] <= date) {
      current = entries[cursor][1];
      cursor += 1;
    }
    return current;
  });
}

function percentFromStart(values: number[], index: number) {
  return (values[index] / values[0] - 1) * 100;
}

function stats(dates: string[], values: number[]): BacktestStats {
  let peak = values[0];
  let maxDrawdown = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    maxDrawdown = Math.min(maxDrawdown, value / peak - 1);
  }

  const returns = values.slice(1).map((value, index) => Math.log(value / values[index]));
  const years = (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / (365.25 * 86400000);
  let volatility: number | null = null;
  if (returns.length >= 20 && years > 0) {
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
    // Observations per year comes from the data, not a fixed 252: the axis is
    // the union of every position's trading days, so crypto adds weekends.
    volatility = Math.sqrt(variance * (returns.length / years)) * 100;
  }

  return { totalReturn: percentFromStart(values, values.length - 1), maxDrawdown: maxDrawdown * 100, volatility };
}

function shiftDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}
