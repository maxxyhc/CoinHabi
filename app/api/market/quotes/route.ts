import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/market/quotes";
import type { Holding } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { holdings?: Holding[]; cachedFx?: unknown };
  const holdings = body.holdings ?? [];
  try {
    const snapshot = await getMarketSnapshot(holdings, body.cachedFx);
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json({ error: "FX_UNAVAILABLE" }, { status: 503 });
  }
}
