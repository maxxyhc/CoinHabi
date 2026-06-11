"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  Globe2,
  Languages,
  LayoutDashboard,
  LogOut,
  PieChart as PieIcon,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { enrichHoldings, formatCurrency, formatPercent, getPortfolioTotals, groupBy } from "@/lib/calculations";
import { getDictionary } from "@/lib/i18n";
import type { AssetType, Currency, EnrichedHolding, Holding, HoldingInput, Locale, MarketResponse } from "@/lib/types";

type Tab = "dashboard" | "holdings" | "analysis" | "settings";

const emptyForm: HoldingInput = {
  asset_type: "us_stock",
  symbol: "",
  name: "",
  quantity: 0,
  average_cost: 0,
  cost_currency: "USD",
  notes: "",
};

const chartColors = ["#6aa8ff", "#5df2b6", "#ffd166", "#ff6b8a", "#b9a6ff", "#8bd3dd"];

export function PortfolioApp() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [locale, setLocale] = useState<Locale>("zh");
  const t = getDictionary(locale);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<HoldingInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem("locale") as Locale | null;
    if (storedLocale === "en" || storedLocale === "zh") {
      setLocale(storedLocale);
    }
  }, []);

  const loadHoldings = useCallback(async () => {
    if (!supabase) {
      setError("Missing Supabase environment variables.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email ?? "");

    const { data, error: holdingsError } = await supabase
      .from("holdings")
      .select("*")
      .order("asset_type", { ascending: true })
      .order("symbol", { ascending: true });

    if (holdingsError) {
      setError(holdingsError.message);
    } else {
      setHoldings((data ?? []) as Holding[]);
    }

    setLoading(false);
  }, [supabase]);

  const refreshPrices = useCallback(
    async (nextHoldings = holdings) => {
      setRefreshing(true);
      try {
        const response = await fetch("/api/market/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holdings: nextHoldings }),
        });
        if (!response.ok) {
          throw new Error("Price refresh failed");
        }
        const data = (await response.json()) as MarketResponse;
        setMarket(data);
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : "Price refresh failed");
      } finally {
        setRefreshing(false);
      }
    },
    [holdings],
  );

  useEffect(() => {
    loadHoldings();
  }, [loadHoldings]);

  useEffect(() => {
    if (!loading) {
      refreshPrices(holdings);
    }
  }, [holdings, loading, refreshPrices]);

  const enriched = useMemo(
    () => enrichHoldings(holdings, market?.quotes ?? {}, market?.fx.twdToUsd ?? 1 / 32),
    [holdings, market],
  );
  const totals = useMemo(() => getPortfolioTotals(enriched), [enriched]);
  const assetMix = useMemo(() => groupBy(enriched, (holding) => holding.asset_type), [enriched]);
  const currencyMix = useMemo(() => groupBy(enriched, (holding) => holding.cost_currency), [enriched]);
  const largestHolding = enriched[0]
    ? [...enriched].sort((a, b) => b.allocationPercent - a.allocationPercent)[0]
    : null;

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    window.localStorage.setItem("locale", nextLocale);
  }

  function updateForm<K extends keyof HoldingInput>(key: K, value: HoldingInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function startEdit(holding: Holding) {
    setEditingId(holding.id);
    setForm({
      asset_type: holding.asset_type,
      symbol: holding.symbol,
      name: holding.name,
      quantity: holding.quantity,
      average_cost: holding.average_cost,
      cost_currency: holding.cost_currency,
      notes: holding.notes ?? "",
    });
    setActiveTab("holdings");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveHolding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) {
      setError("Supabase is not ready.");
      return;
    }

    const payload = {
      ...form,
      user_id: userId,
      symbol: form.symbol.toUpperCase().trim(),
      name: form.name.trim() || form.symbol.toUpperCase().trim(),
      notes: form.notes?.trim() || null,
    };

    const query = editingId
      ? supabase.from("holdings").update(payload).eq("id", editingId)
      : supabase.from("holdings").insert(payload);

    const { error: saveError } = await query;
    if (saveError) {
      setError(saveError.message);
      return;
    }

    resetForm();
    await loadHoldings();
  }

  async function deleteHolding(id: string) {
    if (!supabase) {
      return;
    }
    const { error: deleteError } = await supabase.from("holdings").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await loadHoldings();
  }

  async function signOut() {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="glass-panel rounded-lg p-8 text-titanium">Loading portfolio...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-4 sm:px-8 sm:py-8">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="glass-panel rounded-lg p-5 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]">
          <div className="flex h-full flex-col">
            <div className="mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink text-graphite">
                <CircleDollarSign size={25} />
              </div>
              <h1 className="mt-5 text-2xl font-semibold text-ink">{t.appName}</h1>
              <p className="mt-1 text-sm text-titanium">{t.appSubtitle}</p>
            </div>

            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:block lg:space-y-2">
              <NavButton active={activeTab === "dashboard"} icon={<LayoutDashboard size={18} />} label={t.dashboard} onClick={() => setActiveTab("dashboard")} />
              <NavButton active={activeTab === "holdings"} icon={<WalletCards size={18} />} label={t.holdings} onClick={() => setActiveTab("holdings")} />
              <NavButton active={activeTab === "analysis"} icon={<BarChart3 size={18} />} label={t.analysis} onClick={() => setActiveTab("analysis")} />
              <NavButton active={activeTab === "settings"} icon={<Settings size={18} />} label={t.settings} onClick={() => setActiveTab("settings")} />
            </nav>

            <div className="mt-6 space-y-3 lg:mt-auto">
              <div className="subtle-panel rounded-lg p-4">
                <p className="text-xs uppercase text-titanium">{t.signedIn}</p>
                <p className="mt-1 truncate text-sm text-ink">{userEmail}</p>
              </div>
              <button
                className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-3 text-sm text-ink transition hover:bg-white/10"
                onClick={signOut}
                type="button"
              >
                <LogOut size={16} />
                {t.signOut}
              </button>
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <Header
            activeTab={activeTab}
            locale={locale}
            refreshedAt={market?.refreshedAt}
            refreshing={refreshing}
            t={t}
            onRefresh={() => refreshPrices()}
            onLocaleChange={changeLocale}
          />

          {error && (
            <div className="rounded-lg border border-rose/30 bg-rose/10 p-4 text-sm text-rose">
              {error}
            </div>
          )}

          {activeTab === "dashboard" && (
            <DashboardView enriched={enriched} assetMix={assetMix} totals={totals} t={t} onEdit={startEdit} />
          )}

          {activeTab === "holdings" && (
            <HoldingsView
              editingId={editingId}
              enriched={enriched}
              form={form}
              t={t}
              onDelete={deleteHolding}
              onEdit={startEdit}
              onReset={resetForm}
              onSave={saveHolding}
              onUpdateForm={updateForm}
            />
          )}

          {activeTab === "analysis" && (
            <AnalysisView
              assetMix={assetMix}
              currencyMix={currencyMix}
              enriched={enriched}
              largestHolding={largestHolding}
              t={t}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView locale={locale} market={market} t={t} onLocaleChange={changeLocale} />
          )}
        </section>
      </div>
    </main>
  );
}

