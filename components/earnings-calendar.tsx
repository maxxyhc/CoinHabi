"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronLeft, ChevronRight, Moon, Sunrise } from "lucide-react";
import { addDays, type EarningsEntry, type EarningsWeek } from "@/lib/market/earnings";
import type { EnrichedHolding, Locale } from "@/lib/types";

type Copy = {
  eyebrow: string;
  title: [string, string, string];
  subtitle: string;
  range: (dates: string, count: number) => string;
  thisWeek: string;
  today: string;
  beforeOpen: string;
  afterClose: string;
  unannounced: string;
  more: (count: number) => string;
  held: string;
  heldTag: string;
  heldNone: string;
  beat: string;
  miss: string;
  eps: (estimate: string, actual: string | null) => string;
  empty: string;
  loading: string;
  failed: string;
  footnote: string;
};

const copy: Record<Locale, Copy> = {
  zh: {
    eyebrow: "財報行事曆 · EARNINGS CALENDAR",
    title: ["本週", "最受矚目", "財報"],
    subtitle: "美股財報行事曆 · The Most Anticipated US Earnings Calendar",
    range: (dates, count) => `${dates}（美東時間），本週收錄 ${count} 家重點公司的財報。`,
    thisWeek: "回到本週",
    today: "今天",
    beforeOpen: "盤前",
    afterClose: "盤後",
    unannounced: "時間未定",
    more: (count) => `顯示更多 +${count}`,
    held: "你的持股本週財報",
    heldTag: "持有",
    heldNone: "你持有的美股本週都沒有財報。",
    beat: "優於預期",
    miss: "低於預期",
    eps: (estimate, actual) => `EPS 預估 ${estimate}${actual ? ` · 實際 ${actual}` : ""}`,
    empty: "這天沒有收錄的財報。",
    loading: "正在載入財報行事曆…",
    failed: "目前無法取得財報行事曆。",
    footnote: "盤前＝美股開盤前公布；盤後＝美股收盤後公布。每個時段依營收預估挑選前 15 家，另外加入你持有的公司。資料來源：Finnhub。",
  },
  en: {
    eyebrow: "EARNINGS CALENDAR",
    title: ["This week's ", "most anticipated", " earnings"],
    subtitle: "The Most Anticipated US Earnings Calendar",
    range: (dates, count) => `${dates} (US Eastern) · ${count} key companies reporting this week.`,
    thisWeek: "This week",
    today: "Today",
    beforeOpen: "Before open",
    afterClose: "After close",
    unannounced: "Time TBD",
    more: (count) => `Show ${count} more`,
    held: "Your holdings reporting this week",
    heldTag: "Held",
    heldNone: "None of your US stocks report this week.",
    beat: "Beat",
    miss: "Miss",
    eps: (estimate, actual) => `EPS est. ${estimate}${actual ? ` · actual ${actual}` : ""}`,
    empty: "No listed reports this day.",
    loading: "Loading the earnings calendar…",
    failed: "The earnings calendar is unavailable right now.",
    footnote: "Before open = reported before the US market opens; after close = after it closes. Each session shows the top 15 by revenue estimate, plus any company you hold. Data: Finnhub.",
  },
  ja: {
    eyebrow: "決算カレンダー · EARNINGS CALENDAR",
    title: ["今週の", "注目", "決算"],
    subtitle: "米国株決算カレンダー · The Most Anticipated US Earnings Calendar",
    range: (dates, count) => `${dates}（米東部時間）、今週は注目企業 ${count} 社の決算を掲載。`,
    thisWeek: "今週に戻る",
    today: "今日",
    beforeOpen: "寄り前",
    afterClose: "引け後",
    unannounced: "時間未定",
    more: (count) => `さらに表示 +${count}`,
    held: "今週決算の保有銘柄",
    heldTag: "保有",
    heldNone: "保有米国株の今週の決算はありません。",
    beat: "予想超え",
    miss: "予想割れ",
    eps: (estimate, actual) => `EPS 予想 ${estimate}${actual ? ` · 実績 ${actual}` : ""}`,
    empty: "この日の掲載決算はありません。",
    loading: "決算カレンダーを読み込み中…",
    failed: "現在、決算カレンダーを取得できません。",
    footnote: "寄り前＝米国市場の開場前に発表、引け後＝閉場後に発表。各時間帯は売上予想上位15社と保有銘柄を表示。データ：Finnhub。",
  },
  ko: {
    eyebrow: "실적 캘린더 · EARNINGS CALENDAR",
    title: ["이번 주 ", "주목받는", " 실적 발표"],
    subtitle: "미국 주식 실적 캘린더 · The Most Anticipated US Earnings Calendar",
    range: (dates, count) => `${dates} (미 동부 시간), 이번 주 주요 기업 ${count}곳의 실적 발표.`,
    thisWeek: "이번 주로",
    today: "오늘",
    beforeOpen: "장 전",
    afterClose: "장 후",
    unannounced: "시간 미정",
    more: (count) => `더 보기 +${count}`,
    held: "이번 주 실적을 발표하는 보유 종목",
    heldTag: "보유",
    heldNone: "보유한 미국 주식 중 이번 주 실적 발표가 없습니다.",
    beat: "예상 상회",
    miss: "예상 하회",
    eps: (estimate, actual) => `EPS 예상 ${estimate}${actual ? ` · 실제 ${actual}` : ""}`,
    empty: "이 날 표시할 실적 발표가 없습니다.",
    loading: "실적 캘린더를 불러오는 중…",
    failed: "지금은 실적 캘린더를 불러올 수 없습니다.",
    footnote: "장 전 = 미국 장 시작 전 발표, 장 후 = 장 마감 후 발표. 각 시간대는 매출 예상 상위 15개 기업과 보유 종목을 표시합니다. 데이터: Finnhub.",
  },
  es: {
    eyebrow: "CALENDARIO DE RESULTADOS",
    title: ["Los resultados ", "más esperados", " de la semana"],
    subtitle: "Calendario de resultados de EE. UU. · The Most Anticipated US Earnings Calendar",
    range: (dates, count) => `${dates} (hora del Este de EE. UU.) · ${count} empresas clave publican esta semana.`,
    thisWeek: "Esta semana",
    today: "Hoy",
    beforeOpen: "Antes de apertura",
    afterClose: "Tras el cierre",
    unannounced: "Hora por confirmar",
    more: (count) => `Ver ${count} más`,
    held: "Tus posiciones que publican esta semana",
    heldTag: "En cartera",
    heldNone: "Ninguna de tus acciones de EE. UU. publica esta semana.",
    beat: "Supera",
    miss: "No alcanza",
    eps: (estimate, actual) => `BPA est. ${estimate}${actual ? ` · real ${actual}` : ""}`,
    empty: "No hay resultados listados este día.",
    loading: "Cargando el calendario de resultados…",
    failed: "El calendario de resultados no está disponible ahora.",
    footnote: "Antes de apertura = antes de que abra el mercado de EE. UU.; tras el cierre = después de que cierre. Cada franja muestra las 15 mayores por ingresos estimados y las empresas que tienes. Datos: Finnhub.",
  },
};

