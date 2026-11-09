import { NextResponse } from "next/server";
import { addDays, buildEarningsWeek, fetchEarningsCalendar } from "@/lib/market/earnings";

// POST so the user's holdings travel in the body, not the URL.
export async function POST(request: Request) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FINNHUB_API_KEY is not configured." }, { status: 503 });
  }

  const { weekStart, symbols = [] } = (await request.json()) as { weekStart?: string; symbols?: string[] };
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || new Date(`${weekStart}T00:00:00Z`).getUTCDay() !== 1) {
    return NextResponse.json({ error: "weekStart must be a Monday (YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    const rows = await fetchEarningsCalendar(weekStart, addDays(weekStart, 4), apiKey);
    return NextResponse.json(buildEarningsWeek(rows, weekStart, symbols));
  } catch {
    return NextResponse.json({ error: "Earnings calendar is unavailable." }, { status: 502 });
  }
}
