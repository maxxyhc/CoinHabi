import { NextResponse } from "next/server";
import { fetchCompanyNews } from "@/lib/market/news";

// Finnhub's free tier allows 60 calls a minute; one call per symbol.
const MAX_SYMBOLS = 15;

export async function POST(request: Request) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FINNHUB_API_KEY is not configured." }, { status: 503 });
  }

  const { stocks = [] } = (await request.json()) as { stocks?: Array<{ symbol: string; name: string }> };
  const unique = [...new Map(stocks.map((stock) => [stock.symbol.toUpperCase(), stock.name])).entries()].slice(0, MAX_SYMBOLS);
  const results = await Promise.all(unique.map(([symbol, name]) => fetchCompanyNews(symbol, name, apiKey)));

  // The same story is often tagged to several holdings (e.g. NVDA and TSLA in
  // one market wrap); show it once, under the first holding it was found for.
  const seen = new Set<string>();
  const items = results.flat().filter((item) => {
    const key = item.headline.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ items: items.sort((a, b) => b.datetime - a.datetime) });
}
