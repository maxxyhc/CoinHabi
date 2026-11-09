export type DailyCloses = {
  currency: string;
  /** Exchange-local trading date (YYYY-MM-DD) → close in `currency`. */
  closes: Map<string, number>;
};

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: { currency?: string; gmtoffset?: number };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

export async function fetchDailyCloses(symbol: string, range = "1y"): Promise<DailyCloses | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
      { next: { revalidate: 60 * 60 }, signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) return null;
    const result = ((await response.json()) as YahooChart).chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const rawCloses = result?.indicators?.quote?.[0]?.close ?? [];
    // Timestamps are the session open in UTC; shifting by the exchange offset
    // keeps Asian sessions on their own calendar day instead of the day before.
    const offset = result?.meta?.gmtoffset ?? 0;
    const closes = new Map<string, number>();
    timestamps.forEach((timestamp, index) => {
      const close = rawCloses[index];
      if (typeof close === "number" && close > 0) {
        closes.set(new Date((timestamp + offset) * 1000).toISOString().slice(0, 10), close);
      }
    });
    if (!closes.size) return null;
    const isTaiwan = symbol.endsWith(".TW") || symbol.endsWith(".TWO");
    return { currency: (isTaiwan ? "TWD" : result?.meta?.currency ?? "USD").toUpperCase(), closes };
  } catch {
    return null;
  }
}
