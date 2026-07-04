import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/market/quotes";
import type { Holding } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { holdings?: Holding[] };
  const holdings = body.holdings ?? [];
  const snapshot = await getMarketSnapshot(holdings);
  return NextResponse.json(snapshot);
}
