export type NewsItem = {
  id: number;
  symbol: string;
  headline: string;
  source: string;
  url: string;
  datetime: number;
};

type FinnhubNews = { id: number; headline: string; summary: string; source: string; url: string; datetime: number };

const PER_SYMBOL = 5;

// Finnhub tags ~250 articles a week to a large cap, many of them listicles
// ("3 dividend stocks to buy") that merely list the ticker. Keep an article only
// when its headline or summary names the company itself.
export function mentions(article: Pick<FinnhubNews, "headline" | "summary">, symbol: string, name: string) {
  const nameWord = name.split(/[\s,.]+/)[0];
  const terms = [symbol, ...(nameWord.length >= 3 ? [nameWord] : [])]
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${terms.join("|")})\\b`, "i").test(`${article.headline} ${article.summary}`);
}

export async function fetchCompanyNews(symbol: string, name: string, apiKey: string): Promise<NewsItem[]> {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86400000);
  const url = new URL("https://finnhub.io/api/v1/company-news");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("from", from.toISOString().slice(0, 10));
  url.searchParams.set("to", to.toISOString().slice(0, 10));
  url.searchParams.set("token", apiKey);

  try {
    const response = await fetch(url, { next: { revalidate: 15 * 60 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const articles = (await response.json()) as FinnhubNews[];
    return articles
      .filter((article) => article.headline && article.url && mentions(article, symbol, name))
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, PER_SYMBOL)
      .map(({ id, headline, source, url: link, datetime }) => ({ id, symbol, headline, source, url: link, datetime }));
  } catch {
    return [];
  }
}
