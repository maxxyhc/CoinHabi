import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/market/quotes";
import { buildPortfolioSnapshot } from "@/lib/portfolio-snapshot";
import type { Holding } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE = 1000;

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. It runs at
// 22:30 UTC, after the US close in both EST and EDT, so snapshot_date is the
// UTC date of the US trading session it captures.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cronSecret || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Snapshots are not configured on this server." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const holdings: Holding[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("holdings")
      .select("*")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    holdings.push(...(data as Holding[]));
    if (data.length < PAGE_SIZE) break;
  }

  // One quote fetch for every user's holdings: users overlap heavily on
  // symbols, and per-user fetches would multiply provider calls.
  let market;
  try {
    market = await getMarketSnapshot(holdings);
  } catch {
    // Without FX every non-USD value is wrong; skip the day rather than store it.
    return NextResponse.json({ error: "FX_UNAVAILABLE" }, { status: 503 });
  }

  const byUser = new Map<string, Holding[]>();
  for (const holding of holdings) {
    byUser.set(holding.user_id, [...(byUser.get(holding.user_id) ?? []), holding]);
  }
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const rows = [...byUser].map(([userId, userHoldings]) =>
    buildPortfolioSnapshot(userId, snapshotDate, userHoldings, market.quotes, market.fx),
  );

  const { error } = await admin
    .from("portfolio_snapshots")
    .upsert(rows, { onConflict: "user_id,snapshot_date" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    snapshotDate,
    users: rows.length,
    unpricedHoldings: rows.reduce((sum, row) => sum + row.unpriced_count, 0),
  });
}
