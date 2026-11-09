export type EarningsRow = {
  symbol: string;
  date: string;
  /** "bmo" before open, "amc" after close, "" when the company has not said. */
  hour: string;
  quarter: number;
  year: number;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
};

export type EarningsEntry = Pick<EarningsRow, "symbol" | "quarter" | "year" | "epsEstimate" | "epsActual"> & { held: boolean };

export type EarningsDay = { date: string; beforeOpen: EarningsEntry[]; afterClose: EarningsEntry[] };

export type EarningsWeek = {
  days: EarningsDay[];
  /** Holdings reporting this week, including those with no announced session. */
  held: Array<EarningsEntry & { date: string; hour: string }>;
  total: number;
};

// Finnhub lists ~1,300 reporters a week. Rank by revenue estimate as a size
// proxy (it carries no market cap) and keep the top of each session. Foreign
// filers report revenue in their own currency, so a few ADRs rank high; that
// matches how such calendars are usually curated anyway.
export const PER_SESSION = 15;

export function buildEarningsWeek(rows: EarningsRow[], weekStart: string, heldSymbols: string[], perSession = PER_SESSION): EarningsWeek {
  const held = new Set(heldSymbols.map((symbol) => symbol.toUpperCase()));
  const dates = Array.from({ length: 5 }, (_, index) => addDays(weekStart, index));
  const inWeek = rows.filter((row) => dates.includes(row.date));
  const byRevenue = (a: EarningsRow, b: EarningsRow) => (b.revenueEstimate ?? -1) - (a.revenueEstimate ?? -1);
  const entry = (row: EarningsRow): EarningsEntry => ({
    symbol: row.symbol,
    quarter: row.quarter,
    year: row.year,
    epsEstimate: row.epsEstimate,
    epsActual: row.epsActual,
    held: held.has(row.symbol),
  });
  // Holdings are added on top of the cut rather than taking one of its slots.
  const session = (date: string, hour: string) => {
    const ranked = inWeek.filter((row) => row.date === date && row.hour === hour).sort(byRevenue);
    return [
      ...ranked.filter((row) => held.has(row.symbol)),
      ...ranked.filter((row) => !held.has(row.symbol)).slice(0, perSession),
    ].map(entry);
  };

  const days = dates.map((date) => ({ date, beforeOpen: session(date, "bmo"), afterClose: session(date, "amc") }));
  return {
    days,
    held: inWeek.filter((row) => held.has(row.symbol)).sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({ ...entry(row), date: row.date, hour: row.hour })),
    total: days.reduce((sum, day) => sum + day.beforeOpen.length + day.afterClose.length, 0),
  };
}

export async function fetchEarningsCalendar(from: string, to: string, apiKey: string): Promise<EarningsRow[]> {
  const url = new URL("https://finnhub.io/api/v1/calendar/earnings");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("token", apiKey);
  const response = await fetch(url, { next: { revalidate: 60 * 60 }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Finnhub earnings calendar failed: ${response.status}`);
  return ((await response.json()) as { earningsCalendar?: EarningsRow[] }).earningsCalendar ?? [];
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
