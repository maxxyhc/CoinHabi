import { NextResponse } from "next/server";
import { searchCryptoAssets } from "@/lib/market/coingecko";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchCryptoAssets(query);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "Crypto search is temporarily unavailable." }, { status: 502 });
  }
}
