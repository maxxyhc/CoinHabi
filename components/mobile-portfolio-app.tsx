"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Ellipsis,
  LayoutDashboard,
  Languages,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import clsx from "clsx";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletTracker } from "@/components/wallet-tracker";
import { localeNames, localeOrder, tx } from "@/lib/i18n";
import {
  aggregateHoldingsForOverview,
  buildFinancialHealthNotes,
  buildHealthQuests,
  currencyAmountToUsd,
  currencyBucketsToUsd,
  formatCurrency,
  formatHealthRatio,
  formatPercent,
  getFinancialHealthScore,
  getMonthlyCashflowOverview,
  getPortfolioTotals,
  isSameMonth,
} from "@/lib/calculations";
import type {
  AssetType,
  CashflowTransaction,
  CashflowTransactionInput,
  CashflowType,
  Currency,
  Debt,
  DebtInput,
  DebtType,
  EnrichedHolding,
  HoldingInput,
  Locale,
  MonthlyBudget,
  RecurringExpense,
  RecurringExpenseInput,
} from "@/lib/types";

type MobileTab = "home" | "holdings" | "cashflow" | "insights" | "more";

type MobilePortfolioAppProps = {
  budgets: MonthlyBudget[];
  cashflowForm: CashflowTransactionInput;
  debtForm: DebtInput;
  debts: Debt[];
  demo: boolean;
  editingHolding: boolean;
  enriched: EnrichedHolding[];
  error: string;
  form: HoldingInput;
  locale: Locale;
  portfolioName: string;
  recurringExpenses: RecurringExpense[];
  recurringForm: RecurringExpenseInput;
  refreshedAt?: string;
  refreshing: boolean;
  transactions: CashflowTransaction[];
  twdToUsd: number;
  userEmail: string;
  userId: string;
  onDeleteHolding: (id: string) => void;
  onHoldingsChanged: () => Promise<void>;
  onLocaleChange: (locale: Locale) => void;
  onPortfolioNameChange: (name: string) => void;
  onRefresh: () => void;
  onResetCashflow: () => void;
  onResetDebt: () => void;
  onResetHolding: () => void;
  onResetRecurring: () => void;
  onSaveCashflow: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveDebt: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveHolding: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveRecurring: (event: React.FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
  onUpdateCashflow: <K extends keyof CashflowTransactionInput>(
    key: K,
    value: CashflowTransactionInput[K],
  ) => void;
  onUpdateDebt: <K extends keyof DebtInput>(
    key: K,
    value: DebtInput[K],
  ) => void;
  onUpdateHolding: <K extends keyof HoldingInput>(
    key: K,
    value: HoldingInput[K],
  ) => void;
  onUpdateRecurring: <K extends keyof RecurringExpenseInput>(
    key: K,
    value: RecurringExpenseInput[K],
  ) => void;
};

const expenseCategories = [
  { id: "food", zh: "餐飲", en: "Food" },
  { id: "transport", zh: "交通", en: "Transport" },
  { id: "housing", zh: "居住", en: "Housing" },
  { id: "shopping", zh: "購物", en: "Shopping" },
  { id: "entertainment", zh: "娛樂", en: "Entertainment" },
  { id: "health", zh: "醫療健康", en: "Health" },
  { id: "education", zh: "教育", en: "Education" },
  { id: "investment", zh: "投資投入", en: "Investment" },
  { id: "other_expense", zh: "其他支出", en: "Other" },
] as const;

const incomeCategories = [
  { id: "salary", zh: "薪資", en: "Salary" },
  { id: "bonus", zh: "獎金", en: "Bonus" },
  { id: "side_income", zh: "副業收入", en: "Side income" },
  { id: "investment_income", zh: "投資收入", en: "Investment income" },
  { id: "other_income", zh: "其他收入", en: "Other" },
] as const;

export function MobilePortfolioApp(props: MobilePortfolioAppProps) {
  const {
    budgets,
    cashflowForm,
    debtForm,
    debts,
    demo,
    enriched,
    error,
    form,
    locale,
    portfolioName,
    recurringExpenses,
    recurringForm,
    refreshedAt,
    refreshing,
    transactions,
    twdToUsd,
    userEmail,
    userId,
  } = props;
  const [tab, setTab] = useState<MobileTab>("home");
  const [holdingSheet, setHoldingSheet] = useState(false);
  const [cashflowSheet, setCashflowSheet] = useState(false);
  const [recurringSheet, setRecurringSheet] = useState(false);
  const [debtSheet, setDebtSheet] = useState(false);
  const [nameSheet, setNameSheet] = useState(false);
  const overview = useMemo(
    () => aggregateHoldingsForOverview(enriched),
    [enriched],
  );
  const totals = useMemo(() => getPortfolioTotals(enriched), [enriched]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTransactions = transactions.filter(
    (transaction) => transaction.transaction_date.slice(0, 7) === currentMonth,
  );

  function selectTab(next: MobileTab) {
    setTab(next);
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  return (
    <main className="mobile-app min-h-[100dvh] bg-[var(--page)] pb-[calc(5.75rem+env(safe-area-inset-bottom))]">
      <MobileHeader
        locale={locale}
        portfolioName={portfolioName}
        refreshedAt={refreshedAt}
        refreshing={refreshing}
        tab={tab}
        onEditName={() => setNameSheet(true)}
        onLocaleChange={props.onLocaleChange}
        onRefresh={props.onRefresh}
      />

      <div className="mx-auto max-w-lg px-4 pb-6 pt-4">
        {error && (
          <div className="mb-4 rounded-2xl border border-rose/25 bg-rose/10 p-3 text-sm text-rose">
            {error}
          </div>
        )}

        {tab === "home" && (
          <MobileHome
            locale={locale}
            monthTransactions={monthTransactions}
            overview={overview}
            totals={totals}
            onAddCashflow={() => {
              props.onResetCashflow();
              setCashflowSheet(true);
            }}
            onAddHolding={() => {
              props.onResetHolding();
              setHoldingSheet(true);
            }}
            onOpenHoldings={() => selectTab("holdings")}
          />
        )}

        {tab === "holdings" && (
          <MobileHoldings
            demo={demo}
            holdings={overview}
            locale={locale}
            onAdd={() => {
              props.onResetHolding();
              setHoldingSheet(true);
            }}
            onDelete={props.onDeleteHolding}
          />
        )}

        {tab === "cashflow" && (
          <MobileCashflow
            debts={debts}
            locale={locale}
            recurringExpenses={recurringExpenses}
            transactions={transactions}
            onAdd={(type, date) => {
              props.onResetCashflow();
              props.onUpdateCashflow("transaction_type", type);
              if (date) props.onUpdateCashflow("transaction_date", date);
              setCashflowSheet(true);
            }}
            onAddDebt={() => {
              props.onResetDebt();
              setDebtSheet(true);
            }}
            onAddRecurring={() => {
              props.onResetRecurring();
              setRecurringSheet(true);
            }}
          />
        )}

        {tab === "insights" && (
          <MobileInsights
            budgets={budgets}
            debts={debts}
            enriched={enriched}
            holdings={overview}
            locale={locale}
            recurringExpenses={recurringExpenses}
            totals={totals}
            transactions={transactions}
            twdToUsd={twdToUsd}
          />
        )}

        {tab === "more" && (
          <MobileMore
            demo={demo}
            locale={locale}
            portfolioName={portfolioName}
            userEmail={userEmail}
            onEditName={() => setNameSheet(true)}
            onLocaleChange={props.onLocaleChange}
            onSignOut={props.onSignOut}
          />
        )}
      </div>

      <MobileBottomNav active={tab} locale={locale} onSelect={selectTab} />

      {holdingSheet && (
        <MobileHoldingSheet
          editing={props.editingHolding}
          demo={demo}
          form={form}
          locale={locale}
          userId={userId}
          onClose={() => setHoldingSheet(false)}
          onHoldingsChanged={props.onHoldingsChanged}
          onSave={props.onSaveHolding}
          onUpdate={props.onUpdateHolding}
        />
      )}

      {cashflowSheet && (
        <MobileCashflowSheet
          form={cashflowForm}
          locale={locale}
          onClose={() => setCashflowSheet(false)}
          onSave={props.onSaveCashflow}
          onUpdate={props.onUpdateCashflow}
        />
      )}

      {recurringSheet && (
        <MobileRecurringSheet
          form={recurringForm}
          locale={locale}
          onClose={() => setRecurringSheet(false)}
          onSave={props.onSaveRecurring}
          onUpdate={props.onUpdateRecurring}
        />
      )}

      {debtSheet && (
        <MobileDebtSheet
          form={debtForm}
          locale={locale}
          onClose={() => setDebtSheet(false)}
          onSave={props.onSaveDebt}
          onUpdate={props.onUpdateDebt}
        />
      )}

      {nameSheet && (
        <MobileNameSheet
          locale={locale}
          portfolioName={portfolioName}
          onClose={() => setNameSheet(false)}
          onSave={(name) => {
            props.onPortfolioNameChange(name);
            setNameSheet(false);
          }}
        />
      )}
    </main>
  );
}

function MobileHeader({
  locale,
  portfolioName,
  refreshedAt,
  refreshing,
  tab,
  onEditName,
  onLocaleChange,
  onRefresh,
}: {
  locale: Locale;
  portfolioName: string;
  refreshedAt?: string;
  refreshing: boolean;
  tab: MobileTab;
  onEditName: () => void;
  onLocaleChange: (locale: Locale) => void;
  onRefresh: () => void;
}) {
  const zh = locale === "zh";
  const homeTitle = portfolioName
    ? zh
      ? `${portfolioName}的資產`
      : `${portfolioName}'s assets`
    : zh
      ? "我的財務"
      : "My finances";
  const titles: Record<MobileTab, string> = {
    home: homeTitle,
    holdings: tx(locale, "Holdings"),
    cashflow: tx(locale, "Cashflow"),
    insights: tx(locale, "Insights"),
    more: tx(locale, "More"),
  };

  return (
    <header className="sticky top-0 z-30 bg-[color-mix(in_srgb,var(--page)_86%,transparent)] px-4 pb-2.5 pt-[max(0.7rem,env(safe-area-inset-top))] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-[19px] font-semibold tracking-[-0.03em] text-ink">
              {titles[tab]}
            </h1>
            {tab === "home" && (
              <button
                aria-label={tx(locale, "Edit portfolio name")}
                className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-titanium"
                onClick={onEditName}
                type="button"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          {refreshedAt && (
            <p className="mt-0.5 truncate text-[10px] text-titanium">
              {tx(locale, "Updated")} {new Date(refreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <label className="focus-within:ring-2 focus-within:ring-[var(--accent)]/35 relative flex h-9 min-w-[104px] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-line bg-[var(--surface-raised)] px-3">
            <Languages aria-hidden="true" className="shrink-0 text-[var(--accent)]" size={15} />
            <span className="text-[11px] font-semibold text-ink">{localeNames[locale]}</span>
            <select
              aria-label={tx(locale, "Language")}
              title={localeNames[locale]}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
              value={locale}
              onChange={(event) => onLocaleChange(event.target.value as Locale)}
            >
              {localeOrder.map((item) => <option key={item} value={item}>{localeNames[item]}</option>)}
            </select>
          </label>
          <button
            aria-label={tx(locale, "Refresh prices")}
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-line bg-[var(--surface-raised)] text-[var(--accent)]"
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw className={clsx(refreshing && "animate-spin")} size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileHome({
  locale,
  monthTransactions,
  overview,
  totals,
  onAddCashflow,
  onAddHolding,
  onOpenHoldings,
}: {
  locale: Locale;
  monthTransactions: CashflowTransaction[];
  overview: EnrichedHolding[];
  totals: ReturnType<typeof getPortfolioTotals>;
  onAddCashflow: () => void;
  onAddHolding: () => void;
  onOpenHoldings: () => void;
}) {
  const monthly = getTransactionBuckets(monthTransactions);
  const topHoldings = [...overview]
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 4);
  const allocationSegments = buildAllocationSegments(overview);
  const dayPositive = totals.dayChange >= 0;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[26px] border border-line bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
        <div className="pointer-events-none absolute -right-14 -top-20 h-52 w-52 rounded-full bg-[var(--accent)] opacity-[0.16] blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-20 h-40 w-40 rounded-full bg-[var(--accent)] opacity-[0.07] blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-titanium">
              {tx(locale, "Total portfolio")}
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <CircleDollarSign size={16} />
            </span>
          </div>
          <p className="mt-2 text-[2.5rem] font-semibold leading-none tracking-[-0.045em] text-ink">
            {formatCurrency(totals.totalValue)}
          </p>
          <div className="mt-3.5 flex items-center gap-2">
            <span
              className={clsx(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                dayPositive ? "bg-mint/10 text-mint" : "bg-rose/10 text-rose",
              )}
            >
              {dayPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {formatCurrency(totals.dayChange)} · {formatPercent(totals.dayChangePercent)}
            </span>
            <span className="text-[11px] text-titanium">{tx(locale, "today")}</span>
          </div>
          {allocationSegments.length > 0 && (
            <>
              <div className="mt-5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                {allocationSegments.map((segment) => (
                  <span
                    className="h-full rounded-full"
                    key={segment.id}
                    style={{ backgroundColor: segment.color, width: `${segment.percent}%` }}
                  />
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                {allocationSegments.map((segment) => (
                  <span className="flex items-center gap-1.5 text-[10px] text-titanium" key={segment.id}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: segment.color }} />
                    {segment.label} {segment.percent.toFixed(0)}%
                  </span>
                ))}
              </div>
            </>
          )}
          <button
            className="focus-ring mt-4 flex w-full items-center justify-between border-t border-line pt-3.5 text-xs font-semibold text-[var(--accent)]"
            onClick={onOpenHoldings}
            type="button"
          >
            <span className="font-medium text-titanium">
              {overview.length} {tx(locale, "assets")}
            </span>
            <span className="flex items-center gap-0.5">
              {tx(locale, "View holdings")}
              <ChevronRight size={14} />
            </span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <MobileMetric
          icon={totals.totalGain >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          label={tx(locale, "Unrealized P/L")}
          tone={totals.totalGain >= 0 ? "positive" : "negative"}
          value={formatCurrency(totals.totalGain)}
        />
        <MobileMetric
          icon={<ReceiptText size={15} />}
          label={tx(locale, "Monthly spending")}
          tone="negative"
          value={formatBuckets(monthly.expense)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <QuickAction
          icon={<ReceiptText size={17} />}
          label={tx(locale, "Add transaction")}
          onClick={onAddCashflow}
        />
        <QuickAction
          icon={<WalletCards size={17} />}
          label={tx(locale, "Add holding")}
          onClick={onAddHolding}
        />
      </div>

      <section className="rounded-[24px] border border-line bg-[var(--surface-raised)] px-4 py-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">{tx(locale, "Top assets")}</h2>
          <button
            className="focus-ring flex items-center gap-0.5 text-xs font-semibold text-[var(--accent)]"
            onClick={onOpenHoldings}
            type="button"
          >
            {tx(locale, "All")}
            <ChevronRight size={13} />
          </button>
        </div>
        <div className="mt-1.5 divide-y divide-line">
          {topHoldings.map((holding) => (
            <MobileAssetRow holding={holding} key={holding.id} locale={locale} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MobileHoldings({
  demo,
  holdings,
  locale,
  onAdd,
  onDelete,
}: {
  demo: boolean;
  holdings: EnrichedHolding[];
  locale: Locale;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const [sort, setSort] = useState<"value" | "day" | "return">("value");
  const totalValue = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const sorters: Record<typeof sort, (a: EnrichedHolding, b: EnrichedHolding) => number> = {
    value: (a, b) => b.valueUsd - a.valueUsd,
    day: (a, b) => b.dayChangeUsd - a.dayChangeUsd,
    return: (a, b) => b.gainPercent - a.gainPercent,
  };
  const groups = (
    [
      { label: tx(locale, "US stocks"), type: "us_stock" },
      { label: tx(locale, "Taiwan stocks"), type: "tw_stock" },
      { label: tx(locale, "Crypto"), type: "crypto" },
      { label: tx(locale, "Cash"), type: "cash" },
    ] as const
  )
    .map((group) => ({
      ...group,
      items: holdings.filter((holding) => holding.asset_type === group.type).sort(sorters[sort]),
      tone: assetTypeTone(group.type),
    }))
    .filter((group) => group.items.length > 0);
  const sortOptions = [
    { id: "value", label: tx(locale, "Value") },
    { id: "day", label: tx(locale, "Today") },
    { id: "return", label: tx(locale, "Return") },
  ] as const;

  return (
    <div className="space-y-4">
      <button
        className="focus-ring primary-button flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-semibold"
        onClick={onAdd}
        type="button"
      >
        <Plus size={19} />
        {tx(locale, "Add holding")}
      </button>

      <div className="grid grid-cols-3 gap-1 rounded-full border border-line bg-[var(--surface-muted)] p-1">
        {sortOptions.map((option) => (
          <button
            aria-pressed={sort === option.id}
            className={clsx(
              "focus-ring min-h-9 rounded-full px-1.5 text-[11px] font-semibold transition",
              sort === option.id ? "bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm" : "text-titanium",
            )}
            key={option.id}
            onClick={() => setSort(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {groups.map((group) => {
        const subtotal = group.items.reduce((sum, holding) => sum + holding.valueUsd, 0);
        return (
          <section key={group.type}>
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.tone.solid }} />
                <span className="text-xs font-semibold text-ink">{group.label}</span>
                <span className="text-[10px] text-titanium">{group.items.length}</span>
              </span>
              <span className="text-[11px] text-titanium">
                {formatCurrency(subtotal)} · {totalValue ? ((subtotal / totalValue) * 100).toFixed(1) : "0.0"}%
              </span>
            </div>
            <div className="space-y-3">
              {group.items.map((holding) => {
                const dayPercent = holding.quote?.dayChangePercent;
                return (
                  <article className="rounded-[22px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]" key={holding.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <AssetMark assetType={holding.asset_type} symbol={holding.symbol} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{holding.symbol}</p>
                          <p className="mt-0.5 truncate text-xs text-titanium">{holding.name}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-ink">{formatCurrency(holding.valueUsd)}</p>
                        <p className={clsx("mt-0.5 text-xs", holding.cost_known === false ? "text-titanium" : holding.gainUsd >= 0 ? "text-mint" : "text-rose")}>
                          {holding.cost_known === false ? "N/A" : formatPercent(holding.gainPercent)}
                        </p>
                        {typeof dayPercent === "number" && holding.asset_type !== "cash" && (
                          <span
                            className={clsx(
                              "mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                              dayPercent >= 0 ? "bg-mint/10 text-mint" : "bg-rose/10 text-rose",
                            )}
                          >
                            {dayPercent >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                            {formatPercent(dayPercent)} {tx(locale, "1D")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--surface-muted)] p-3 text-xs">
                      <AssetFact label={tx(locale, "Quantity")} value={formatQuantity(holding.quantity)} />
                      <AssetFact label={tx(locale, "Avg. cost")} value={holding.cost_known === false ? "N/A" : formatCurrency(holding.average_cost, holding.cost_currency)} />
                      <AssetFact label={tx(locale, "Weight")} value={`${holding.allocationPercent.toFixed(1)}%`} />
                    </div>
                    {!demo && holding.source_kind !== "wallet" && !holding.id.startsWith("overview:") && (
                      <button
                        className="focus-ring ml-auto mt-3 flex items-center rounded-full bg-rose/10 px-3 py-1.5 text-[11px] font-semibold text-rose"
                        onClick={() => onDelete(holding.id)}
                        type="button"
                      >
                        {tx(locale, "Delete holding")}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MobileCashflow({
  debts,
  locale,
  recurringExpenses,
  transactions,
  onAdd,
  onAddDebt,
  onAddRecurring,
}: {
  debts: Debt[];
  locale: Locale;
  recurringExpenses: RecurringExpense[];
  transactions: CashflowTransaction[];
  onAdd: (type: CashflowType, date?: string) => void;
  onAddDebt: () => void;
  onAddRecurring: () => void;
}) {
  const zh = locale === "zh";
  const [section, setSection] = useState<"transactions" | "recurring" | "debts">("transactions");
  const todayKey = localDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const currentMonthKey = todayKey.slice(0, 7);
  const currentMonthTransactions = transactions.filter(
    (transaction) => transaction.transaction_date.slice(0, 7) === currentMonthKey,
  );
  const currentMonthExpenses = currentMonthTransactions
    .filter((transaction) => transaction.transaction_type === "expense")
    .sort((a, b) => {
      const dateOrder = b.transaction_date.localeCompare(a.transaction_date);
      return dateOrder || b.created_at.localeCompare(a.created_at);
    });
  const buckets = getTransactionBuckets(currentMonthTransactions);
  const [expenseHistoryOpen, setExpenseHistoryOpen] = useState(false);
  const sections = [
    { id: "transactions", label: tx(locale, "Cashflow") },
    { id: "recurring", label: tx(locale, "Recurring") },
    { id: "debts", label: tx(locale, "Debts") },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MobileMetric icon={<TrendingUp size={18} />} label={tx(locale, "Monthly income")} tone="positive" value={formatBuckets(buckets.income)} />
        <MobileMetric
          icon={<TrendingDown size={18} />}
          label={tx(locale, "Monthly expenses")}
          tone="negative"
          value={formatBuckets(buckets.expense)}
          onClick={() => setExpenseHistoryOpen(true)}
        />
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-full border border-line bg-[var(--surface-muted)] p-1">
        {sections.map((item) => (
          <button
            aria-pressed={section === item.id}
            className={clsx(
              "focus-ring min-h-10 rounded-full px-1.5 text-[11px] font-semibold leading-4 transition",
              section === item.id
                ? "bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm"
                : "text-titanium",
            )}
            key={item.id}
            onClick={() => setSection(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === "transactions" && (
        <>
          <button className="focus-ring primary-button flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-semibold" onClick={() => onAdd("expense", selectedDate)} type="button">
            <Plus size={18} />
            {tx(locale, "Add income or expense")}
          </button>
          <MobileCashflowCalendar
            calendarMonth={calendarMonth}
            debts={debts}
            locale={locale}
            recurringExpenses={recurringExpenses}
            selectedDate={selectedDate}
            transactions={transactions}
            onAdd={() => onAdd("expense", selectedDate)}
            onChangeMonth={(offset) => {
              const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
              setCalendarMonth(next);
              setSelectedDate(localDateKey(next));
            }}
            onSelectDate={setSelectedDate}
          />
        </>
      )}

      {section === "recurring" && (
        <>
          <button className="focus-ring primary-button flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-semibold" onClick={onAddRecurring} type="button">
            <Plus size={18} />
            {tx(locale, "Add recurring expense")}
          </button>
          <div className="space-y-3">
            {recurringExpenses.length ? recurringExpenses.map((expense) => (
              <article className="rounded-[22px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]" key={expense.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{expense.name}</p>
                    <p className="mt-1 text-xs text-titanium">
                      {expense.is_subscription ? (tx(locale, "Subscription")) : (tx(locale, "Recurring expense"))}
                      {" · "}
                      {expense.frequency === "monthly" ? (tx(locale, "Monthly")) : (tx(locale, "Yearly"))}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-ink">{formatCurrency(expense.amount, expense.currency)}</p>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-[var(--surface-muted)] px-3 py-2.5 text-xs">
                  <span className={expense.is_active ? "text-mint" : "text-titanium"}>
                    {expense.is_active ? (tx(locale, "Active")) : (tx(locale, "Inactive"))}
                  </span>
                  <span className="text-titanium">{tx(locale, "Next")} {formatDate(expense.next_due_date, locale)}</span>
                </div>
              </article>
            )) : (
              <EmptyMobileState text={tx(locale, "No recurring expenses yet.")} />
            )}
          </div>
        </>
      )}

      {section === "debts" && (
        <>
          <button className="focus-ring primary-button flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-semibold" onClick={onAddDebt} type="button">
            <Plus size={18} />
            {tx(locale, "Add loan or debt")}
          </button>
          <div className="space-y-3">
            {debts.length ? debts.map((debt) => (
              <article className="rounded-[22px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]" key={debt.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{debt.name}</p>
                    <p className="mt-1 text-xs text-titanium">{debt.lender || debtTypeLabel(debt.debt_type, locale)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-ink">{formatCurrency(debt.remaining_principal, debt.currency)}</p>
                    <p className="mt-1 text-xs text-titanium">{debt.interest_rate.toFixed(2)}% APR</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface-muted)] p-3 text-xs">
                  <AssetFact label={tx(locale, "Minimum")} value={formatCurrency(debt.minimum_payment, debt.currency)} />
                  <AssetFact label={tx(locale, "Next payment")} value={formatDate(debt.next_payment_date, locale)} />
                </div>
              </article>
            )) : (
              <EmptyMobileState text={tx(locale, "No debts yet.")} />
            )}
          </div>
        </>
      )}

      {expenseHistoryOpen && (
        <MobileSheet title={tx(locale, "Monthly expense details")} onClose={() => setExpenseHistoryOpen(false)}>
          <div className="mb-4 flex items-end justify-between gap-3 rounded-[20px] bg-[var(--surface-muted)] p-4">
            <div>
              <p className="text-xs text-titanium">
                {new Date(`${currentMonthKey}-01T00:00:00`).toLocaleDateString(zh ? "zh-TW" : "en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-rose">{formatBuckets(buckets.expense)}</p>
            </div>
            <span className="rounded-full bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-medium text-titanium">
              {zh ? `共 ${currentMonthExpenses.length} 筆` : `${currentMonthExpenses.length} records`}
            </span>
          </div>
          {!currentMonthExpenses.length ? (
            <EmptyMobileState text={tx(locale, "No expenses recorded this month.")} />
          ) : (
            <div className="divide-y divide-line">
              {currentMonthExpenses.map((transaction) => (
                <article className="flex items-start justify-between gap-3 py-4" key={transaction.id}>
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-rose/10 text-rose">
                      <span className="text-[9px] font-medium leading-none">
                        {new Date(`${transaction.transaction_date}T00:00:00`).toLocaleDateString(zh ? "zh-TW" : "en-US", { month: "short" })}
                      </span>
                      <span className="mt-0.5 text-sm font-bold leading-none">{Number(transaction.transaction_date.slice(8, 10))}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{transaction.description}</p>
                      <p className="mt-1 text-xs text-titanium">
                        {transaction.category}
                        {transaction.payment_method ? ` · ${transaction.payment_method}` : ""}
                      </p>
                      {transaction.notes && <p className="mt-1 line-clamp-2 text-xs text-titanium">{transaction.notes}</p>}
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-rose">-{formatCurrency(transaction.amount, transaction.currency)}</p>
                </article>
              ))}
            </div>
          )}
        </MobileSheet>
      )}
    </div>
  );
}

function MobileCashflowCalendar({
  calendarMonth,
  debts,
  locale,
  recurringExpenses,
  selectedDate,
  transactions,
  onAdd,
  onChangeMonth,
  onSelectDate,
}: {
  calendarMonth: Date;
  debts: Debt[];
  locale: Locale;
  recurringExpenses: RecurringExpense[];
  selectedDate: string;
  transactions: CashflowTransaction[];
  onAdd: () => void;
  onChangeMonth: (offset: number) => void;
  onSelectDate: (date: string) => void;
}) {
  const zh = locale === "zh";
  const todayKey = localDateKey(new Date());
  const days = mobileCalendarDays(calendarMonth);
  const selectedTransactions = transactions
    .filter((transaction) => transaction.transaction_date === selectedDate)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const schedulesByDate = buildMobileScheduleMap(days, recurringExpenses, debts);
  const selectedSchedules = schedulesByDate.get(selectedDate) ?? { debts: [], recurring: [] };
  const eventsByDate = transactions.reduce<Map<string, Set<CashflowType>>>((map, transaction) => {
    const kinds = map.get(transaction.transaction_date) ?? new Set<CashflowType>();
    kinds.add(transaction.transaction_type);
    map.set(transaction.transaction_date, kinds);
    return map;
  }, new Map());
  const weekdayLabels = zh
    ? ["日", "一", "二", "三", "四", "五", "六"]
    : ["S", "M", "T", "W", "T", "F", "S"];
  const monthLabel = calendarMonth.toLocaleDateString(zh ? "zh-TW" : "en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="rounded-[24px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-[15px] font-semibold text-ink">{monthLabel}</h2>
        <div className="flex shrink-0 items-center gap-1">
          <button
            className="focus-ring rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-[var(--accent)]"
            onClick={() => {
              const today = new Date();
              const monthOffset =
                (today.getFullYear() - calendarMonth.getFullYear()) * 12 +
                today.getMonth() -
                calendarMonth.getMonth();
              onChangeMonth(monthOffset);
              onSelectDate(todayKey);
            }}
            type="button"
          >
            {tx(locale, "Today")}
          </button>
          <button aria-label={tx(locale, "Previous month")} className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] text-titanium" onClick={() => onChangeMonth(-1)} type="button">
            <ChevronLeft size={16} />
          </button>
          <button aria-label={tx(locale, "Next month")} className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] text-titanium" onClick={() => onChangeMonth(1)} type="button">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {weekdayLabels.map((label, index) => (
          <span className="py-1 text-[10px] font-semibold text-titanium" key={`${label}-${index}`}>{label}</span>
        ))}
        {days.map((day) => {
          const key = localDateKey(day);
          const events = eventsByDate.get(key);
          const schedules = schedulesByDate.get(key);
          const hasRecurring = Boolean(schedules?.recurring.length);
          const hasDebt = Boolean(schedules?.debts.length);
          const hasDue = hasRecurring || hasDebt;
          const dueEntries = [
            ...(schedules?.recurring.map((expense) => ({ amount: expense.amount, currency: expense.currency })) ?? []),
            ...(schedules?.debts.map((debt) => ({ amount: debt.minimum_payment, currency: debt.currency })) ?? []),
          ];
          const dueLabel = dueEntries.length ? formatDueLabel(dueEntries, zh) : null;
          const currentMonth = day.getMonth() === calendarMonth.getMonth();
          const selected = key === selectedDate;
          const today = key === todayKey;
          return (
            <button
              aria-label={formatDate(key, locale)}
              aria-pressed={selected}
              className={clsx(
                "focus-ring flex min-h-[54px] w-full flex-col items-center rounded-xl px-0.5 pb-1 pt-1.5 text-xs transition",
                selected
                  ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-[var(--shadow-button)]"
                  : hasRecurring
                    ? "border border-[var(--accent)]/30 bg-[var(--accent-soft)] text-ink"
                    : hasDebt
                      ? "border border-line bg-[var(--surface-muted)] text-ink"
                      : "text-ink hover:bg-[var(--surface-muted)]",
                !currentMonth && !selected && "opacity-35",
              )}
              key={key}
              onClick={() => onSelectDate(key)}
              type="button"
            >
              <span className={clsx("leading-none", selected ? "font-bold" : today ? "font-bold text-[var(--accent)]" : hasDue ? "font-semibold" : "font-medium")}>
                {day.getDate()}
              </span>
              {dueLabel && (
                <span
                  className={clsx(
                    "mt-1 w-full truncate text-[8.5px] font-bold leading-none",
                    selected ? "text-[var(--accent-ink)]" : hasRecurring ? "text-[var(--accent)]" : "text-ink",
                  )}
                >
                  {dueLabel}
                </span>
              )}
              <span className="mt-auto flex h-1.5 items-center gap-0.5 pt-0.5">
                {events?.has("income") && <span className={clsx("h-1 w-1 rounded-full", selected ? "bg-[var(--accent-ink)]" : "bg-mint")} />}
                {events?.has("expense") && <span className={clsx("h-1 w-1 rounded-full", selected ? "bg-[var(--accent-ink)]" : "bg-rose")} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[10px] text-titanium">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[5px] border border-[var(--accent)]/30 bg-[var(--accent-soft)]" />
          {tx(locale, "Recurring due")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[5px] border border-line bg-[var(--surface-muted)]" />
          {tx(locale, "Loan due")}
        </span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-mint" />{tx(locale, "Income")}</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose" />{tx(locale, "Expense")}</span>
      </div>

      <div className="mt-3 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">{formatDate(selectedDate, locale)}</h3>
          <button
            aria-label={zh ? `新增 ${formatDate(selectedDate, locale)} 的紀錄` : `Add a record for ${formatDate(selectedDate, locale)}`}
            className="focus-ring flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)]"
            onClick={onAdd}
            type="button"
          >
            <Plus size={13} />
            {tx(locale, "Add")}
          </button>
        </div>
        {(selectedSchedules.recurring.length > 0 || selectedSchedules.debts.length > 0) && (
          <div className="mt-3 space-y-2">
            {selectedSchedules.recurring.map((expense) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] p-3" key={`recurring-${expense.id}`}>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">{expense.name}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--accent)]">
                    {expense.is_subscription ? (tx(locale, "Subscription")) : (tx(locale, "Recurring bill"))}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-bold text-[var(--accent)]">{formatCurrency(expense.amount, expense.currency)}</p>
              </div>
            ))}
            {selectedSchedules.debts.map((debt) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-[var(--surface-muted)] p-3" key={`debt-${debt.id}`}>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">{debt.name}</p>
                  <p className="mt-0.5 text-[10px] text-titanium">{tx(locale, "Loan or debt payment")}</p>
                </div>
                <p className="shrink-0 text-xs font-bold text-ink">{formatCurrency(debt.minimum_payment, debt.currency)}</p>
              </div>
            ))}
          </div>
        )}
        {!selectedTransactions.length && !selectedSchedules.recurring.length && !selectedSchedules.debts.length ? (
          <p className="mt-4 rounded-2xl bg-[var(--surface-muted)] p-4 text-center text-xs text-titanium">
            {tx(locale, "No records for this day. Tap + to add one.")}
          </p>
        ) : selectedTransactions.length ? (
          <div className="mt-2 divide-y divide-line">
            {selectedTransactions.map((transaction) => (
              <div className="flex items-center justify-between gap-3 py-3" key={transaction.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{transaction.description}</p>
                  <p className="mt-0.5 text-[10px] text-titanium">{transaction.category}</p>
                </div>
                <p className={clsx("shrink-0 text-sm font-semibold", transaction.transaction_type === "income" ? "text-mint" : "text-rose")}>
                  {transaction.transaction_type === "income" ? "+" : "-"}{formatCurrency(transaction.amount, transaction.currency)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MobileInsights({
  budgets,
  debts,
  enriched,
  holdings,
  locale,
  recurringExpenses,
  totals,
  transactions,
  twdToUsd,
}: {
  budgets: MonthlyBudget[];
  debts: Debt[];
  enriched: EnrichedHolding[];
  holdings: EnrichedHolding[];
  locale: Locale;
  recurringExpenses: RecurringExpense[];
  totals: ReturnType<typeof getPortfolioTotals>;
  transactions: CashflowTransaction[];
  twdToUsd: number;
}) {
  const zh = locale === "zh";
  const sorted = [...holdings].sort((a, b) => b.allocationPercent - a.allocationPercent);
  const activeRecurring = recurringExpenses.filter((expense) => expense.is_active);
  const annualRecurringUsd = activeRecurring.reduce(
    (sum, expense) =>
      sum +
      currencyAmountToUsd(
        expense.frequency === "monthly" ? expense.amount * 12 : expense.amount,
        expense.currency,
        twdToUsd,
      ),
    0,
  );
  const performanceHoldings = holdings.filter(
    (item) => item.asset_type !== "cash" && item.cost_known !== false,
  );
  const best = [...performanceHoldings].sort((a, b) => b.gainPercent - a.gainPercent)[0];
  const worst = [...performanceHoldings].sort((a, b) => a.gainPercent - b.gainPercent)[0];
  const donutData = sorted.slice(0, 5).map((holding, index) => ({
    color: chartPalette[index % chartPalette.length],
    name: holding.symbol.replace(/\..*$/, ""),
    value: Math.max(0, holding.allocationPercent),
  }));
  const donutRest = sorted.slice(5).reduce((sum, item) => sum + item.allocationPercent, 0);
  if (donutRest > 0.5) {
    donutData.push({ color: "#8d99ab", name: tx(locale, "Others"), value: donutRest });
  }

  const debtPrincipalUsd = debts
    .filter((debt) => debt.is_active)
    .reduce((sum, debt) => sum + currencyAmountToUsd(debt.remaining_principal, debt.currency, twdToUsd), 0);
  const netWorthUsd = totals.totalValue - debtPrincipalUsd;

  const expenseDonut = buildExpenseCategoryDonut(transactions, twdToUsd, locale);
  const expenseTotal = expenseDonut.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="space-y-4">
      <MobileHealthSection
        budgets={budgets}
        debts={debts}
        enriched={enriched}
        locale={locale}
        recurringExpenses={recurringExpenses}
        totals={totals}
        transactions={transactions}
        twdToUsd={twdToUsd}
      />

      <section className="relative overflow-hidden rounded-[26px] border border-line bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[var(--accent)] opacity-[0.14] blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-titanium">{tx(locale, "Net worth")}</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <CircleDollarSign size={16} />
            </span>
          </div>
          <p className={clsx("mt-2 text-[2.5rem] font-semibold leading-none tracking-[-0.045em]", netWorthUsd >= 0 ? "text-ink" : "text-rose")}>
            {formatCurrency(netWorthUsd)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
              <p className="text-[10px] font-medium text-titanium">{tx(locale, "Total assets")}</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">{formatCurrency(totals.totalValue)}</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
              <p className="text-[10px] font-medium text-titanium">{tx(locale, "Total debt")}</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">{debtPrincipalUsd > 0 ? `-${formatCurrency(debtPrincipalUsd)}` : formatCurrency(0)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[26px] border border-line bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
        <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-[var(--accent)] opacity-[0.12] blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-titanium">{tx(locale, "Total return")}</p>
        <p className={clsx("mt-2 text-[2.25rem] font-semibold leading-none tracking-[-0.045em]", totals.totalReturn >= 0 ? "text-mint" : "text-rose")}>
          {formatPercent(totals.totalReturn)}
        </p>
        <p className="mt-2.5 text-xs text-titanium">
          {tx(locale, "Includes assets with known cost basis only.")}
        </p>
      </section>

      {donutData.length > 0 && (
        <section className="rounded-[24px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
          <h2 className="text-[15px] font-semibold text-ink">{tx(locale, "Allocation")}</h2>
          <div className="relative mx-auto mt-2 h-[190px] w-full">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  cornerRadius={5}
                  data={donutData}
                  dataKey="value"
                  endAngle={-270}
                  innerRadius={62}
                  isAnimationActive={false}
                  outerRadius={82}
                  paddingAngle={2}
                  startAngle={90}
                  stroke="none"
                >
                  {donutData.map((entry) => (
                    <Cell fill={entry.color} key={entry.name} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[10px] text-titanium">{tx(locale, "Assets")}</p>
              <p className="text-xl font-semibold tracking-[-0.03em] text-ink">{holdings.length}</p>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {donutData.map((entry) => (
              <div className="flex items-center justify-between gap-3 py-1.5" key={entry.name}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="truncate text-xs font-medium text-ink">{entry.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="h-1 w-16 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <span className="block h-full rounded-full" style={{ backgroundColor: entry.color, width: `${Math.min(100, Math.max(2, entry.value))}%` }} />
                  </span>
                  <span className="w-11 text-right text-xs tabular-nums text-titanium">{entry.value.toFixed(1)}%</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {expenseDonut.length > 0 && (
        <section className="rounded-[24px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">{tx(locale, "Spending by category")}</h2>
            <span className="text-[10px] text-titanium">{tx(locale, "In USD")}</span>
          </div>
          <div className="relative mx-auto mt-2 h-[190px] w-full">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  cornerRadius={5}
                  data={expenseDonut}
                  dataKey="value"
                  endAngle={-270}
                  innerRadius={62}
                  isAnimationActive={false}
                  outerRadius={82}
                  paddingAngle={2}
                  startAngle={90}
                  stroke="none"
                >
                  {expenseDonut.map((entry) => (
                    <Cell fill={entry.color} key={entry.name} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[10px] text-titanium">{tx(locale, "This month")}</p>
              <p className="text-lg font-semibold tracking-[-0.03em] text-ink">{formatCurrency(expenseTotal)}</p>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {expenseDonut.map((entry) => (
              <div className="flex items-center justify-between gap-3 py-1.5" key={entry.name}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="truncate text-xs font-medium text-ink">{entry.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs tabular-nums text-titanium">{formatCurrency(entry.value)}</span>
                  <span className="w-11 text-right text-xs tabular-nums text-titanium">
                    {expenseTotal ? ((entry.value / expenseTotal) * 100).toFixed(0) : "0"}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeRecurring.length > 0 && (
        <section className="relative overflow-hidden rounded-[24px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
          <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-[var(--accent)] opacity-[0.1] blur-3xl" />
          <p className="text-[11px] font-medium text-titanium">{tx(locale, "Annual recurring cost")}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-ink">{formatCurrency(annualRecurringUsd)}</p>
          <p className="mt-1 text-xs text-titanium">
            {zh
              ? `約每月 ${formatCurrency(annualRecurringUsd / 12)} · ${activeRecurring.length} 個項目`
              : `≈ ${formatCurrency(annualRecurringUsd / 12)} per month · ${activeRecurring.length} items`}
          </p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <PerformanceCard holding={best} label={tx(locale, "Best performer")} positive />
        <PerformanceCard holding={worst} label={tx(locale, "Worst performer")} />
      </div>
    </div>
  );
}

type PetMood = "thriving" | "happy" | "okay" | "tired" | "sick";

function MobileHealthSection({
  budgets,
  debts,
  enriched,
  locale,
  recurringExpenses,
  totals,
  transactions,
  twdToUsd,
}: {
  budgets: MonthlyBudget[];
  debts: Debt[];
  enriched: EnrichedHolding[];
  locale: Locale;
  recurringExpenses: RecurringExpense[];
  totals: ReturnType<typeof getPortfolioTotals>;
  transactions: CashflowTransaction[];
  twdToUsd: number;
}) {
  const zh = locale === "zh";
  const monthTransactions = transactions.filter((transaction) => isSameMonth(transaction.transaction_date));
  const activeRecurring = recurringExpenses.filter((expense) => expense.is_active);
  const activeDebts = debts.filter((debt) => debt.is_active);
  const overview = getMonthlyCashflowOverview(monthTransactions, activeRecurring, activeDebts);
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const overBudgetCount = budgets
    .filter((budget) => budget.month.slice(0, 7) === currentMonthKey)
    .filter((budget) => {
      const spent = monthTransactions
        .filter(
          (transaction) =>
            transaction.transaction_type === "expense" &&
            transaction.category === budget.category &&
            transaction.currency === budget.currency,
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      return spent > budget.amount;
    }).length;
  const subscriptionsToReviewCount = activeRecurring.filter(
    (expense) =>
      expense.is_subscription &&
      (expense.usage_status === "rarely_used" || expense.usage_status === "consider_canceling"),
  ).length;
  const unknownCostCount = enriched.filter((holding) => holding.cost_known === false).length;
  const missingPriceCount = enriched.filter((holding) => holding.asset_type !== "cash" && !holding.quote).length;
  const dataIssues = unknownCostCount + missingPriceCount;

  const incomeUsd = currencyBucketsToUsd(overview.income, twdToUsd);
  const fixedUsd = currencyBucketsToUsd(overview.recurring, twdToUsd) + currencyBucketsToUsd(overview.debtPayments, twdToUsd);
  const leftoverUsd = currencyBucketsToUsd(overview.leftover, twdToUsd);
  const debtPaymentUsd = currencyBucketsToUsd(overview.debtPayments, twdToUsd);
  const debtPrincipalUsd = activeDebts.reduce(
    (sum, debt) => sum + currencyAmountToUsd(debt.remaining_principal, debt.currency, twdToUsd),
    0,
  );
  const netWorthUsd = totals.totalValue - debtPrincipalUsd;
  const savingsRate = incomeUsd > 0 ? (leftoverUsd / incomeUsd) * 100 : null;
  const fixedPressure = incomeUsd > 0 ? (fixedUsd / incomeUsd) * 100 : null;
  const debtIncomeRatio = incomeUsd > 0 ? (debtPaymentUsd / incomeUsd) * 100 : null;

  const score = getFinancialHealthScore({ dataIssues, debtIncomeRatio, fixedPressure, savingsRate });
  const notes = buildFinancialHealthNotes({
    dataIssues,
    debtIncomeRatio,
    fixedPressure,
    incomeUsd,
    locale,
    overBudgetCount,
    savingsRate,
    subscriptionsToReviewCount,
    unknownCostCount,
  });
  const quests = buildHealthQuests({ dataIssues, debtIncomeRatio, fixedPressure, locale, savingsRate });

  const mood: PetMood = score >= 85 ? "thriving" : score >= 70 ? "happy" : score >= 50 ? "okay" : score >= 30 ? "tired" : "sick";
  const title = score >= 85
    ? (tx(locale, "Money master"))
    : score >= 70
      ? (tx(locale, "Steady saver"))
      : score >= 50
        ? (tx(locale, "Working on it"))
        : score >= 30
          ? (tx(locale, "Feeling tight"))
          : (tx(locale, "Needs rescue"));
  const ringColor = score >= 70 ? "#34b27b" : score >= 50 ? "#d99a3d" : "#e05d5d";

  const [previousScore, setPreviousScore] = useState<number | null>(null);
  useEffect(() => {
    const stored = window.localStorage.getItem("healthScore:last");
    if (stored !== null && Number.isFinite(Number(stored))) {
      setPreviousScore(Number(stored));
    }
  }, []);
  useEffect(() => {
    window.localStorage.setItem("healthScore:last", String(score));
  }, [score]);
  const delta = previousScore === null ? null : score - previousScore;

  const messages = useMemo(() => {
    const list = [...notes];
    if (delta !== null && delta > 0) {
      list.unshift(zh ? `我比上次健康了 ${delta} 分，繼續保持！` : `I'm ${delta} points healthier than last time. Keep it up!`);
    } else if (delta !== null && delta < 0) {
      list.unshift(zh ? `我比上次虛弱了 ${Math.abs(delta)} 分⋯⋯幫幫我。` : `I'm ${Math.abs(delta)} points weaker than last time... help me out.`);
    }
    return list;
  }, [notes, delta, zh]);
  const [messageIndex, setMessageIndex] = useState(0);
  const message = messages[messageIndex % messages.length] ?? "";

  return (
    <>
      <section className="relative overflow-hidden rounded-[26px] border border-line bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full opacity-[0.14] blur-3xl"
          style={{ backgroundColor: ringColor }}
        />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-titanium">
              {tx(locale, "Financial health")}
            </p>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ backgroundColor: `${ringColor}1f`, color: ringColor }}
            >
              {title}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              aria-label={tx(locale, "Talk to your pet")}
              className="focus-ring relative h-[124px] w-[124px] shrink-0 rounded-full"
              onClick={() => setMessageIndex((index) => index + 1)}
              type="button"
            >
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 124 124">
                <circle cx="62" cy="62" fill="none" r="57" stroke="var(--surface-muted)" strokeWidth="7" />
                <circle
                  cx="62"
                  cy="62"
                  fill="none"
                  r="57"
                  stroke={ringColor}
                  strokeDasharray={`${(score / 100) * 2 * Math.PI * 57} ${2 * Math.PI * 57}`}
                  strokeLinecap="round"
                  strokeWidth="7"
                />
              </svg>
              <span className="absolute inset-[13px] flex items-center justify-center overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <HealthPet mood={mood} />
              </span>
            </button>
            <div className="min-w-0">
              <p className="flex items-baseline gap-1">
                <span className="text-[2.6rem] font-semibold leading-none tracking-[-0.045em] text-ink">{score}</span>
                <span className="text-sm font-medium text-titanium">/ 100</span>
              </p>
              {delta !== null && delta !== 0 && (
                <span
                  className={clsx(
                    "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    delta > 0 ? "bg-mint/10 text-mint" : "bg-rose/10 text-rose",
                  )}
                >
                  {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {zh ? `比上次 ${delta > 0 ? "+" : ""}${delta} 分` : `${delta > 0 ? "+" : ""}${delta} since last visit`}
                </span>
              )}
              <p className="mt-2 text-[10px] leading-4 text-titanium">
                {tx(locale, "Tap the pet to hear more. A planning aid, not investment advice.")}
              </p>
            </div>
          </div>

          {message && (
            <button
              className="focus-ring relative mt-4 block w-full rounded-2xl bg-[var(--surface-muted)] p-3.5 text-left"
              onClick={() => setMessageIndex((index) => index + 1)}
              type="button"
            >
              <span className="absolute -top-1.5 left-[52px] h-3 w-3 rotate-45 bg-[var(--surface-muted)]" />
              <span className="block text-xs leading-5 text-ink">{message}</span>
              {messages.length > 1 && (
                <span className="mt-1.5 block text-[9px] text-titanium">
                  {messageIndex % messages.length + 1} / {messages.length} · {tx(locale, "Tap for next")}
                </span>
              )}
            </button>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <HealthStat
              label={tx(locale, "Net worth")}
              status={netWorthUsd >= 0 ? "good" : "bad"}
              value={formatCurrency(netWorthUsd)}
            />
            <HealthStat
              label={tx(locale, "Savings rate")}
              status={savingsRate === null ? "na" : savingsRate >= 20 ? "good" : savingsRate >= 10 ? "warn" : "bad"}
              value={formatHealthRatio(savingsRate)}
            />
            <HealthStat
              label={tx(locale, "Fixed pressure")}
              status={fixedPressure === null ? "na" : fixedPressure <= 50 ? "good" : fixedPressure <= 70 ? "warn" : "bad"}
              value={formatHealthRatio(fixedPressure)}
            />
            <HealthStat
              label={tx(locale, "Debt-to-income")}
              status={debtIncomeRatio === null ? "na" : debtIncomeRatio <= 20 ? "good" : debtIncomeRatio <= 36 ? "warn" : "bad"}
              value={formatHealthRatio(debtIncomeRatio)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <Sparkles size={14} />
          </span>
          <h2 className="text-[15px] font-semibold text-ink">{tx(locale, "Heal your pet")}</h2>
        </div>
        {quests.length ? (
          <div className="mt-2 divide-y divide-line">
            {quests.map((quest) => (
              <div className="flex items-center justify-between gap-3 py-3" key={quest.id}>
                <p className="min-w-0 text-xs leading-5 text-ink">{quest.label}</p>
                <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
                  +{quest.points}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl bg-[var(--surface-muted)] p-4 text-center text-xs leading-5 text-titanium">
            {tx(locale, "No quests right now — your pet is in great shape!")}
          </p>
        )}
      </section>
    </>
  );
}

function HealthStat({
  label,
  status,
  value,
}: {
  label: string;
  status: "good" | "warn" | "bad" | "na";
  value: string;
}) {
  const dotColor = status === "good" ? "#34b27b" : status === "warn" ? "#d99a3d" : status === "bad" ? "#e05d5d" : "#8d99ab";
  return (
    <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
        <p className="truncate text-[10px] font-medium text-titanium">{label}</p>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function HealthPet({ mood }: { mood: PetMood }) {
  const body = mood === "sick" ? "#b8b09a" : mood === "tired" ? "#cbb578" : "#dabb5e";
  const bodyDark = mood === "sick" ? "#a49c86" : mood === "tired" ? "#b49d5e" : "#c2a344";
  const belly = mood === "sick" ? "#d6cfc0" : "#f0deA8";
  const earTransform = mood === "tired" || mood === "sick" ? "rotate(18 34 34)" : undefined;
  const earTransformRight = mood === "tired" || mood === "sick" ? "rotate(-18 86 34)" : undefined;

  return (
    <svg aria-hidden="true" className={`health-pet health-pet--${mood}`} height="92" viewBox="0 0 120 120" width="92">
      {/* ears */}
      <path d="M28 44 L34 18 L52 34 Z" fill={bodyDark} transform={earTransform} />
      <path d="M92 44 L86 18 L68 34 Z" fill={bodyDark} transform={earTransformRight} />
      {/* body */}
      <ellipse cx="60" cy="70" fill={body} rx="40" ry="38" />
      <ellipse cx="60" cy="84" fill={belly} rx="24" ry="18" />
      {/* face */}
      {mood === "thriving" && (
        <>
          <path d="M40 58 q5 -7 10 0" fill="none" stroke="#3a2d10" strokeLinecap="round" strokeWidth="3" />
          <path d="M70 58 q5 -7 10 0" fill="none" stroke="#3a2d10" strokeLinecap="round" strokeWidth="3" />
          <path d="M50 72 q10 10 20 0" fill="none" stroke="#3a2d10" strokeLinecap="round" strokeWidth="3" />
          <g className="health-pet__sparkle" fill="#f2cf5b">
            <path d="M99 30 l2.5 5.5 5.5 2.5 -5.5 2.5 -2.5 5.5 -2.5 -5.5 -5.5 -2.5 5.5 -2.5 Z" />
            <path d="M18 48 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8 Z" />
            <path d="M103 66 l1.5 3.4 3.4 1.5 -3.4 1.5 -1.5 3.4 -1.5 -3.4 -3.4 -1.5 3.4 -1.5 Z" />
          </g>
        </>
      )}
      {mood === "happy" && (
        <>
          <circle cx="45" cy="58" fill="#3a2d10" r="4" />
          <circle cx="75" cy="58" fill="#3a2d10" r="4" />
          <circle cx="46.5" cy="56.5" fill="#fff" r="1.3" />
          <circle cx="76.5" cy="56.5" fill="#fff" r="1.3" />
          <path d="M52 71 q8 7 16 0" fill="none" stroke="#3a2d10" strokeLinecap="round" strokeWidth="3" />
        </>
      )}
      {mood === "okay" && (
        <>
          <circle cx="45" cy="58" fill="#3a2d10" r="3.4" />
          <circle cx="75" cy="58" fill="#3a2d10" r="3.4" />
          <path d="M53 72 h14" fill="none" stroke="#3a2d10" strokeLinecap="round" strokeWidth="3" />
        </>
      )}
      {mood === "tired" && (
        <>
          <path d="M40 59 h11" fill="none" stroke="#3a2d10" strokeLinecap="round" strokeWidth="3" />
          <path d="M69 59 h11" fill="none" stroke="#3a2d10" strokeLinecap="round" strokeWidth="3" />
          <path d="M52 74 q8 -6 16 0" fill="none" stroke="#3a2d10" strokeLinecap="round" strokeWidth="3" />
          <path className="health-pet__sweat" d="M90 52 q6 8 0 12 q-6 -4 0 -12" fill="#7fb2e5" />
        </>
      )}
      {mood === "sick" && (
        <>
          <path d="M41 54 l8 8 M49 54 l-8 8" stroke="#3a2d10" strokeLinecap="round" strokeWidth="2.6" />
          <path d="M71 54 l8 8 M79 54 l-8 8" stroke="#3a2d10" strokeLinecap="round" strokeWidth="2.6" />
          <path d="M51 75 q4 -4 9 0 q5 4 9 0" fill="none" stroke="#3a2d10" strokeLinecap="round" strokeWidth="2.6" />
          <g transform="rotate(-24 60 34)">
            <rect fill="#e8d9b0" height="7" rx="2.5" width="22" x="49" y="30" />
            <rect fill="#e8d9b0" height="22" rx="2.5" transform="rotate(90 60 33.5)" width="7" x="56.5" y="22.5" />
          </g>
        </>
      )}
      {/* cheeks */}
      {(mood === "thriving" || mood === "happy") && (
        <>
          <ellipse cx="37" cy="67" fill="#e08c6a" opacity="0.45" rx="4.5" ry="3" />
          <ellipse cx="83" cy="67" fill="#e08c6a" opacity="0.45" rx="4.5" ry="3" />
        </>
      )}
    </svg>
  );
}

function buildExpenseCategoryDonut(transactions: CashflowTransaction[], twdToUsd: number, locale: Locale) {
  const zh = locale === "zh";
  const monthKey = new Date().toISOString().slice(0, 7);
  const categoryLabel = (id: string) => {
    const match = expenseCategories.find((category) => category.id === id);
    if (match) return zh ? match.zh : match.en;
    return id || (tx(locale, "Other"));
  };

  const totals = new Map<string, number>();
  transactions
    .filter((transaction) => transaction.transaction_type === "expense" && transaction.transaction_date.slice(0, 7) === monthKey)
    .forEach((transaction) => {
      const label = categoryLabel(transaction.category);
      const amount = currencyAmountToUsd(transaction.amount, transaction.currency, twdToUsd);
      totals.set(label, (totals.get(label) ?? 0) + amount);
    });

  const ordered = [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);

  const top = ordered.slice(0, 5);
  const restValue = ordered.slice(5).reduce((sum, entry) => sum + entry.value, 0);
  const result = top.map((entry, index) => ({
    color: chartPalette[index % chartPalette.length],
    name: entry.name,
    value: entry.value,
  }));
  if (restValue > 0) {
    result.push({ color: "#8d99ab", name: tx(locale, "Others"), value: restValue });
  }
  return result;
}

function MobileMore({
  demo,
  locale,
  portfolioName,
  userEmail,
  onEditName,
  onLocaleChange,
  onSignOut,
}: {
  demo: boolean;
  locale: Locale;
  portfolioName: string;
  userEmail: string;
  onEditName: () => void;
  onLocaleChange: (locale: Locale) => void;
  onSignOut: () => void;
}) {
  const zh = locale === "zh";
  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-semibold text-ink">{tx(locale, "Display")}</h2>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-titanium">{tx(locale, "Portfolio name")}</span>
          <button
            className="focus-ring flex items-center gap-1.5 rounded-full border border-line bg-[var(--surface-muted)] px-3 py-2 text-xs font-semibold text-ink"
            onClick={onEditName}
            type="button"
          >
            {portfolioName ? (zh ? `${portfolioName}的資產` : `${portfolioName}'s assets`) : (tx(locale, "Not set"))}
            <Pencil className="text-titanium" size={12} />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-titanium">{tx(locale, "Theme")}</span>
          <ThemeToggle compact locale={locale} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-titanium">{tx(locale, "Language")}</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {localeOrder.map((item) => (
              <button
                className={clsx("focus-ring rounded-2xl border border-line px-3 py-2 text-sm font-semibold", locale === item ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-titanium")}
                key={item}
                onClick={() => onLocaleChange(item)}
                type="button"
              >
                {localeNames[item]}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="rounded-[24px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
        <p className="text-xs text-titanium">{demo ? "Demo mode" : tx(locale, "Signed in")}</p>
        <p className="mt-1 truncate text-sm font-medium text-ink">{demo ? (tx(locale, "Read-only sample data")) : userEmail}</p>
        {!demo && (
          <button className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-rose/20 bg-rose/10 text-sm font-semibold text-rose" onClick={onSignOut} type="button">
            <LogOut size={17} />
            {tx(locale, "Sign out")}
          </button>
        )}
      </section>
    </div>
  );
}

function MobileHoldingSheet({
  editing,
  demo,
  form,
  locale,
  userId,
  onClose,
  onHoldingsChanged,
  onSave,
  onUpdate,
}: {
  editing: boolean;
  demo: boolean;
  form: HoldingInput;
  locale: Locale;
  userId: string;
  onClose: () => void;
  onHoldingsChanged: () => Promise<void>;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof HoldingInput>(key: K, value: HoldingInput[K]) => void;
}) {
  const [mode, setMode] = useState<"manual" | "wallet">("manual");
  return (
    <MobileSheet title={editing ? (tx(locale, "Edit holding")) : (tx(locale, "Add holding"))} onClose={onClose}>
      {!editing && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-line bg-[var(--surface-muted)] p-1">
          <button
            aria-pressed={mode === "manual"}
            className={clsx(
              "focus-ring min-h-10 rounded-full px-3 text-sm font-semibold transition",
              mode === "manual"
                ? "bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm"
                : "text-titanium",
            )}
            onClick={() => setMode("manual")}
            type="button"
          >
            {tx(locale, "Manual")}
          </button>
          <button
            aria-pressed={mode === "wallet"}
            className={clsx(
              "focus-ring min-h-10 rounded-full px-3 text-sm font-semibold transition",
              mode === "wallet"
                ? "bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm"
                : "text-titanium",
            )}
            onClick={() => setMode("wallet")}
            type="button"
          >
            {tx(locale, "Address tracking")}
          </button>
        </div>
      )}

      {mode === "wallet" && !editing ? (
        <WalletTracker
          demo={demo}
          locale={locale}
          userId={userId}
          onHoldingsChanged={onHoldingsChanged}
        />
      ) : (
      <form className="space-y-4" onSubmit={onSave}>
        <MobileField label={tx(locale, "Asset type")}>
          <select className="input-control w-full px-3" value={form.asset_type} onChange={(event) => onUpdate("asset_type", event.target.value as AssetType)}>
            <option value="us_stock">{tx(locale, "US stock")}</option>
            <option value="tw_stock">{tx(locale, "Taiwan stock")}</option>
            <option value="crypto">{tx(locale, "Crypto")}</option>
            <option value="cash">{tx(locale, "Cash")}</option>
          </select>
        </MobileField>
        <div className="grid grid-cols-2 gap-3">
          <MobileField label={tx(locale, "Symbol")}>
            <input className="input-control w-full px-3 uppercase" value={form.symbol} onChange={(event) => onUpdate("symbol", event.target.value)} required />
          </MobileField>
          <MobileField label={tx(locale, "Currency")}>
            <select className="input-control w-full px-3" value={form.cost_currency} onChange={(event) => onUpdate("cost_currency", event.target.value as Currency)}>
              <option value="USD">USD</option>
              <option value="TWD">TWD</option>
            </select>
          </MobileField>
        </div>
        <MobileField label={tx(locale, "Name")}>
          <input className="input-control w-full px-3" value={form.name} onChange={(event) => onUpdate("name", event.target.value)} />
        </MobileField>
        <div className="grid grid-cols-2 gap-3">
          <MobileField label={form.asset_type === "tw_stock" ? (tx(locale, "Lots")) : (tx(locale, "Quantity"))}>
            <input className="input-control w-full px-3" inputMode="decimal" type="text" value={form.quantity} onChange={(event) => {
              const next = cleanNumber(event.target.value);
              if (next !== null) onUpdate("quantity", next);
            }} />
          </MobileField>
          <MobileField label={tx(locale, "Average cost")}>
            <input className="input-control w-full px-3" inputMode="decimal" type="text" value={form.average_cost} onChange={(event) => {
              const next = cleanNumber(event.target.value);
              if (next !== null) onUpdate("average_cost", next);
            }} />
          </MobileField>
        </div>
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-[var(--surface-muted)] px-4 text-sm text-ink">
          <input checked={form.cost_known !== false} onChange={(event) => onUpdate("cost_known", event.target.checked)} type="checkbox" />
          {tx(locale, "Cost basis known")}
        </label>
        <button className="primary-button min-h-12 w-full rounded-full font-semibold" type="submit">
          {editing ? (tx(locale, "Save changes")) : (tx(locale, "Add holding"))}
        </button>
      </form>
      )}
    </MobileSheet>
  );
}

function MobileCashflowSheet({
  form,
  locale,
  onClose,
  onSave,
  onUpdate,
}: {
  form: CashflowTransactionInput;
  locale: Locale;
  onClose: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof CashflowTransactionInput>(key: K, value: CashflowTransactionInput[K]) => void;
}) {
  const categories = form.transaction_type === "income" ? incomeCategories : expenseCategories;
  return (
    <MobileSheet title={form.transaction_type === "income" ? (tx(locale, "Add income")) : (tx(locale, "Add expense"))} onClose={onClose}>
      <form className="space-y-4" onSubmit={onSave}>
        <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-[var(--surface-muted)] p-1">
          {(["expense", "income"] as CashflowType[]).map((type) => (
            <button
              className={clsx("focus-ring min-h-10 rounded-full text-sm font-semibold transition", form.transaction_type === type ? "bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm" : "text-titanium")}
              key={type}
              onClick={() => onUpdate("transaction_type", type)}
              type="button"
            >
              {type === "expense" ? (tx(locale, "Expense")) : (tx(locale, "Income"))}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_92px] gap-3">
          <MobileField label={tx(locale, "Amount")}>
            <input className="input-control w-full px-3 text-xl font-semibold" inputMode="decimal" type="text" value={form.amount} onChange={(event) => {
              const next = cleanNumber(event.target.value);
              if (next !== null) onUpdate("amount", next);
            }} />
          </MobileField>
          <MobileField label={tx(locale, "Currency")}>
            <select className="input-control w-full px-3" value={form.currency} onChange={(event) => onUpdate("currency", event.target.value as Currency)}>
              <option value="USD">USD</option>
              <option value="TWD">TWD</option>
            </select>
          </MobileField>
        </div>
        <MobileField label={tx(locale, "Category")}>
          <select className="input-control w-full px-3" value={form.category} onChange={(event) => onUpdate("category", event.target.value)}>
            {categories.map((category) => <option key={category.id} value={category.id}>{tx(locale, category.en)}</option>)}
          </select>
        </MobileField>
        <MobileField label={tx(locale, "Description")}>
          <input className="input-control w-full px-3" value={form.description} onChange={(event) => onUpdate("description", event.target.value)} />
        </MobileField>
        <MobileField label={tx(locale, "Date")}>
          <input className="input-control w-full px-3" type="date" value={form.transaction_date} onChange={(event) => onUpdate("transaction_date", event.target.value)} />
        </MobileField>
        <MobileField label={tx(locale, "Payment method")}>
          <select className="input-control w-full px-3" value={form.payment_method} onChange={(event) => onUpdate("payment_method", event.target.value)}>
            <option value="">{tx(locale, "Not set")}</option>
            <option value="Credit card">{tx(locale, "Credit card")}</option>
            <option value="Cash">{tx(locale, "Cash")}</option>
            <option value="Transfer">{tx(locale, "Bank transfer")}</option>
          </select>
        </MobileField>
        <button className="primary-button min-h-12 w-full rounded-full font-semibold" type="submit">
          {tx(locale, "Save transaction")}
        </button>
      </form>
    </MobileSheet>
  );
}

function MobileRecurringSheet({
  form,
  locale,
  onClose,
  onSave,
  onUpdate,
}: {
  form: RecurringExpenseInput;
  locale: Locale;
  onClose: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof RecurringExpenseInput>(
    key: K,
    value: RecurringExpenseInput[K],
  ) => void;
}) {
  return (
    <MobileSheet title={tx(locale, "Add recurring expense")} onClose={onClose}>
      <form className="space-y-4" onSubmit={onSave}>
        <MobileField label={tx(locale, "Name")}>
          <input className="input-control w-full px-3" value={form.name} onChange={(event) => onUpdate("name", event.target.value)} required />
        </MobileField>
        <div className="grid grid-cols-[1fr_92px] gap-3">
          <MobileField label={tx(locale, "Amount")}>
            <input className="input-control w-full px-3 text-lg font-semibold" inputMode="decimal" type="text" value={form.amount} onChange={(event) => {
              const next = cleanNumber(event.target.value);
              if (next !== null) onUpdate("amount", next);
            }} />
          </MobileField>
          <MobileField label={tx(locale, "Currency")}>
            <select className="input-control w-full px-3" value={form.currency} onChange={(event) => onUpdate("currency", event.target.value as Currency)}>
              <option value="USD">USD</option>
              <option value="TWD">TWD</option>
            </select>
          </MobileField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MobileField label={tx(locale, "Frequency")}>
            <select className="input-control w-full px-3" value={form.frequency} onChange={(event) => onUpdate("frequency", event.target.value as RecurringExpenseInput["frequency"])}>
              <option value="monthly">{tx(locale, "Monthly")}</option>
              <option value="yearly">{tx(locale, "Yearly")}</option>
            </select>
          </MobileField>
          <MobileField label={tx(locale, "Next due")}>
            <input className="input-control w-full px-2" type="date" value={form.next_due_date} onChange={(event) => onUpdate("next_due_date", event.target.value)} required />
          </MobileField>
        </div>
        <MobileField label={tx(locale, "Category")}>
          <select className="input-control w-full px-3" value={form.category} onChange={(event) => onUpdate("category", event.target.value)}>
            <option value="subscription">{tx(locale, "Subscription")}</option>
            <option value="rent">{tx(locale, "Rent")}</option>
            <option value="insurance">{tx(locale, "Insurance")}</option>
            <option value="utilities">{tx(locale, "Utilities")}</option>
            <option value="phone">{tx(locale, "Phone")}</option>
            <option value="membership">{tx(locale, "Membership")}</option>
            <option value="other_recurring">{tx(locale, "Other")}</option>
          </select>
        </MobileField>
        <MobileField label={tx(locale, "Payment method")}>
          <select className="input-control w-full px-3" value={form.payment_method} onChange={(event) => onUpdate("payment_method", event.target.value)}>
            <option value="">{tx(locale, "Not set")}</option>
            <option value="Credit card">{tx(locale, "Credit card")}</option>
            <option value="Transfer">{tx(locale, "Bank transfer")}</option>
            <option value="Cash">{tx(locale, "Cash")}</option>
          </select>
        </MobileField>
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-[var(--surface-muted)] px-4 text-sm text-ink">
          <input checked={form.is_subscription} onChange={(event) => onUpdate("is_subscription", event.target.checked)} type="checkbox" />
          {tx(locale, "This is a subscription")}
        </label>
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-[var(--surface-muted)] px-4 text-sm text-ink">
          <input checked={form.is_active} onChange={(event) => onUpdate("is_active", event.target.checked)} type="checkbox" />
          {tx(locale, "Active recurring payment")}
        </label>
        <button className="primary-button min-h-12 w-full rounded-full font-semibold" type="submit">
          {tx(locale, "Save recurring expense")}
        </button>
      </form>
    </MobileSheet>
  );
}

function MobileDebtSheet({
  form,
  locale,
  onClose,
  onSave,
  onUpdate,
}: {
  form: DebtInput;
  locale: Locale;
  onClose: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof DebtInput>(key: K, value: DebtInput[K]) => void;
}) {
  const debtTypes: DebtType[] = ["mortgage", "car_loan", "student_loan", "credit_card", "personal_loan", "other"];
  return (
    <MobileSheet title={tx(locale, "Add loan or debt")} onClose={onClose}>
      <form className="space-y-4" onSubmit={onSave}>
        <MobileField label={tx(locale, "Name")}>
          <input className="input-control w-full px-3" value={form.name} onChange={(event) => onUpdate("name", event.target.value)} required />
        </MobileField>
        <div className="grid grid-cols-[1fr_92px] gap-3">
          <MobileField label={tx(locale, "Debt type")}>
            <select className="input-control w-full px-3" value={form.debt_type} onChange={(event) => onUpdate("debt_type", event.target.value as DebtType)}>
              {debtTypes.map((type) => <option key={type} value={type}>{debtTypeLabel(type, locale)}</option>)}
            </select>
          </MobileField>
          <MobileField label={tx(locale, "Currency")}>
            <select className="input-control w-full px-3" value={form.currency} onChange={(event) => onUpdate("currency", event.target.value as Currency)}>
              <option value="USD">USD</option>
              <option value="TWD">TWD</option>
            </select>
          </MobileField>
        </div>
        <MobileField label={tx(locale, "Lender")}>
          <input className="input-control w-full px-3" value={form.lender} onChange={(event) => onUpdate("lender", event.target.value)} />
        </MobileField>
        <div className="grid grid-cols-2 gap-3">
          <MobileNumericField label={tx(locale, "Original principal")} value={form.original_principal} onChange={(value) => onUpdate("original_principal", value)} />
          <MobileNumericField label={tx(locale, "Remaining balance")} value={form.remaining_principal} onChange={(value) => onUpdate("remaining_principal", value)} />
          <MobileNumericField label={tx(locale, "APR %")} value={form.interest_rate} onChange={(value) => onUpdate("interest_rate", value)} />
          <MobileNumericField label={tx(locale, "Minimum payment")} value={form.minimum_payment} onChange={(value) => onUpdate("minimum_payment", value)} />
        </div>
        <MobileField label={tx(locale, "Next payment")}>
          <input className="input-control w-full px-3" type="date" value={form.next_payment_date} onChange={(event) => onUpdate("next_payment_date", event.target.value)} required />
        </MobileField>
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-[var(--surface-muted)] px-4 text-sm text-ink">
          <input checked={form.is_active} onChange={(event) => onUpdate("is_active", event.target.checked)} type="checkbox" />
          {tx(locale, "Active debt")}
        </label>
        <button className="primary-button min-h-12 w-full rounded-full font-semibold" type="submit">
          {tx(locale, "Save debt")}
        </button>
      </form>
    </MobileSheet>
  );
}

function MobileNameSheet({
  locale,
  portfolioName,
  onClose,
  onSave,
}: {
  locale: Locale;
  portfolioName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const zh = locale === "zh";
  const [value, setValue] = useState(portfolioName);
  return (
    <MobileSheet title={tx(locale, "Name your portfolio")} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(value);
        }}
      >
        <MobileField label={tx(locale, "Name (up to 12 characters)")}>
          <input
            autoFocus
            className="input-control w-full px-3"
            maxLength={12}
            placeholder={tx(locale, "e.g. Max")}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </MobileField>
        {value.trim() && (
          <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent)]">
            {zh ? `${value.trim().slice(0, 12)}的資產` : `${value.trim().slice(0, 12)}'s assets`}
          </p>
        )}
        <p className="text-xs leading-5 text-titanium">
          {tx(locale, "Save with an empty name to restore the default title.")}
        </p>
        <button className="primary-button min-h-12 w-full rounded-full font-semibold" type="submit">
          {tx(locale, "Save name")}
        </button>
      </form>
    </MobileSheet>
  );
}

function MobileSheet({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm">
      <section className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[30px] border-t border-line bg-[var(--surface-raised)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <button className="focus-ring flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-titanium" onClick={onClose} type="button">
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function MobileBottomNav({
  active,
  locale,
  onSelect,
}: {
  active: MobileTab;
  locale: Locale;
  onSelect: (tab: MobileTab) => void;
}) {
  const items: Array<{ icon: React.ReactNode; id: MobileTab; label: string }> = [
    { id: "home", icon: <LayoutDashboard size={19} />, label: tx(locale, "Home") },
    { id: "holdings", icon: <WalletCards size={19} />, label: tx(locale, "Holdings") },
    { id: "cashflow", icon: <ReceiptText size={19} />, label: tx(locale, "Cashflow") },
    { id: "insights", icon: <BarChart3 size={19} />, label: tx(locale, "Insights") },
    { id: "more", icon: <Ellipsis size={20} />, label: tx(locale, "More") },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto grid max-w-lg grid-cols-5 rounded-[26px] border border-line bg-[color-mix(in_srgb,var(--surface-raised)_90%,transparent)] px-1.5 py-1 shadow-[var(--shadow)] backdrop-blur-2xl">
        {items.map((item) => (
          <button
            aria-current={active === item.id ? "page" : undefined}
            className={clsx(
              "focus-ring flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-medium transition",
              active === item.id ? "text-[var(--accent)]" : "text-titanium",
            )}
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <span
              className={clsx(
                "flex h-7 min-w-11 items-center justify-center rounded-full transition",
                active === item.id && "bg-[var(--accent-soft)]",
              )}
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function MobileMetric({
  icon,
  label,
  onClick,
  tone,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  tone?: "positive" | "negative";
  value: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span
          className={clsx(
            "flex h-8 w-8 items-center justify-center rounded-full",
            tone === "positive" ? "bg-mint/10 text-mint" : tone === "negative" ? "bg-rose/10 text-rose" : "bg-[var(--surface-muted)] text-titanium",
          )}
        >
          {icon}
        </span>
        {onClick && <ChevronRight className="text-titanium" size={15} />}
      </div>
      <p className="mt-3 truncate text-[11px] font-medium text-titanium">{label}</p>
      <p className={clsx("mt-0.5 truncate text-lg font-semibold tracking-[-0.035em]", tone === "positive" ? "text-mint" : tone === "negative" ? "text-rose" : "text-ink")}>{value}</p>
    </>
  );
  const className = "min-w-0 rounded-[20px] border border-line bg-[var(--surface-raised)] p-4 text-left shadow-[var(--shadow-soft)]";

  if (onClick) {
    return (
      <button aria-label={label} className={clsx("focus-ring w-full transition active:scale-[0.98]", className)} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return (
    <article className={className}>
      {content}
    </article>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="focus-ring flex min-h-[58px] items-center gap-2.5 rounded-[20px] border border-line bg-[var(--surface-raised)] px-3.5 py-3 text-left shadow-[var(--shadow-soft)] transition active:scale-[0.98]"
      onClick={onClick}
      type="button"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">{icon}</span>
      <span className="text-[13px] font-semibold leading-4 text-ink">{label}</span>
    </button>
  );
}

function MobileAssetRow({ holding, locale }: { holding: EnrichedHolding; locale: Locale }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <AssetMark assetType={holding.asset_type} symbol={holding.symbol} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{holding.symbol}</p>
          <p className="mt-0.5 truncate text-xs text-titanium">{holding.name}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-ink">{formatCurrency(holding.valueUsd)}</p>
        <p className={clsx("mt-0.5 text-xs font-medium", holding.cost_known === false ? "text-titanium" : holding.gainUsd >= 0 ? "text-mint" : "text-rose")}>
          {holding.cost_known === false ? (tx(locale, "Unknown cost")) : formatPercent(holding.gainPercent)}
        </p>
      </div>
    </div>
  );
}

function AssetMark({ assetType, symbol }: { assetType?: AssetType; symbol: string }) {
  const tone = assetTypeTone(assetType);
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ backgroundColor: tone.soft, color: tone.solid }}
    >
      {symbol.replace(/\..*$/, "").slice(0, 3).toUpperCase()}
    </span>
  );
}

function assetTypeTone(assetType?: AssetType) {
  switch (assetType) {
    case "us_stock":
      return { solid: "#6f7ce8", soft: "rgba(111, 124, 232, 0.14)" };
    case "tw_stock":
      return { solid: "#2fa88b", soft: "rgba(47, 168, 139, 0.14)" };
    case "crypto":
      return { solid: "#d99a3d", soft: "rgba(217, 154, 61, 0.14)" };
    case "cash":
      return { solid: "#8d99ab", soft: "rgba(141, 153, 171, 0.16)" };
    default:
      return { solid: "var(--accent)", soft: "var(--accent-soft)" };
  }
}

const chartPalette = ["#c9a227", "#6f7ce8", "#2fa88b", "#d97757", "#8d99ab", "#a678d9"];

function buildAllocationSegments(holdings: EnrichedHolding[]) {
  const sorted = [...holdings].sort((a, b) => b.allocationPercent - a.allocationPercent);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((sum, item) => sum + item.allocationPercent, 0);
  const segments = top
    .filter((item) => item.allocationPercent > 0)
    .map((item, index) => ({
      color: chartPalette[index % chartPalette.length],
      id: item.id,
      label: item.symbol.replace(/\..*$/, ""),
      percent: item.allocationPercent,
    }));
  if (rest > 0.5) {
    segments.push({ color: "#8d99ab", id: "others", label: "Others", percent: rest });
  }
  return segments;
}

function AssetFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] text-titanium">{label}</p>
      <p className="mt-1 truncate font-semibold text-ink">{value}</p>
    </div>
  );
}

function PerformanceCard({
  holding,
  label,
  positive = false,
}: {
  holding?: EnrichedHolding;
  label: string;
  positive?: boolean;
}) {
  return (
    <article className="rounded-[20px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium text-titanium">{label}</p>
        <span className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", positive ? "bg-mint/10 text-mint" : "bg-rose/10 text-rose")}>
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        </span>
      </div>
      <p className="mt-2.5 truncate text-base font-semibold text-ink">{holding?.symbol ?? "N/A"}</p>
      <p className={clsx("mt-0.5 text-sm font-semibold", positive ? "text-mint" : "text-rose")}>{holding ? formatPercent(holding.gainPercent) : "N/A"}</p>
    </article>
  );
}

function MobileField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-titanium">{label}</span>
      {children}
    </label>
  );
}

function MobileNumericField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <MobileField label={label}>
      <input className="input-control w-full px-3" inputMode="decimal" type="text" value={value} onChange={(event) => {
        const next = cleanNumber(event.target.value);
        if (next !== null) onChange(next);
      }} />
    </MobileField>
  );
}

function EmptyMobileState({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-line bg-[var(--surface-muted)] p-8 text-center text-sm text-titanium">
      {text}
    </div>
  );
}

function debtTypeLabel(type: DebtType, locale: Locale) {
  const labels: Record<DebtType, string> = {
    mortgage: "Mortgage",
    car_loan: "Car loan",
    student_loan: "Student loan",
    credit_card: "Credit card",
    personal_loan: "Personal loan",
    other: "Other",
  };
  return tx(locale, labels[type]);
}

function getTransactionBuckets(transactions: CashflowTransaction[]) {
  const result = {
    income: { USD: 0, TWD: 0 },
    expense: { USD: 0, TWD: 0 },
  };
  transactions.forEach((transaction) => {
    result[transaction.transaction_type][transaction.currency] += transaction.amount;
  });
  return result;
}

function formatBuckets(values: Record<Currency, number>) {
  const parts = (["USD", "TWD"] as Currency[])
    .filter((currency) => values[currency] !== 0)
    .map((currency) => formatCurrency(values[currency], currency));
  return parts.length ? parts.join(" / ") : "$0.00";
}

function formatQuantity(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

type MobileScheduleGroup = {
  debts: Debt[];
  recurring: RecurringExpense[];
};

function buildMobileScheduleMap(
  days: Date[],
  recurringExpenses: RecurringExpense[],
  debts: Debt[],
) {
  return days.reduce<Map<string, MobileScheduleGroup>>((map, day) => {
    const dateKey = localDateKey(day);
    const recurring = recurringExpenses.filter(
      (expense) => expense.is_active && isRecurringDueOn(expense, day),
    );
    const scheduledDebts = debts.filter(
      (debt) => debt.is_active && isMonthlyDueOn(debt.next_payment_date, day),
    );
    if (recurring.length || scheduledDebts.length) {
      map.set(dateKey, { debts: scheduledDebts, recurring });
    }
    return map;
  }, new Map());
}

function isRecurringDueOn(expense: RecurringExpense, target: Date) {
  const reference = parseLocalDate(expense.next_due_date);
  if (expense.frequency === "yearly") {
    return (
      target.getMonth() === reference.getMonth() &&
      target.getDate() === adjustedDueDay(reference.getDate(), target)
    );
  }
  return target.getDate() === adjustedDueDay(reference.getDate(), target);
}

function isMonthlyDueOn(referenceDate: string, target: Date) {
  const reference = parseLocalDate(referenceDate);
  return target.getDate() === adjustedDueDay(reference.getDate(), target);
}

function adjustedDueDay(day: number, target: Date) {
  return Math.min(day, new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate());
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function mobileCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatDueLabel(entries: Array<{ amount: number; currency: Currency }>, zh: boolean) {
  const totals: Record<Currency, number> = { USD: 0, TWD: 0 };
  entries.forEach((entry) => {
    totals[entry.currency] += entry.amount;
  });
  const active = (Object.entries(totals) as Array<[Currency, number]>).filter(([, value]) => value > 0);
  if (active.length === 1) {
    const [currency, value] = active[0];
    return formatCompactAmount(value, currency);
  }
  return zh ? `${entries.length} 筆` : `${entries.length} due`;
}

function formatCompactAmount(value: number, currency: Currency) {
  const symbol = currency === "TWD" ? "NT$" : "$";
  if (value >= 10000) return `${symbol}${Math.round(value / 1000)}K`;
  if (value >= 1000) return `${symbol}${(value / 1000).toFixed(1)}K`;
  return `${symbol}${Math.round(value)}`;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string, locale: Locale) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale === "zh" ? "zh-TW" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function cleanNumber(value: string) {
  const normalized = value.replace(/,/g, "");
  return /^\d*(?:\.\d*)?$/.test(normalized) ? normalized : null;
}
