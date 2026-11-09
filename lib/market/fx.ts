import { supportedCurrencies, type MarketResponse } from "../types";

export type FxRates = MarketResponse["fx"];
export const FX_CACHE_KEY = "coinhabi.fx.v1";
export const FX_MAX_AGE_MS = 36 * 60 * 60 * 1000;

/** Validate persisted/provider data before it can affect portfolio valuation. */
export function parseFxCache(value: unknown, now = Date.now()): FxRates | null {
  if (!value || typeof value !== "object") return null;
  const data = value as FxRates;
  const updated = Date.parse(data.updatedAt ?? "");
  if (!Number.isFinite(updated) || updated > now + 5 * 60 * 1000) return null;
  if (!data.usdRates || data.usdRates.USD !== 1) return null;
  for (const currency of supportedCurrencies) {
    const rate = data.usdRates[currency];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
  }
  const rates = Object.fromEntries(supportedCurrencies.map((currency) => [currency, data.usdRates[currency]!])) as Record<string, number>;
  return {
    usdRates: rates,
    usdToTwd: rates.TWD, twdToUsd: 1 / rates.TWD,
    usdToEur: rates.EUR, eurToUsd: 1 / rates.EUR,
    usdToJpy: rates.JPY, jpyToUsd: 1 / rates.JPY,
    usdToKrw: rates.KRW, krwToUsd: 1 / rates.KRW,
    updatedAt: new Date(updated).toISOString(),
    source: "ExchangeRate-API",
    status: "cached",
  };
}

let lastSuccessfulFx: FxRates | null = null;

export async function fetchFxRates(fallback?: unknown): Promise<FxRates> {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("FX request failed");
    const data = await response.json();
    if (data.result !== "success" || data.base_code !== "USD" || typeof data.time_last_update_unix !== "number") {
      throw new Error("Invalid FX response");
    }
    const parsed = parseFxCache({ usdRates: data.rates, updatedAt: new Date(data.time_last_update_unix * 1000).toISOString() });
    if (!parsed) throw new Error("Incomplete FX rates");
    lastSuccessfulFx = parsed;
    return { ...parsed, status: Date.now() - Date.parse(parsed.updatedAt!) > FX_MAX_AGE_MS ? "cached" : "fresh" };
  } catch {
    const candidates = [parseFxCache(lastSuccessfulFx), parseFxCache(fallback)].filter((entry): entry is FxRates => entry !== null);
    candidates.sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!));
    if (candidates[0]) return { ...candidates[0], status: "cached" };
    throw new Error("FX_UNAVAILABLE");
  }
}
