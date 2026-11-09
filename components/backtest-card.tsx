"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BacktestResult } from "@/lib/backtest";
import type { EnrichedHolding, Locale } from "@/lib/types";

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  mine: string;
  spy: string;
  tw50: string;
  vsSpy: string;
  drawdown: string;
  drawdownDetail: (spy: string) => string;
  volatility: string;
  volatilityDetail: (spy: string) => string;
  points: string;
  verdict: (r: { ret: string; diff: string; beat: boolean; dd: string; ddRatio: string }) => string;
  excluded: (list: string, weight: string) => string;
  footnote: string;
  loading: string;
  empty: string;
  failed: string;
};

const copy: Record<Locale, Copy> = {
  en: {
    eyebrow: "Current portfolio backtest",
    title: "If you had held today's portfolio for the past year",
    subtitle: "Replays your current positions over the last 12 months of prices. This is how this mix behaved, not your actual P/L.",
    mine: "Your portfolio",
    spy: "S&P 500 (SPY)",
    tw50: "Taiwan 50 (0050)",
    vsSpy: "vs S&P 500",
    drawdown: "Max drawdown",
    drawdownDetail: (spy) => `S&P 500 ${spy}`,
    volatility: "Annualised volatility",
    volatilityDetail: (spy) => `S&P 500 ${spy}`,
    points: "pts",
    verdict: ({ ret, diff, beat, dd, ddRatio }) =>
      `Your current mix returned ${ret} over the past year, ${diff} points ${beat ? "ahead of" : "behind"} the S&P 500. At its worst it fell ${dd} from a peak, ${ddRatio}× the S&P 500's deepest drop.`,
    excluded: (list, weight) => `Not included (no full-year price history): ${list} · ${weight} of investments`,
    footnote: "Measured in USD with historical exchange rates. Excludes dividends and cash.",
    loading: "Loading a year of prices…",
    empty: "Add investment holdings to see how this mix performed.",
    failed: "Price history is unavailable right now.",
  },
  zh: {
    eyebrow: "目前組合回測",
    title: "如果過去一年都抱著現在這些持倉",
    subtitle: "用過去 12 個月的股價重算你目前的部位，呈現的是「這個組合的表現」，不是你的實際損益。",
    mine: "你的組合",
    spy: "S&P 500 (SPY)",
    tw50: "台灣 50 (0050)",
    vsSpy: "相較 S&P 500",
    drawdown: "最大回撤",
    drawdownDetail: (spy) => `S&P 500 ${spy}`,
    volatility: "年化波動度",
    volatilityDetail: (spy) => `S&P 500 ${spy}`,
    points: "個百分點",
    verdict: ({ ret, diff, beat, dd, ddRatio }) =>
      `你目前的組合過去一年報酬 ${ret}，比 S&P 500 ${beat ? "多" : "少"} ${diff} 個百分點。最慘的時候曾從高點跌掉 ${dd}，是 S&P 500 最大跌幅的 ${ddRatio} 倍。`,
    excluded: (list, weight) => `未納入（沒有完整一年的價格）：${list} · 占投資部位 ${weight}`,
    footnote: "以美元計算並套用歷史匯率，不含股息與現金。",
    loading: "正在載入一年的價格…",
    empty: "新增投資持倉後，就能看到這個組合的歷史表現。",
    failed: "目前無法取得歷史價格。",
  },
  ja: {
    eyebrow: "現在のポートフォリオのバックテスト",
    title: "今の保有を過去1年間持ち続けていたら",
    subtitle: "現在のポジションを過去12か月の価格で再計算します。この組み合わせの値動きであり、実際の損益ではありません。",
    mine: "あなたのポートフォリオ",
    spy: "S&P 500 (SPY)",
    tw50: "台湾50 (0050)",
    vsSpy: "S&P 500 比",
    drawdown: "最大ドローダウン",
    drawdownDetail: (spy) => `S&P 500 ${spy}`,
    volatility: "年率ボラティリティ",
    volatilityDetail: (spy) => `S&P 500 ${spy}`,
    points: "pt",
    verdict: ({ ret, diff, beat, dd, ddRatio }) =>
      `現在の組み合わせの過去1年のリターンは ${ret}、S&P 500 を ${diff} ポイント${beat ? "上回り" : "下回り"}ました。最悪時は高値から ${dd} 下落し、S&P 500 の最大下落の ${ddRatio} 倍でした。`,
    excluded: (list, weight) => `対象外（1年分の価格なし）：${list} · 投資の ${weight}`,
    footnote: "過去の為替レートで米ドル換算。配当と現金は含みません。",
    loading: "1年分の価格を読み込み中…",
    empty: "投資の保有を追加すると、この組み合わせの過去の動きを確認できます。",
    failed: "現在、過去の価格を取得できません。",
  },
  ko: {
    eyebrow: "현재 포트폴리오 백테스트",
    title: "지난 1년 동안 지금의 보유 자산을 계속 들고 있었다면",
    subtitle: "현재 포지션을 지난 12개월 가격으로 다시 계산합니다. 이 조합의 움직임이며 실제 손익이 아닙니다.",
    mine: "내 포트폴리오",
    spy: "S&P 500 (SPY)",
    tw50: "대만 50 (0050)",
    vsSpy: "S&P 500 대비",
    drawdown: "최대 낙폭",
    drawdownDetail: (spy) => `S&P 500 ${spy}`,
    volatility: "연환산 변동성",
    volatilityDetail: (spy) => `S&P 500 ${spy}`,
    points: "%p",
    verdict: ({ ret, diff, beat, dd, ddRatio }) =>
      `현재 조합의 지난 1년 수익률은 ${ret}로 S&P 500보다 ${diff}%p ${beat ? "높았습니다" : "낮았습니다"}. 최악의 시점에는 고점 대비 ${dd} 하락했으며, S&P 500 최대 낙폭의 ${ddRatio}배입니다.`,
    excluded: (list, weight) => `제외됨(1년치 가격 없음): ${list} · 투자 자산의 ${weight}`,
    footnote: "과거 환율로 달러 환산했으며 배당과 현금은 제외합니다.",
    loading: "1년치 가격을 불러오는 중…",
    empty: "투자 자산을 추가하면 이 조합의 과거 성과를 볼 수 있습니다.",
    failed: "지금은 과거 가격을 불러올 수 없습니다.",
  },
  es: {
    eyebrow: "Backtest de tu cartera actual",
    title: "Si hubieras mantenido tu cartera actual durante el último año",
    subtitle: "Recalcula tus posiciones actuales con los precios de los últimos 12 meses. Muestra cómo se comportó esta combinación, no tu resultado real.",
    mine: "Tu cartera",
    spy: "S&P 500 (SPY)",
    tw50: "Taiwán 50 (0050)",
    vsSpy: "vs S&P 500",
    drawdown: "Caída máxima",
    drawdownDetail: (spy) => `S&P 500 ${spy}`,
    volatility: "Volatilidad anualizada",
    volatilityDetail: (spy) => `S&P 500 ${spy}`,
    points: "pts",
    verdict: ({ ret, diff, beat, dd, ddRatio }) =>
      `Tu combinación actual rindió ${ret} en el último año, ${diff} puntos ${beat ? "por encima" : "por debajo"} del S&P 500. En su peor momento cayó ${dd} desde un máximo, ${ddRatio} veces la mayor caída del S&P 500.`,
    excluded: (list, weight) => `No incluidos (sin un año de precios): ${list} · ${weight} de las inversiones`,
    footnote: "En USD con tipos de cambio históricos. Sin dividendos ni efectivo.",
    loading: "Cargando un año de precios…",
    empty: "Añade inversiones para ver cómo se comportó esta combinación.",
    failed: "El historial de precios no está disponible ahora.",
  },
};

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export function BacktestCard({ holdings, locale }: { holdings: EnrichedHolding[]; locale: Locale }) {
  const c = copy[locale];
  const investments = useMemo(() => holdings.filter((holding) => holding.asset_type !== "cash"), [holdings]);
  // Refetch only when positions change, not on every price refresh.
  const signature = investments.map((holding) => `${holding.asset_type}:${holding.symbol}:${holding.quantity}:${holding.lot_size ?? ""}`).sort().join("|");
  const [state, setState] = useState<{ signature: string; result: BacktestResult | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!signature) return;
    let cancelled = false;
    fetch("/api/portfolio/backtest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdings: investments }),
    })
      .then((response) => response.ok ? response.json() as Promise<BacktestResult | null> : Promise.reject(new Error(String(response.status))))
      .then((result) => { if (!cancelled) setState({ signature, result, failed: false }); })
      .catch(() => { if (!cancelled) setState({ signature, result: null, failed: true }); });
    return () => { cancelled = true; };
    // `investments` is captured for the request body; `signature` decides when to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const current = state?.signature === signature ? state : null;
  const result = current?.result ?? null;

  const status = !signature ? c.empty : !current ? c.loading : current.failed || !result ? c.failed : null;

  return (
    <section className="glass-panel apple-card p-5 sm:p-6">
      <p className="text-sm font-medium text-[var(--accent)]">{c.eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">{c.title}</h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-titanium">{c.subtitle}</p>
      {status ? (
        <div className="subtle-panel apple-card-sm mt-5 flex h-[280px] items-center justify-center p-6 text-center text-sm text-titanium">{status}</div>
      ) : result && <BacktestBody c={c} holdings={investments} locale={locale} result={result} />}
    </section>
  );
}

