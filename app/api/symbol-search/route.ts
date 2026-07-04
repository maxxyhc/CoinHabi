import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/market/finnhub";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchSymbols(query);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Symbol search is temporarily unavailable.";
    const status = message.includes("FINNHUB_API_KEY") ? 503 : 502;
    return NextResponse.json({ results: [], error: message }, { status });
  }
}
