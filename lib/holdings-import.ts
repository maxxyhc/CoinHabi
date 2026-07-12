import type { AssetType, Currency } from "@/lib/types";

export type FieldKey = "asset_type" | "symbol" | "name" | "quantity" | "average_cost" | "cost_currency";

export type Mapping = Record<FieldKey, number | null>;

export type Candidate = {
  id: string;
  asset_type: AssetType;
  symbol: string;
  name: string;
  quantity: string;
  average_cost: string;
  cost_currency: Currency;
  include: boolean;
};

export const FIELD_ORDER: FieldKey[] = ["asset_type", "symbol", "name", "quantity", "average_cost", "cost_currency"];

export const fieldLabels: Record<FieldKey, { en: string; zh: string }> = {
  asset_type: { en: "Type", zh: "類型" },
  symbol: { en: "Symbol", zh: "代號" },
  name: { en: "Name", zh: "名稱" },
  quantity: { en: "Quantity", zh: "數量" },
  average_cost: { en: "Average cost", zh: "平均成本" },
  cost_currency: { en: "Currency", zh: "幣別" },
};

// Header alias tables (compared after normalizeHeader).
const fieldAliases: Record<FieldKey, string[]> = {
  asset_type: ["type", "assettype", "類型", "資產類型", "類別", "種類", "category"],
  symbol: ["symbol", "ticker", "代號", "股票代號", "代碼", "股號", "商品代號"],
  name: ["name", "名稱", "名字", "公司名稱", "資產名稱", "商品名稱", "description", "asset"],
  quantity: ["quantity", "qty", "shares", "units", "amount", "數量", "股數", "張數", "持有數量", "部位", "持股"],
  average_cost: ["averagecost", "avgcost", "cost", "price", "unitcost", "成本", "平均成本", "均價", "單價", "成本價", "買入價"],
  cost_currency: ["currency", "ccy", "幣別", "貨幣", "計價幣別", "幣種"],
};

const cryptoSymbolSet = new Set([
  "BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "DOT", "BNB", "AVAX", "MATIC",
  "POL", "LINK", "LTC", "BCH", "TRX", "ATOM", "UNI", "USDT", "USDC", "DAI", "TON", "SHIB",
]);

export function normalizeHeader(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s_\-/()（）]/g, "")
    .trim();
}

export function autoDetectMapping(headers: string[]): Mapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping = {} as Mapping;
  FIELD_ORDER.forEach((field) => {
    const aliases = fieldAliases[field];
    let matchedIndex: number | null = null;
    for (const alias of aliases) {
      const idx = normalized.findIndex((header, i) => !used.has(i) && header === alias);
      if (idx !== -1) {
        matchedIndex = idx;
        break;
      }
    }
    if (matchedIndex === null) {
      for (const alias of aliases) {
        const idx = normalized.findIndex(
          (header, i) => !used.has(i) && header.length > 0 && (header.includes(alias) || alias.includes(header)),
        );
        if (idx !== -1) {
          matchedIndex = idx;
          break;
        }
      }
    }
    if (matchedIndex !== null) used.add(matchedIndex);
    mapping[field] = matchedIndex;
  });
  return mapping;
}

export function inferAssetTypeFromSymbol(symbol: string): AssetType {
  const upper = symbol.trim().toUpperCase();
  if (/\.(TW|TWO)$/.test(upper)) return "tw_stock";
  if (["USD", "TWD", "NTD", "CASH", "現金"].includes(upper)) return "cash";
  if (cryptoSymbolSet.has(upper)) return "crypto";
  if (/^\d{4,6}$/.test(upper)) return "tw_stock"; // Taiwan tickers are numeric codes
  return "us_stock";
}

export function parseAssetType(raw: string, symbol: string): AssetType {
  const value = normalizeHeader(raw);
  const matches = (tokens: string[]) => tokens.some((token) => value === normalizeHeader(token));
  if (matches(["tw_stock", "twstock", "tw", "台股", "台灣股票", "上市", "上櫃"])) return "tw_stock";
  if (matches(["us_stock", "usstock", "us", "美股", "美國股票"])) return "us_stock";
  if (matches(["crypto", "加密", "加密貨幣", "虛擬貨幣", "coin", "cryptocurrency", "數位貨幣"])) return "crypto";
  if (matches(["cash", "現金", "存款", "現金部位"])) return "cash";
  return inferAssetTypeFromSymbol(symbol);
}

export function parseCurrency(raw: string, assetType: AssetType): Currency {
  const value = normalizeHeader(raw);
  if (["usd", "us", "美元", "美金", "dollar", "usdollar"].includes(value)) return "USD";
  if (["twd", "ntd", "nt", "台幣", "新台幣", "元"].includes(value)) return "TWD";
  if (["eur", "euro", "歐元", "欧元", "ユーロ", "유로"].includes(value)) return "EUR";
  if (["jpy", "yen", "日圓", "日元", "円", "엔"].includes(value)) return "JPY";
  if (["krw", "won", "韓元", "韩元", "ウォン", "원"].includes(value)) return "KRW";
  return assetType === "tw_stock" ? "TWD" : "USD";
}

export function parseNumericString(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).replace(/[,$\s]|NT\$|US\$/gi, "").trim();
}

export function cellAt(row: unknown[], index: number | null): string {
  if (index === null || index < 0) return "";
  const value = row[index];
  return value === null || value === undefined ? "" : String(value).trim();
}

export function buildCandidates(dataRows: unknown[][], mapping: Mapping): Candidate[] {
  return dataRows
    .map((row, rowIndex) => {
      const symbolRaw = cellAt(row, mapping.symbol);
      const typeRaw = cellAt(row, mapping.asset_type);
      const asset_type = parseAssetType(typeRaw, symbolRaw);
      const nameRaw = cellAt(row, mapping.name);
      const currencyRaw = cellAt(row, mapping.cost_currency);
      return {
        id: `row-${rowIndex}`,
        asset_type,
        symbol: symbolRaw.toUpperCase(),
        name: nameRaw || symbolRaw.toUpperCase(),
        quantity: parseNumericString(cellAt(row, mapping.quantity)),
        average_cost: parseNumericString(cellAt(row, mapping.average_cost)),
        cost_currency: parseCurrency(currencyRaw, asset_type),
        include: true,
      } satisfies Candidate;
    })
    .filter(
      (candidate) => candidate.symbol.length > 0 || candidate.quantity.length > 0 || candidate.average_cost.length > 0,
    );
}

export function candidateIsValid(candidate: Candidate): boolean {
  if (!candidate.symbol.trim()) return false;
  const quantity = Number(candidate.quantity);
  const cost = Number(candidate.average_cost);
  if (candidate.quantity === "" || !Number.isFinite(quantity) || quantity < 0) return false;
  if (candidate.average_cost === "" || !Number.isFinite(cost) || cost < 0) return false;
  return true;
}