function Header({
  activeTab,
  locale,
  refreshedAt,
  refreshing,
  t,
  onRefresh,
  onLocaleChange,
}: {
  activeTab: Tab;
  locale: Locale;
  refreshedAt?: string;
  refreshing: boolean;
  t: ReturnType<typeof getDictionary>;
  onRefresh: () => void;
  onLocaleChange: (locale: Locale) => void;
}) {
  const title = t[activeTab];
  return (
    <header className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-lg p-5">
      <div>
        <p className="text-sm text-titanium">{t.lastUpdated}</p>
        <h2 className="mt-1 text-3xl font-semibold capitalize text-ink">{title}</h2>
        <p className="mt-1 text-sm text-titanium">
          {refreshedAt ? new Date(refreshedAt).toLocaleString() : "Pending first refresh"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-line bg-white/5 p-1">
          <button
            className={clsx("focus-ring rounded-md px-3 py-2 text-sm", locale === "zh" ? "bg-ink text-graphite" : "text-titanium")}
            onClick={() => onLocaleChange("zh")}
            type="button"
          >
            中文
          </button>
          <button
            className={clsx("focus-ring rounded-md px-3 py-2 text-sm", locale === "en" ? "bg-ink text-graphite" : "text-titanium")}
            onClick={() => onLocaleChange("en")}
            type="button"
          >
            EN
          </button>
        </div>
        <button
          className="focus-ring flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-medium text-graphite transition hover:bg-white"
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw className={clsx(refreshing && "animate-spin")} size={17} />
          {t.refresh}
        </button>
      </div>
    </header>
  );
}

function DashboardView({
  enriched,
  assetMix,
  totals,
  t,
  onEdit,
}: {
  enriched: EnrichedHolding[];
  assetMix: Array<{ name: string; value: number }>;
  totals: ReturnType<typeof getPortfolioTotals>;
  t: ReturnType<typeof getDictionary>;
  onEdit: (holding: Holding) => void;
}) {
  const leaders = [...enriched].sort((a, b) => b.gainPercent - a.gainPercent).slice(0, 3);
  const laggards = [...enriched].sort((a, b) => a.gainPercent - b.gainPercent).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t.totalValue} value={formatCurrency(totals.totalValue)} icon={<CircleDollarSign size={20} />} />
        <MetricCard label={t.totalGain} value={formatCurrency(totals.totalGain)} trend={totals.totalGain} icon={<Activity size={20} />} />
        <MetricCard label={t.dayChange} value={formatCurrency(totals.dayChange)} detail={formatPercent(totals.dayChangePercent)} trend={totals.dayChange} icon={<RefreshCw size={20} />} />
        <MetricCard label={t.returnRate} value={formatPercent(totals.totalReturn)} trend={totals.totalReturn} icon={<BarChart3 size={20} />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <section className="glass-panel rounded-lg p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-ink">{t.holdings}</h3>
              <p className="mt-1 text-sm text-titanium">{enriched.length} positions</p>
            </div>
          </div>
          <HoldingsTable compact enriched={enriched} t={t} onDelete={() => undefined} onEdit={onEdit} />
        </section>

        <section className="glass-panel rounded-lg p-5">
          <div className="mb-5 flex items-center gap-2">
            <PieIcon size={20} className="text-blue" />
            <h3 className="text-xl font-semibold text-ink">{t.assetMix}</h3>
          </div>
          <ChartPanel data={assetMix.map((item) => ({ ...item, name: t[item.name as AssetType] }))} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RankPanel title={t.leaders} holdings={leaders} t={t} />
        <RankPanel title={t.laggards} holdings={laggards} t={t} />
      </div>
    </div>
  );
}