function BacktestBody({ c, holdings, locale, result }: { c: Copy; holdings: EnrichedHolding[]; locale: Locale; result: BacktestResult }) {
  const spy = result.benchmarks.SPY;
  const mine = result.portfolio;
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "short" });
  const excluded = [...new Set(result.excluded)];
  const investmentValue = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const excludedValue = holdings.filter((holding) => excluded.includes(holding.symbol.toUpperCase())).reduce((sum, holding) => sum + holding.valueUsd, 0);
  const lines = [
    { key: "portfolio", name: c.mine, color: "var(--accent)", width: 3 },
    { key: "SPY", name: c.spy, color: "rgb(var(--blue))", width: 1.5 },
    { key: "0050", name: c.tw50, color: "rgb(var(--mint))", width: 1.5 },
  ].filter((line) => line.key === "portfolio" || line.key in result.benchmarks);

  return (
    <>
      {spy && (
        <p className="mt-4 rounded-2xl bg-[var(--surface-muted)] p-4 text-sm leading-6 text-ink">
          {c.verdict({
            ret: signed(mine.totalReturn),
            diff: Math.abs(mine.totalReturn - spy.totalReturn).toFixed(1),
            beat: mine.totalReturn >= spy.totalReturn,
            dd: `${Math.abs(mine.maxDrawdown).toFixed(1)}%`,
            ddRatio: spy.maxDrawdown ? (mine.maxDrawdown / spy.maxDrawdown).toFixed(1) : "—",
          })}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={c.mine} value={signed(mine.totalReturn)} tone={mine.totalReturn >= 0 ? "up" : "down"} />
        {spy && <Stat label={c.vsSpy} value={`${mine.totalReturn - spy.totalReturn >= 0 ? "+" : ""}${(mine.totalReturn - spy.totalReturn).toFixed(1)}`} unit={c.points} tone={mine.totalReturn >= spy.totalReturn ? "up" : "down"} />}
        <Stat label={c.drawdown} value={`${mine.maxDrawdown.toFixed(1)}%`} detail={spy ? c.drawdownDetail(`${spy.maxDrawdown.toFixed(1)}%`) : undefined} />
        {mine.volatility !== null && <Stat label={c.volatility} value={`${mine.volatility.toFixed(1)}%`} detail={spy?.volatility != null ? c.volatilityDetail(`${spy.volatility.toFixed(1)}%`) : undefined} />}
      </div>
      <div className="mt-5 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={result.points} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={36} tickFormatter={(date: string) => monthFormat.format(new Date(`${date}T00:00:00`))} />
            <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(value: number) => `${value.toFixed(0)}%`} />
            <Tooltip
              formatter={(value: number, name: string) => [signed(value), name]}
              labelFormatter={(date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(locale)}
              contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--line, rgba(148,163,184,0.3))", borderRadius: 12 }}
            />
            {lines.map((line) => (
              <Line key={line.key} dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={line.width} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-titanium">
        {lines.map((line) => (
          <span key={line.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: line.color }} />
            {line.name}
          </span>
        ))}
      </div>
      {excluded.length > 0 && (
        <p className="mt-3 text-xs text-amber">
          {c.excluded(excluded.join(", "), `${investmentValue ? ((excludedValue / investmentValue) * 100).toFixed(1) : "0"}%`)}
        </p>
      )}
      <p className="mt-2 text-xs text-titanium">{c.footnote}</p>
    </>
  );
}

function Stat({ detail, label, tone, unit, value }: { detail?: string; label: string; tone?: "up" | "down"; unit?: string; value: string }) {
  return (
    <div className="subtle-panel apple-card-sm p-4">
      <p className="text-xs font-medium text-titanium">{label}</p>
      <p className={clsx("mt-2 text-2xl font-semibold tracking-[-0.045em]", tone === "up" ? "text-mint" : tone === "down" ? "text-rose" : "text-ink")}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium tracking-normal">{unit}</span>}
      </p>
      {detail && <p className="mt-1 truncate text-xs text-titanium">{detail}</p>}
    </div>
  );
}