const VISIBLE = 8;

// Finnhub dates are US Eastern trading days, so "today" and the default week
// must be Eastern too; a Taipei evening is still the same US morning.
function easternToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function mondayOf(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  // On a weekend the coming week is the useful one.
  return addDays(date, weekday === 0 ? 1 : weekday === 6 ? 2 : 1 - weekday);
}

const asDate = (date: string) => new Date(`${date}T12:00:00Z`);

// Intl's "zh" is Simplified (周一); the app writes Traditional Chinese.
const intlLocale = (locale: Locale) => locale === "zh" ? "zh-TW" : locale;

function weekRange(locale: Locale, start: string) {
  const from = asDate(start);
  const to = asDate(addDays(start, 4));
  // zh-TW and ja collapse a long-month range to "2026/11/9至2026/11/13".
  if (locale === "zh" || locale === "ja") {
    const md = (date: Date) => `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日`;
    return `${from.getUTCFullYear()} 年 ${md(from)} – ${md(to)}`;
  }
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).formatRange(from, to);
}

export function EarningsCalendar({ holdings, locale }: { holdings: EnrichedHolding[]; locale: Locale }) {
  const c = copy[locale];
  const today = easternToday();
  const currentWeek = mondayOf(today);
  const [weekStart, setWeekStart] = useState(currentWeek);
  const symbols = useMemo(
    () => [...new Set(holdings.filter((holding) => holding.asset_type === "us_stock").map((holding) => holding.symbol.toUpperCase()))].sort(),
    [holdings],
  );
  const requestKey = `${weekStart}|${symbols.join(",")}`;
  const [state, setState] = useState<{ key: string; week: EarningsWeek | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market/earnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, symbols }),
    })
      .then((response) => response.ok ? response.json() as Promise<EarningsWeek> : Promise.reject(new Error(String(response.status))))
      .then((week) => { if (!cancelled) setState({ key: requestKey, week }); })
      .catch(() => { if (!cancelled) setState({ key: requestKey, week: null }); });
    return () => { cancelled = true; };
    // `requestKey` is exactly weekStart plus the held symbols.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const current = state?.key === requestKey ? state : null;
  const week = current?.week ?? null;
  const englishWeek = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(asDate(weekStart)).toUpperCase();

  return (
    <div className="space-y-5">
      <section className="glass-panel apple-card px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-titanium">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            {c.eyebrow}
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-ink sm:text-4xl">
            {c.title[0]}<span className="text-[var(--accent)]">{c.title[1]}</span>{c.title[2]}
          </h2>
          <p className="mt-2 text-sm text-titanium">{c.subtitle}</p>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <WeekButton label="‹" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={18} /></WeekButton>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-titanium">FOR THE WEEK BEGINNING {englishWeek}</p>
            <p className="mt-1 text-sm text-ink sm:text-base">
              {c.range(weekRange(locale, weekStart), week?.total ?? 0)}
            </p>
            {weekStart !== currentWeek && (
              <button className="focus-ring mt-2 rounded-full px-3 py-1 text-xs font-semibold text-[var(--accent)]" type="button" onClick={() => setWeekStart(currentWeek)}>
                {c.thisWeek}
              </button>
            )}
          </div>
          <WeekButton label="›" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight size={18} /></WeekButton>
        </div>

        {symbols.length > 0 && week && <HeldStrip c={c} locale={locale} week={week} />}
      </section>

      {!current ? (
        <Notice text={c.loading} />
      ) : !week ? (
        <Notice text={c.failed} />
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="grid grid-cols-1 gap-3 md:min-w-[1080px] md:grid-cols-5">
            {week.days.map((day) => (
              <DayCard key={`${weekStart}-${day.date}`} c={c} day={day} isToday={day.date === today} locale={locale} />
            ))}
          </div>
        </div>
      )}

      <p className="px-2 text-center text-xs leading-5 text-titanium">{c.footnote}</p>
    </div>
  );
}

function WeekButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button aria-label={label} className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-[var(--surface-raised)] text-ink shadow-[var(--shadow-soft)] transition hover:text-[var(--accent)]" type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function Notice({ text }: { text: string }) {
  return <div className="glass-panel apple-card flex h-48 items-center justify-center p-6 text-center text-sm text-titanium">{text}</div>;
}

function HeldStrip({ c, locale, week }: { c: Copy; locale: Locale; week: EarningsWeek }) {
  const day = new Intl.DateTimeFormat(intlLocale(locale), { month: "numeric", day: "numeric", weekday: "short", timeZone: "UTC" });
  return (
    <div className="mt-6 rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface-muted)] p-4">
      <p className="text-sm font-semibold text-ink">{c.held}</p>
      {week.held.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {week.held.map((entry) => (
            <span key={`${entry.symbol}-${entry.date}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-[var(--surface-raised)] py-1 pl-1 pr-3 text-xs text-ink">
              <Logo className="h-6 w-6 rounded-full" symbol={entry.symbol} />
              <span className="font-semibold">{entry.symbol}</span>
              <span className="text-titanium">
                {day.format(asDate(entry.date))} · {entry.hour === "bmo" ? c.beforeOpen : entry.hour === "amc" ? c.afterClose : c.unannounced}
              </span>
              <Surprise c={c} entry={entry} />
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-titanium">{c.heldNone}</p>
      )}
    </div>
  );
}

function DayCard({ c, day, isToday, locale }: { c: Copy; day: EarningsWeek["days"][number]; isToday: boolean; locale: Locale }) {
  const date = asDate(day.date);
  const localWeekday = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" }).format(date);
  const englishWeekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date).toUpperCase();
  const monthDay = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;

  return (
    <section className={clsx("glass-panel relative overflow-hidden rounded-[22px]", isToday && "ring-1 ring-[var(--accent)]/50")}>
      {isToday && <span className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]" />}
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
        <p className="whitespace-nowrap text-sm text-ink">
          <span className="text-base font-bold">{localWeekday}</span>
          {localWeekday.toUpperCase() !== englishWeekday && <span className="ml-1.5 text-xs font-semibold tracking-[0.12em] text-titanium">{englishWeekday}</span>}
          <span className="text-xs font-semibold tracking-[0.08em] text-titanium"> · {monthDay}</span>
        </p>
        {isToday && <span className="shrink-0 whitespace-nowrap rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[#14110a]">{c.today}</span>}
      </header>
      <div className="grid grid-cols-2 divide-x divide-line">
        <SessionColumn c={c} entries={day.beforeOpen} icon={<Sunrise size={14} />} label={c.beforeOpen} sublabel="BEFORE OPEN" />
        <SessionColumn c={c} entries={day.afterClose} icon={<Moon size={14} />} label={c.afterClose} sublabel="AFTER CLOSE" />
      </div>
    </section>
  );
}

function SessionColumn({ c, entries, icon, label, sublabel }: { c: Copy; entries: EarningsEntry[]; icon: React.ReactNode; label: string; sublabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, VISIBLE);
  return (
    <div className="flex flex-col gap-2 p-2.5">
      <div className="pb-1 text-center">
        <p className="flex items-center justify-center gap-1 text-xs font-semibold text-titanium">{icon}{label}</p>
        <p className="mt-0.5 text-[9px] font-semibold tracking-[0.16em] text-titanium/70">{sublabel}</p>
      </div>
      {entries.length === 0 && <p className="py-3 text-center text-sm text-titanium">—</p>}
      {shown.map((entry) => <CompanyTile key={entry.symbol} c={c} entry={entry} />)}
      {entries.length > VISIBLE && !expanded && (
        <button className="focus-ring flex items-center justify-center gap-1 rounded-xl border border-line py-1.5 text-[11px] font-semibold text-titanium hover:text-ink" type="button" onClick={() => setExpanded(true)}>
          <ChevronDown size={12} />
          {c.more(entries.length - VISIBLE)}
        </button>
      )}
    </div>
  );
}

function CompanyTile({ c, entry }: { c: Copy; entry: EarningsEntry }) {
  const eps = (value: number | null) => value === null ? "—" : value.toFixed(2);
  return (
    <div
      className={clsx(
        "relative flex h-[72px] flex-col items-center justify-center gap-1 rounded-xl border bg-[var(--surface-raised)] px-1.5 shadow-[var(--shadow-soft)]",
        entry.held ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/40" : "border-line",
      )}
      title={`${entry.symbol} · Q${entry.quarter} ${entry.year} · ${c.eps(eps(entry.epsEstimate), entry.epsActual === null ? null : eps(entry.epsActual))}`}
    >
      <Logo className="h-8 w-8 shrink-0 rounded-lg" symbol={entry.symbol} />
      <p className="max-w-full truncate text-[12px] font-bold tracking-[-0.01em] text-ink">{entry.symbol}</p>
      <Surprise c={c} compact entry={entry} />
      {entry.held && <span className="absolute -top-2 right-1.5 rounded-full bg-[var(--accent)] px-1.5 text-[9px] font-bold leading-4 text-[#14110a]">{c.heldTag}</span>}
    </div>
  );
}

function Surprise({ c, compact = false, entry }: { c: Copy; compact?: boolean; entry: EarningsEntry }) {
  if (entry.epsActual === null || entry.epsEstimate === null || entry.epsActual === entry.epsEstimate) return null;
  const beat = entry.epsActual > entry.epsEstimate;
  const label = beat ? c.beat : c.miss;
  return compact ? (
    <span aria-label={label} className={clsx("absolute left-1.5 top-1 text-[10px] font-bold", beat ? "text-mint" : "text-rose")} title={label}>{beat ? "▲" : "▼"}</span>
  ) : (
    <span className={clsx("text-[10px] font-semibold", beat ? "text-mint" : "text-rose")}>{beat ? "▲" : "▼"} {label}</span>
  );
}

// Parqet has square brand icons with their own background, which read on both
// themes; FMP covers more tickers but some of its logos are white-on-clear.
const logoSources = (symbol: string) => [
  `https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol)}?format=png`,
  `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`,
];

function Logo({ className, symbol }: { className: string; symbol: string }) {
  const [attempt, setAttempt] = useState(0);
  const sources = logoSources(symbol);
  if (attempt >= sources.length) {
    return <span className={clsx(className, "grid place-items-center bg-[var(--surface-muted)] text-[10px] font-bold text-titanium")}>{symbol.slice(0, 2)}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- external logos with a fallback chain; next/image would need every host whitelisted
  return <img alt="" className={clsx(className, "object-contain")} loading="lazy" src={sources[attempt]} onError={() => setAttempt((value) => value + 1)} />;
}