function HoldingsView({
  editingId,
  enriched,
  form,
  t,
  onDelete,
  onEdit,
  onReset,
  onSave,
  onUpdateForm,
}: {
  editingId: string | null;
  enriched: EnrichedHolding[];
  form: HoldingInput;
  t: ReturnType<typeof getDictionary>;
  onDelete: (id: string) => void;
  onEdit: (holding: Holding) => void;
  onReset: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdateForm: <K extends keyof HoldingInput>(key: K, value: HoldingInput[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
      <section className="glass-panel rounded-lg p-5">
        <div className="mb-5 flex items-center gap-2">
          <Plus size={20} className="text-mint" />
          <h3 className="text-xl font-semibold text-ink">{editingId ? t.editHolding : t.addHolding}</h3>
        </div>
        <form className="space-y-4" onSubmit={onSave}>
          <Field label={t.type}>
            <select
              className="focus-ring w-full rounded-lg border border-line bg-graphite px-3 py-3 text-ink"
              value={form.asset_type}
              onChange={(event) => onUpdateForm("asset_type", event.target.value as AssetType)}
            >
              <option value="crypto">{t.crypto}</option>
              <option value="us_stock">{t.us_stock}</option>
              <option value="tw_stock">{t.tw_stock}</option>
              <option value="cash">{t.cash}</option>
            </select>
          </Field>
          <Field label={t.symbol}>
            <input
              className="focus-ring w-full rounded-lg border border-line bg-white/5 px-3 py-3 text-ink"
              placeholder="AAPL, 2330.TW, BTC"
              value={form.symbol}
              onChange={(event) => onUpdateForm("symbol", event.target.value)}
              required
            />
          </Field>
          <Field label={t.name}>
            <input
              className="focus-ring w-full rounded-lg border border-line bg-white/5 px-3 py-3 text-ink"
              value={form.name}
              onChange={(event) => onUpdateForm("name", event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.quantity}>
              <input
                className="focus-ring w-full rounded-lg border border-line bg-white/5 px-3 py-3 text-ink"
                min="0"
                step="any"
                type="number"
                value={form.quantity}
                onChange={(event) => onUpdateForm("quantity", Number(event.target.value))}
                required
              />
            </Field>
            <Field label={t.averageCost}>
              <input
                className="focus-ring w-full rounded-lg border border-line bg-white/5 px-3 py-3 text-ink"
                min="0"
                step="any"
                type="number"
                value={form.average_cost}
                onChange={(event) => onUpdateForm("average_cost", Number(event.target.value))}
                required
              />
            </Field>
          </div>
          <Field label={t.currency}>
            <select
              className="focus-ring w-full rounded-lg border border-line bg-graphite px-3 py-3 text-ink"
              value={form.cost_currency}
              onChange={(event) => onUpdateForm("cost_currency", event.target.value as Currency)}
            >
              <option value="USD">USD</option>
              <option value="TWD">TWD</option>
            </select>
          </Field>
          <Field label={t.notes}>
            <textarea
              className="focus-ring min-h-24 w-full resize-none rounded-lg border border-line bg-white/5 px-3 py-3 text-ink"
              value={form.notes ?? ""}
              onChange={(event) => onUpdateForm("notes", event.target.value)}
            />
          </Field>
          <div className="flex gap-3">
            <button className="focus-ring flex-1 rounded-lg bg-ink px-4 py-3 font-medium text-graphite" type="submit">
              {t.save}
            </button>
            {editingId && (
              <button className="focus-ring rounded-lg border border-line px-4 py-3 text-ink" type="button" onClick={onReset}>
                {t.cancel}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="glass-panel rounded-lg p-5">
        <HoldingsTable enriched={enriched} t={t} onDelete={onDelete} onEdit={onEdit} />
      </section>
    </div>
  );
}

function AnalysisView({
  assetMix,
  currencyMix,
  enriched,
  largestHolding,
  t,
}: {
  assetMix: Array<{ name: string; value: number }>;
  currencyMix: Array<{ name: string; value: number }>;
  enriched: EnrichedHolding[];
  largestHolding: EnrichedHolding | null;
  t: ReturnType<typeof getDictionary>;
}) {
  const topHoldings = [...enriched].sort((a, b) => b.valueUsd - a.valueUsd).slice(0, 6);
  const concentrationHigh = (largestHolding?.allocationPercent ?? 0) > 30;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="glass-panel rounded-lg p-5">
        <h3 className="mb-5 text-xl font-semibold text-ink">{t.assetMix}</h3>
        <ChartPanel data={assetMix.map((item) => ({ ...item, name: t[item.name as AssetType] }))} />
      </section>
      <section className="glass-panel rounded-lg p-5">
        <h3 className="mb-5 text-xl font-semibold text-ink">{t.currencyMix}</h3>
        <ChartPanel data={currencyMix} />
      </section>
      <section className="glass-panel rounded-lg p-5">
        <h3 className="mb-5 text-xl font-semibold text-ink">{t.topHoldings}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topHoldings.map((holding) => ({ name: holding.symbol, value: holding.valueUsd }))}>
              <XAxis dataKey="name" stroke="#86868b" />
              <YAxis stroke="#86868b" tickFormatter={(value) => `$${Number(value / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {topHoldings.map((holding, index) => (
                  <Cell key={holding.id} fill={chartColors[index % chartColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="glass-panel rounded-lg p-5">
        <h3 className="mb-5 text-xl font-semibold text-ink">{t.concentration}</h3>
        <div className="subtle-panel rounded-lg p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className={concentrationHigh ? "text-amber" : "text-mint"} size={26} />
            <div>
              <p className="text-lg font-semibold text-ink">
                {largestHolding ? `${largestHolding.symbol} ${largestHolding.allocationPercent.toFixed(1)}%` : "No holdings"}
              </p>
              <p className="mt-1 text-sm text-titanium">
                {concentrationHigh ? t.concentrationWarn : t.concentrationOk}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {topHoldings.slice(0, 4).map((holding) => (
            <AllocationRow key={holding.id} holding={holding} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsView({
  locale,
  market,
  t,
  onLocaleChange,
}: {
  locale: Locale;
  market: MarketResponse | null;
  t: ReturnType<typeof getDictionary>;
  onLocaleChange: (locale: Locale) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="glass-panel rounded-lg p-5">
        <div className="mb-5 flex items-center gap-2">
          <Languages size={20} className="text-blue" />
          <h3 className="text-xl font-semibold text-ink">{t.language}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            className={clsx("focus-ring rounded-lg border border-line px-4 py-4", locale === "zh" ? "bg-ink text-graphite" : "text-ink")}
            onClick={() => onLocaleChange("zh")}
            type="button"
          >
            中文
          </button>
          <button
            className={clsx("focus-ring rounded-lg border border-line px-4 py-4", locale === "en" ? "bg-ink text-graphite" : "text-ink")}
            onClick={() => onLocaleChange("en")}
            type="button"
          >
            English
          </button>
        </div>
      </section>
      <section className="glass-panel rounded-lg p-5">
        <div className="mb-5 flex items-center gap-2">
          <Globe2 size={20} className="text-mint" />
          <h3 className="text-xl font-semibold text-ink">{t.baseCurrency}</h3>
        </div>
        <div className="subtle-panel rounded-lg p-5">
          <p className="text-4xl font-semibold text-ink">USD</p>
          <p className="mt-3 text-sm leading-6 text-titanium">{t.baseCurrencyHelp}</p>
          {market && <p className="mt-4 text-sm text-titanium">1 USD = {market.fx.usdToTwd.toFixed(2)} TWD</p>}
        </div>
      </section>
      <section className="glass-panel rounded-lg p-5">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck size={20} className="text-amber" />
          <h3 className="text-xl font-semibold text-ink">{t.security}</h3>
        </div>
        <p className="text-sm leading-6 text-titanium">{t.allowedUser}</p>
      </section>
    </div>
  );
}

function HoldingsTable({
  compact = false,
  enriched,
  t,
  onDelete,
  onEdit,
}: {
  compact?: boolean;
  enriched: EnrichedHolding[];
  t: ReturnType<typeof getDictionary>;
  onDelete: (id: string) => void;
  onEdit: (holding: Holding) => void;
}) {
  if (!enriched.length) {
    return <div className="subtle-panel rounded-lg p-8 text-center text-titanium">{t.noHoldings}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase text-titanium">
          <tr>
            <th className="px-4 py-3">{t.symbol}</th>
            <th className="px-4 py-3">{t.type}</th>
            <th className="px-4 py-3 text-right">{t.value}</th>
            <th className="px-4 py-3 text-right">{t.gainLoss}</th>
            {!compact && <th className="px-4 py-3 text-right">{t.allocation}</th>}
            {!compact && <th className="px-4 py-3 text-right">{t.source}</th>}
            <th className="px-4 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {enriched.map((holding) => (
            <tr key={holding.id} className="border-t border-line transition hover:bg-white/5">
              <td className="px-4 py-4">
                <button className="text-left" onClick={() => onEdit(holding)} type="button">
                  <span className="block font-semibold text-ink">{holding.symbol}</span>
                  <span className="block text-xs text-titanium">{holding.name}</span>
                </button>
              </td>
              <td className="px-4 py-4 text-titanium">{t[holding.asset_type]}</td>
              <td className="px-4 py-4 text-right text-ink">{formatCurrency(holding.valueUsd)}</td>
              <td className={clsx("px-4 py-4 text-right", holding.gainUsd >= 0 ? "text-mint" : "text-rose")}>
                <span className="block">{formatCurrency(holding.gainUsd)}</span>
                <span className="text-xs">{formatPercent(holding.gainPercent)}</span>
              </td>
              {!compact && <td className="px-4 py-4 text-right text-ink">{holding.allocationPercent.toFixed(1)}%</td>}
              {!compact && <td className="px-4 py-4 text-right text-titanium">{holding.quote?.source ?? "Cost basis"}</td>}
              <td className="px-4 py-4 text-right">
                {!compact && (
                  <button
                    aria-label={`${t.delete} ${holding.symbol}`}
                    className="focus-ring rounded-lg border border-line p-2 text-titanium transition hover:bg-rose/10 hover:text-rose"
                    onClick={() => onDelete(holding.id)}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx(
        "focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition",
        active ? "bg-ink text-graphite" : "text-titanium hover:bg-white/10 hover:text-ink",
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function MetricCard({
  detail,
  icon,
  label,
  trend,
  value,
}: {
  detail?: string;
  icon: React.ReactNode;
  label: string;
  trend?: number;
  value: string;
}) {
  return (
    <div className="glass-panel rounded-lg p-5">
      <div className="flex items-center justify-between text-titanium">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <p className={clsx("mt-6 text-3xl font-semibold", trend === undefined ? "text-ink" : trend >= 0 ? "text-mint" : "text-rose")}>
        {value}
      </p>
      {detail && <p className="mt-2 text-sm text-titanium">{detail}</p>}
    </div>
  );
}

function RankPanel({
  holdings,
  t,
  title,
}: {
  holdings: EnrichedHolding[];
  t: ReturnType<typeof getDictionary>;
  title: string;
}) {
  return (
    <section className="glass-panel rounded-lg p-5">
      <h3 className="mb-4 text-xl font-semibold text-ink">{title}</h3>
      <div className="space-y-3">
        {holdings.map((holding) => (
          <div key={holding.id} className="subtle-panel flex items-center justify-between rounded-lg p-4">
            <div>
              <p className="font-semibold text-ink">{holding.symbol}</p>
              <p className="text-xs text-titanium">{t[holding.asset_type]}</p>
            </div>
            <div className={holding.gainPercent >= 0 ? "text-right text-mint" : "text-right text-rose"}>
              <p className="font-semibold">{formatPercent(holding.gainPercent)}</p>
              <p className="text-xs">{formatCurrency(holding.gainUsd)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChartPanel({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={64} outerRadius={105} paddingAngle={4}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-2 text-sm text-titanium">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
            <span>{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) {
    return null;
  }
  const item = payload[0];
  return (
    <div className="rounded-lg border border-line bg-graphite px-3 py-2 text-sm shadow-glow">
      <p className="text-ink">{item.name}</p>
      <p className="text-titanium">{formatCurrency(item.value)}</p>
    </div>
  );
}

function AllocationRow({ holding }: { holding: EnrichedHolding }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-ink">{holding.symbol}</span>
        <span className="text-titanium">{holding.allocationPercent.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-blue" style={{ width: `${Math.min(100, holding.allocationPercent)}%` }} />
      </div>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-titanium">{label}</span>
      {children}
    </label>
  );
}
