"use client";

import { CashflowFlow } from "./cashflow-flow";
import { InvestmentCost } from "./investment-cost";
import { financialCopy } from "./financial-summary-copy";

import { useMemo, useRef, useState } from "react";
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
  MoreHorizontal,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import clsx from "clsx";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { BankMark } from "@/components/bank-mark";
import { GainCalculationModeSelector } from "@/components/gain-calculation-mode-selector";
import { GainCoverageWarning } from "@/components/gain-coverage-warning";
import {
  InvestmentHistoryPanel,
  InvestmentPerformancePanel,
  InvestmentSaleModal,
  getRecordSaleLabel,
} from "@/components/investment-ledger";
import { HoldingBubbles } from "@/components/holding-bubbles";
import { ThemeToggle } from "@/components/theme-toggle";
import { StockSymbolSearch } from "@/components/stock-symbol-search";
import { WalletTracker } from "@/components/wallet-tracker";
import { getDictionary, localeNames, localeOrder, tx } from "@/lib/i18n";
import { MoneyProvider, useMoney } from "@/components/money-context";
import { createMoney, formatCurrencyBuckets, formatCurrentPrice, type MoneyFmt } from "@/lib/money";
import { tapLight } from "@/lib/haptics";
import { supportedCurrencies } from "@/lib/types";
import {
  aggregateHoldingsForOverview,
  currencyAmountToUsd,
  currencySymbols,
  emptyCurrencyBuckets,
  usdToCurrency,
  formatPercent,
  getPortfolioTotals,
  type CurrencyFxInput,
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
  Holding,
  HoldingInput,
  InvestmentPerformance,
  InvestmentSaleInput,
  InvestmentTransaction,
  Locale,
  MonthlyBudget,
  RecurringExpense,
  RecurringExpenseInput,
} from "@/lib/types";

type MobileTab = "home" | "holdings" | "bank" | "cashflow" | "insights" | "more";

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
  fxStatus?: React.ReactNode;
  refreshedAt?: string;
  refreshing: boolean;
  transactions: CashflowTransaction[];
  investmentPerformance: InvestmentPerformance;
  investmentTransactions: InvestmentTransaction[];
  biometricAvailable: boolean;
  biometricLock: boolean;
  nativePlatform: boolean;
  paymentReminders: boolean;
  displayCurrency: Currency;
  fx: CurrencyFxInput;
  userEmail: string;
  userId: string;
  onBiometricLockChange: (next: boolean) => void;
  onPaymentRemindersChange: (next: boolean) => void;
  onDeleteHolding: (id: string) => void;
  onEditHolding: (holding: Holding) => void;
  onSellHolding: (holding: EnrichedHolding) => void;
  onCloseSale: () => void;
  onRecordSale: (input: InvestmentSaleInput) => Promise<void>;
  sellingHolding: EnrichedHolding | null;
  editingDebt: boolean;
  editingRecurring: boolean;
  onDeleteDebt: (id: string) => void;
  onDeleteRecurring: (id: string) => void;
  onEditDebt: (debt: Debt) => void;
  onEditRecurring: (expense: RecurringExpense) => void;
  onDisplayCurrencyChange: (currency: Currency) => void;
  onHoldingsChanged: () => Promise<void>;
  onLocaleChange: (locale: Locale) => void;
  onPortfolioNameChange: (name: string) => void;
  onRefresh: () => void;
  onResetCashflow: () => void;
  onResetDebt: () => void;
  onResetHolding: () => void;
  onResetCashHolding: () => void;
  onResetRecurring: () => void;
  onSaveCashflow: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveDebt: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveHolding: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveRecurring: (event: React.FormEvent<HTMLFormElement>) => void;
  onDeleteAccount: () => Promise<void>;
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
    investmentPerformance,
    investmentTransactions,
    biometricAvailable,
    biometricLock,
    nativePlatform,
    paymentReminders,
    displayCurrency,
    fx,
    userEmail,
    userId,
  } = props;
  const money = useMemo<MoneyFmt>(() => createMoney(displayCurrency, fx), [displayCurrency, fx]);
  const [tab, setTab] = useState<MobileTab>("home");
  const [holdingSheet, setHoldingSheet] = useState(false);
  const [cashflowSheet, setCashflowSheet] = useState(false);
  const [recurringSheet, setRecurringSheet] = useState(false);
  const [debtSheet, setDebtSheet] = useState(false);
  const [nameSheet, setNameSheet] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
    tapLight();
    setTab(next);
    scrollContainerRef.current?.scrollTo({ behavior: "smooth", top: 0 });
  }

  return (
    <MoneyProvider money={money}>
    <main className="mobile-app flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--page)]">
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

      <div
        className="mobile-app-scroll min-h-0 w-full flex-1 px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-4"
        ref={scrollContainerRef}
      >
        <div className="mx-auto max-w-lg">
        {props.fxStatus}
        {error && (
          <div className="mb-4 rounded-2xl border border-rose/25 bg-rose/10 p-3 text-sm text-rose">
            {error}
          </div>
        )}

        {tab === "home" && (
          <MobileHome
            costHoldings={enriched}
            investmentPerformance={investmentPerformance}
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
            holdings={enriched.filter((holding) => holding.asset_type !== "cash")}
            investmentTransactions={investmentTransactions}
            locale={locale}
            onAdd={() => {
              props.onResetHolding();
              setHoldingSheet(true);
            }}
            onDelete={props.onDeleteHolding}
            onEdit={(holding) => {
              props.onEditHolding(holding);
              setHoldingSheet(true);
            }}
            onSell={props.onSellHolding}
          />
        )}

        {tab === "bank" && (
          <MobileHoldings
            cashOnly
            demo={demo}
            holdings={overview.filter((holding) => holding.asset_type === "cash")}
            locale={locale}
            onAdd={() => {
              props.onResetCashHolding();
              setHoldingSheet(true);
            }}
            onDelete={props.onDeleteHolding}
            onEdit={(holding) => {
              props.onEditHolding(holding);
              setHoldingSheet(true);
            }}
          />
        )}

        {tab === "cashflow" && (
          <MobileCashflow
            assetValue={totals.totalValue}
              cashValue={enriched.filter(h => h.asset_type === "cash").reduce((sum, h) => sum + h.valueUsd, 0)}
            debts={debts}
            demo={demo}
            locale={locale}
            recurringExpenses={recurringExpenses}
            transactions={transactions}
            onDeleteDebt={props.onDeleteDebt}
            onDeleteRecurring={props.onDeleteRecurring}
            onEditDebt={(debt) => {
              props.onEditDebt(debt);
              setDebtSheet(true);
            }}
            onEditRecurring={(expense) => {
              props.onEditRecurring(expense);
              setRecurringSheet(true);
            }}
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
            debts={debts}
            holdings={overview}
            locale={locale}
            recurringExpenses={recurringExpenses}
            totals={totals}
            transactions={transactions}
            fx={fx}
          />
        )}

        {tab === "more" && (
          <MobileMore
            biometricAvailable={biometricAvailable}
            biometricLock={biometricLock}
            nativePlatform={nativePlatform}
            paymentReminders={paymentReminders}
            demo={demo}
            displayCurrency={displayCurrency}
            locale={locale}
            portfolioName={portfolioName}
            userEmail={userEmail}
            onBiometricLockChange={props.onBiometricLockChange}
            onPaymentRemindersChange={props.onPaymentRemindersChange}
            onDisplayCurrencyChange={props.onDisplayCurrencyChange}
            onEditName={() => setNameSheet(true)}
            onLocaleChange={props.onLocaleChange}
            onOpenBank={() => selectTab("bank")}
            onDeleteAccount={props.onDeleteAccount}
            onSignOut={props.onSignOut}
          />
        )}
        </div>
      </div>

      <MobileBottomNav active={tab} locale={locale} onSelect={selectTab} />

      {holdingSheet && (
        <MobileHoldingSheet
          editing={props.editingHolding}
          cashOnly={tab === "bank"}
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
          editing={props.editingRecurring}
          form={recurringForm}
          locale={locale}
          onClose={() => setRecurringSheet(false)}
          onSave={props.onSaveRecurring}
          onUpdate={props.onUpdateRecurring}
        />
      )}

      {debtSheet && (
        <MobileDebtSheet
          editing={props.editingDebt}
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
      {props.sellingHolding && (
        <InvestmentSaleModal
          holding={props.sellingHolding}
          locale={locale}
          onClose={props.onCloseSale}
          onSubmit={props.onRecordSale}
        />
      )}
    </main>
    </MoneyProvider>
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
  const homeTitle = portfolioName
    ? portfolioName
    : tx(locale, "My finances");
  const titles: Record<MobileTab, string> = {
    home: homeTitle,
    holdings: tx(locale, "Holdings"),
    bank: tx(locale, "Cash"),
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
  costHoldings,
  investmentPerformance,
  locale,
  monthTransactions,
  overview,
  totals,
  onAddCashflow,
  onAddHolding,
  onOpenHoldings,
}: {
  costHoldings: EnrichedHolding[];
  investmentPerformance: InvestmentPerformance;
  locale: Locale;
  monthTransactions: CashflowTransaction[];
  overview: EnrichedHolding[];
  totals: ReturnType<typeof getPortfolioTotals>;
  onAddCashflow: () => void;
  onAddHolding: () => void;
  onOpenHoldings: () => void;
}) {
  const money = useMoney();
  const monthly = getTransactionBuckets(monthTransactions);
  const investmentHoldings = overview.filter((holding) => holding.asset_type !== "cash");
  const topHoldings = [...investmentHoldings]
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 4);
  const allocationSegments = buildAllocationSegments(overview);
  const dayPositive = totals.dayChange >= 0;
  const gainWarning = getDictionary(locale).gainCoverageWarning
    .replace("{known}", String(totals.gainKnownCount))
    .replace("{total}", String(totals.gainInvestmentCount));
  const showGainWarning = totals.gainInvestmentCount > 0 && !totals.gainDataComplete;

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
            {money.fmtUsd(totals.totalValue)}
          </p>
          <InvestmentCost holdings={costHoldings} locale={locale} />
          <div className="mt-3.5 flex items-center gap-2">
            <span
              className={clsx(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                dayPositive ? "bg-mint/10 text-mint" : "bg-rose/10 text-rose",
              )}
            >
              {dayPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {money.fmtUsd(totals.dayChange)} · {formatPercent(totals.dayChangePercent)}
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
              {investmentHoldings.length} {tx(locale, "assets")}
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
          icon={totals.hasGainData && totals.totalGain < 0 ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
          label={tx(locale, "Unrealized P/L")}
          tone={totals.hasGainData ? (totals.totalGain >= 0 ? "positive" : "negative") : undefined}
          value={totals.hasGainData ? money.fmtUsd(totals.totalGain) : "N/A"}
          warning={showGainWarning ? gainWarning : undefined}
        />
        <MobileMetric
          icon={<ReceiptText size={15} />}
          label={tx(locale, "Monthly spending")}
          tone="negative"
          value={formatCurrencyBuckets(money, monthly.expense)}
        />
      </div>

      <InvestmentPerformancePanel compact locale={locale} performance={investmentPerformance} />

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

      <MobileAllocationCard holdings={overview} locale={locale} />
    </div>
  );
}

function MobileAllocationCard({ holdings, locale }: { holdings: EnrichedHolding[]; locale: Locale }) {
  const sorted = [...holdings].sort((a, b) => b.allocationPercent - a.allocationPercent);
  const donutData = sorted.slice(0, 5).map((holding, index) => ({
    color: chartPalette[index % chartPalette.length],
    name: holding.symbol.replace(/\..*$/, ""),
    value: Math.max(0, holding.allocationPercent),
  }));
  const donutRest = sorted.slice(5).reduce((sum, item) => sum + item.allocationPercent, 0);
  if (donutRest > 0.5) {
    donutData.push({ color: "#8d99ab", name: tx(locale, "Others"), value: donutRest });
  }
  if (donutData.length === 0) return null;
  return (
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
              label={renderMobileDonutPercentLabel}
              labelLine={false}
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
  );
}

function renderMobileDonutPercentLabel({ cx, cy, midAngle, middleRadius, percent }: PieLabelRenderProps) {
  const share = (percent ?? 0) * 100;
  if (share < 5) return null;

  const angle = -(Number(midAngle) * Math.PI) / 180;
  const radius = Number(middleRadius);
  const x = Number(cx) + radius * Math.cos(angle);
  const y = Number(cy) + radius * Math.sin(angle);

  return (
    <text
      dominantBaseline="central"
      fill="#fff"
      fontSize={10}
      fontWeight={700}
      paintOrder="stroke"
      pointerEvents="none"
      stroke="rgba(0, 0, 0, 0.65)"
      strokeWidth={3}
      textAnchor="middle"
      x={x}
      y={y}
    >
      {share < 10 ? share.toFixed(1) : share.toFixed(0)}%
    </text>
  );
}

function MobileHoldings({
  cashOnly = false,
  demo,
  holdings,
  investmentTransactions,
  locale,
  onAdd,
  onDelete,
  onEdit,
  onSell,
}: {
  cashOnly?: boolean;
  demo: boolean;
  holdings: EnrichedHolding[];
  investmentTransactions?: InvestmentTransaction[];
  locale: Locale;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onEdit: (holding: Holding) => void;
  onSell?: (holding: EnrichedHolding) => void;
}) {
  const money = useMoney();
  const t = getDictionary(locale);
  const [sort, setSort] = useState<"price" | "day" | "return">("price");
  const [view, setView] = useState<"bubbles" | "list">(() => {
    if (typeof window === "undefined" || cashOnly) return "list";
    return window.localStorage.getItem("holdingsView") === "list" ? "list" : "bubbles";
  });
  const [selectedBubble, setSelectedBubble] = useState<EnrichedHolding | null>(null);
  const [bubbleFilter, setBubbleFilter] = useState<AssetType | "all">("all");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const showBubbles = !cashOnly && view === "bubbles";

  function selectView(next: "bubbles" | "list") {
    tapLight();
    setView(next);
    window.localStorage.setItem("holdingsView", next);
  }
  const totalValue = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const sorters: Record<typeof sort, (a: EnrichedHolding, b: EnrichedHolding) => number> = {
    price: (a, b) => (b.quote?.priceUsd ?? -1) - (a.quote?.priceUsd ?? -1),
    day: (a, b) => b.dayChangeUsd - a.dayChangeUsd,
    return: (a, b) => Number(b.gainKnown) - Number(a.gainKnown) || b.gainPercent - a.gainPercent,
  };
  const groupDefinitions: Array<{ label: string; type: AssetType }> = cashOnly
    ? [{ label: tx(locale, "Cash"), type: "cash" }]
    : [
      { label: t.stock, type: "stock" },
      { label: tx(locale, "US stocks"), type: "us_stock" },
      { label: tx(locale, "Taiwan stocks"), type: "tw_stock" },
      { label: tx(locale, "Crypto"), type: "crypto" },
    ];
  const groups = groupDefinitions
    .map((group) => ({
      ...group,
      items: holdings.filter((holding) => holding.asset_type === group.type).sort(sorters[sort]),
      tone: assetTypeTone(group.type),
    }))
    .filter((group) => group.items.length > 0);
  const sortOptions = [
    { id: "price", label: t.currentPrice },
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
        {cashOnly ? tx(locale, "Add cash account") : tx(locale, "Add holding")}
      </button>

      {!cashOnly && (
        <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-[var(--surface-muted)] p-1">
          {([
            { id: "bubbles", label: tx(locale, "Bubbles") },
            { id: "list", label: tx(locale, "List") },
          ] as const).map((mode) => (
            <button
              aria-pressed={view === mode.id}
              className={clsx(
                "focus-ring min-h-9 rounded-full px-1.5 text-[11px] font-semibold transition",
                view === mode.id ? "bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm" : "text-titanium",
              )}
              key={mode.id}
              onClick={() => selectView(mode.id)}
              type="button"
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      {showBubbles && (
        <section className="rounded-[24px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap gap-1.5">
            {([{ label: tx(locale, "All"), type: "all" as const }, ...groupDefinitions]).map((chip) => (
              <button
                aria-pressed={bubbleFilter === chip.type}
                className={clsx(
                  "focus-ring min-h-9 rounded-full border px-3 text-[11px] font-semibold transition",
                  bubbleFilter === chip.type
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-line bg-[var(--surface-muted)] text-titanium",
                )}
                key={chip.type}
                onClick={() => {
                  tapLight();
                  setBubbleFilter(chip.type);
                }}
                type="button"
              >
                {chip.label}
              </button>
            ))}
          </div>
          <HoldingBubbles
            holdings={holdings.filter(
              (holding) =>
                groupDefinitions.some((group) => group.type === holding.asset_type) &&
                (bubbleFilter === "all" || holding.asset_type === bubbleFilter),
            )}
            locale={locale}
            onSelect={(holding) => {
              tapLight();
              setSelectedBubble(holding);
            }}
          />
          <p className="mt-3 text-center text-[10px] leading-4 text-titanium">
            {tx(locale, "Bubble size shows weight, color shows today's move. Tap a bubble for details.")}
          </p>
        </section>
      )}

      {!showBubbles && (<>
      {!cashOnly && <div className="grid grid-cols-3 gap-1 rounded-full border border-line bg-[var(--surface-muted)] p-1">
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
      </div>}

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
                {money.fmtUsd(subtotal)} · {totalValue ? ((subtotal / totalValue) * 100).toFixed(1) : "0.0"}%
              </span>
            </div>
            <div className="space-y-3">
              {group.items.map((holding) => {
                const dayPercent = holding.quote?.dayChangePercent;
                const editable = !demo && !holding.id.startsWith("overview:");
                return (
                  <article
                    className="relative rounded-[22px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]"
                    key={holding.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <AssetMark assetType={holding.asset_type} name={holding.name} symbol={holding.symbol} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{holding.symbol}</p>
                          <p className="mt-0.5 truncate text-xs text-titanium">{holding.name}</p>
                        </div>
                      </div>
                      {editable && (
                        <div className="relative shrink-0">
                          <button
                            aria-expanded={menuFor === holding.id}
                            aria-label={`${tx(locale, "More options")} ${cashOnly ? holding.name : holding.symbol}`}
                            className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-line bg-[var(--surface-muted)] text-titanium shadow-sm transition hover:text-ink"
                            onClick={(event) => {
                              event.stopPropagation();
                              tapLight();
                              setMenuFor((current) => current === holding.id ? null : holding.id);
                            }}
                            type="button"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {menuFor === holding.id && (
                            <>
                              <div aria-hidden="true" className="fixed inset-0 z-40" onClick={(event) => { event.stopPropagation(); setMenuFor(null); }} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-2xl border border-line bg-panel shadow-xl">
                                {holding.source_kind !== "wallet" && onSell && !cashOnly && (
                                  <button
                                    className="focus-ring flex min-h-11 w-full items-center gap-2 px-4 text-sm font-semibold text-rose transition hover:bg-rose/10"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setMenuFor(null);
                                      onSell(holding);
                                    }}
                                    type="button"
                                  >
                                    <TrendingDown size={14} />
                                    {getRecordSaleLabel(locale)}
                                  </button>
                                )}
                                <button
                                  className={clsx("focus-ring flex min-h-11 w-full items-center gap-2 px-4 text-sm font-semibold text-ink transition hover:bg-white/10", holding.source_kind !== "wallet" && onSell && !cashOnly && "border-t border-line")}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setMenuFor(null);
                                    onEdit(holding);
                                  }}
                                  type="button"
                                >
                                  <Pencil size={14} />
                                  {tx(locale, "Edit")}
                                </button>
                                {holding.source_kind !== "wallet" && (
                                  <button
                                    className="focus-ring flex min-h-11 w-full items-center gap-2 border-t border-line px-4 text-sm font-semibold text-rose transition hover:bg-rose/10"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setMenuFor(null);
                                      onDelete(holding.id);
                                    }}
                                    type="button"
                                  >
                                    <Trash2 size={14} />
                                    {tx(locale, "Delete")}
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        {!cashOnly && <p className="text-[10px] text-titanium">{t.currentPrice}</p>}
                        <p className="mt-0.5 truncate text-lg font-semibold tracking-[-0.02em] text-ink">
                          {cashOnly ? money.fmtAmountFull(holding.quantity, holding.cost_currency) : formatCurrentPrice(holding.quote, money) ?? t.priceUnavailable}
                        </p>
                      </div>
                      {!cashOnly && (
                        <div className="shrink-0 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <p className={clsx("text-xs font-semibold", !holding.gainKnown ? "text-titanium" : holding.gainUsd >= 0 ? "text-mint" : "text-rose")}>
                              {!holding.gainKnown ? "N/A" : formatPercent(holding.gainPercent)}
                            </p>
                            {holding.gainEstimated && (
                              <GainCoverageWarning compact label={t.gainEstimateWarning} text={t.gainEstimateWarning} />
                            )}
                          </div>
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
                      )}
                    </div>
                    {cashOnly ? (
                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface-muted)] p-3 text-xs">
                        <AssetFact label={t.currency} value={holding.cost_currency} />
                        <AssetFact label={t.convertedAmount} value={money.fmtUsd(holding.valueUsd)} />
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--surface-muted)] p-3 text-xs">
                        <AssetFact label={tx(locale, "Quantity")} value={formatQuantity(holding.quantity)} />
                        <AssetFact label={tx(locale, "Avg. cost")} value={holding.cost_known === false ? "N/A" : money.fmtAmount(holding.average_cost, holding.cost_currency)} />
                        <AssetFact
                          label={!holding.gainKnown ? t.gainLoss : holding.gainUsd > 0 ? t.profitAmount : holding.gainUsd < 0 ? t.lossAmount : t.gainLoss}
                          tone={!holding.gainKnown || holding.gainUsd === 0 ? undefined : holding.gainUsd > 0 ? "positive" : "negative"}
                          value={formatMobileGain(holding, money)}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      </>)}

      {!cashOnly && investmentTransactions && (
        <InvestmentHistoryPanel compact locale={locale} transactions={investmentTransactions} />
      )}

      {selectedBubble && (() => {
        const holding = selectedBubble;
        const dayPercent = holding.asset_type === "cash" ? undefined : holding.quote?.dayChangePercent;
        return (
          <MobileSheet onClose={() => setSelectedBubble(null)} title={holding.symbol}>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <AssetMark assetType={holding.asset_type} name={holding.name} symbol={holding.symbol} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{holding.symbol}</p>
                    <p className="mt-0.5 truncate text-xs text-titanium">{holding.name}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-titanium">{t.currentPrice}</p>
                  <p className="font-semibold text-ink">{formatCurrentPrice(holding.quote, money) ?? t.priceUnavailable}</p>
                  <div className="mt-0.5 flex items-center justify-end gap-0.5">
                    <p className={clsx("text-xs", !holding.gainKnown ? "text-titanium" : holding.gainUsd >= 0 ? "text-mint" : "text-rose")}>
                      {!holding.gainKnown ? "N/A" : formatPercent(holding.gainPercent)}
                    </p>
                    {holding.gainEstimated && (
                      <GainCoverageWarning compact label={t.gainEstimateWarning} text={t.gainEstimateWarning} />
                    )}
                  </div>
                  {typeof dayPercent === "number" && (
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
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--surface-muted)] p-3 text-xs">
                <AssetFact label={tx(locale, "Quantity")} value={formatQuantity(holding.quantity)} />
                <AssetFact label={tx(locale, "Avg. cost")} value={holding.cost_known === false ? "N/A" : money.fmtAmount(holding.average_cost, holding.cost_currency)} />
                <AssetFact
                  label={!holding.gainKnown ? t.gainLoss : holding.gainUsd > 0 ? t.profitAmount : holding.gainUsd < 0 ? t.lossAmount : t.gainLoss}
                  tone={!holding.gainKnown || holding.gainUsd === 0 ? undefined : holding.gainUsd > 0 ? "positive" : "negative"}
                  value={formatMobileGain(holding, money)}
                />
              </div>
              {!demo && !holding.id.startsWith("overview:") && (
                <div className={clsx("grid gap-2", holding.source_kind !== "wallet" && onSell ? "grid-cols-3" : "grid-cols-2")}>
                  {holding.source_kind !== "wallet" && onSell && (
                    <button
                      className="focus-ring flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-rose/30 bg-rose/10 text-sm font-semibold text-rose transition hover:bg-rose/20"
                      onClick={() => {
                        setSelectedBubble(null);
                        onSell(holding);
                      }}
                      type="button"
                    >
                      <TrendingDown size={14} />
                      {getRecordSaleLabel(locale)}
                    </button>
                  )}
                  <button
                    className="focus-ring flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-[var(--surface-muted)] text-sm font-semibold text-ink transition hover:bg-white/10"
                    onClick={() => {
                      setSelectedBubble(null);
                      onEdit(holding);
                    }}
                    type="button"
                  >
                    <Pencil size={14} />
                    {tx(locale, "Edit")}
                  </button>
                  {holding.source_kind !== "wallet" && (
                    <button
                      className="focus-ring flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-rose/30 bg-rose/10 text-sm font-semibold text-rose transition hover:bg-rose/20"
                      onClick={() => {
                        setSelectedBubble(null);
                        onDelete(holding.id);
                      }}
                      type="button"
                    >
                      <Trash2 size={14} />
                      {tx(locale, "Delete holding")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </MobileSheet>
        );
      })()}
    </div>
  );
}

function MobileCashflow({
  assetValue,
  cashValue,
  debts,
  demo,
  locale,
  recurringExpenses,
  transactions,
  onAdd,
  onAddDebt,
  onAddRecurring,
  onDeleteDebt,
  onDeleteRecurring,
  onEditDebt,
  onEditRecurring,
}: {
  assetValue: number;
  cashValue: number;
  debts: Debt[];
  demo: boolean;
  locale: Locale;
  recurringExpenses: RecurringExpense[];
  transactions: CashflowTransaction[];
  onAdd: (type: CashflowType, date?: string) => void;
  onAddDebt: () => void;
  onAddRecurring: () => void;
  onDeleteDebt: (id: string) => void;
  onDeleteRecurring: (id: string) => void;
  onEditDebt: (debt: Debt) => void;
  onEditRecurring: (expense: RecurringExpense) => void;
}) {
  const money = useMoney();
  const zh = locale === "zh";
  const [section, setSection] = useState<"transactions" | "recurring" | "debts" | "flow">("transactions");
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
    { id: "flow", label: financialCopy(locale).tab },
    { id: "transactions", label: tx(locale, "Cashflow") },
    { id: "recurring", label: tx(locale, "Recurring") },
    { id: "debts", label: tx(locale, "Debts") },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MobileMetric icon={<TrendingUp size={18} />} label={tx(locale, "Monthly income")} tone="positive" value={formatCurrencyBuckets(money, buckets.income)} />
        <MobileMetric
          icon={<TrendingDown size={18} />}
          label={tx(locale, "Monthly expenses")}
          tone="negative"
          value={formatCurrencyBuckets(money, buckets.expense)}
          onClick={() => setExpenseHistoryOpen(true)}
        />
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-full border border-line bg-[var(--surface-muted)] p-1">
        {sections.map((item) => (
          <button
            aria-pressed={section === item.id}
            className={clsx(
              "focus-ring min-h-11 rounded-full px-1.5 text-[11px] font-semibold leading-4 transition",
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

      {section === "flow" && <CashflowFlow transactions={transactions} debts={debts} assetValue={assetValue} cashValue={cashValue} locale={locale} />}
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
                  <p className="shrink-0 font-semibold text-ink">{money.fmtAmountFull(expense.amount, expense.currency)}</p>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-[var(--surface-muted)] px-3 py-2.5 text-xs">
                  <span className={expense.is_active ? "text-mint" : "text-titanium"}>
                    {expense.is_active ? (tx(locale, "Active")) : (tx(locale, "Inactive"))}
                  </span>
                  <span className="text-titanium">{tx(locale, "Next")} {formatDate(expense.next_due_date, locale)}</span>
                </div>
                {!demo && (
                  <div className="mt-3 flex justify-end">
                    <div className="inline-flex overflow-hidden rounded-full border border-line bg-[var(--surface-muted)] shadow-sm">
                      <button
                        aria-label={`${tx(locale, "Edit")} ${expense.name}`}
                        className="focus-ring grid h-9 w-10 place-items-center text-titanium transition hover:bg-white/10 hover:text-ink"
                        onClick={() => onEditRecurring(expense)}
                        title={tx(locale, "Edit")}
                        type="button"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        aria-label={`${tx(locale, "Delete")} ${expense.name}`}
                        className="focus-ring grid h-9 w-10 place-items-center border-l border-line text-rose transition hover:bg-rose/10"
                        onClick={() => onDeleteRecurring(expense.id)}
                        title={tx(locale, "Delete")}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
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
                    <p className="font-semibold text-ink">{money.fmtAmountFull(debt.remaining_principal, debt.currency)}</p>
                    <p className="mt-1 text-xs text-titanium">{debt.interest_rate.toFixed(2)}% APR</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface-muted)] p-3 text-xs">
                  <AssetFact label={tx(locale, "Minimum")} value={money.fmtAmountFull(debt.minimum_payment, debt.currency)} />
                  <AssetFact label={tx(locale, "Next payment")} value={formatDate(debt.next_payment_date, locale)} />
                </div>
                {!demo && (
                  <div className="mt-3 flex justify-end">
                    <div className="inline-flex overflow-hidden rounded-full border border-line bg-[var(--surface-muted)] shadow-sm">
                      <button
                        aria-label={`${tx(locale, "Edit")} ${debt.name}`}
                        className="focus-ring grid h-9 w-10 place-items-center text-titanium transition hover:bg-white/10 hover:text-ink"
                        onClick={() => onEditDebt(debt)}
                        title={tx(locale, "Edit")}
                        type="button"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        aria-label={`${tx(locale, "Delete")} ${debt.name}`}
                        className="focus-ring grid h-9 w-10 place-items-center border-l border-line text-rose transition hover:bg-rose/10"
                        onClick={() => onDeleteDebt(debt.id)}
                        title={tx(locale, "Delete")}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
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
              <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-rose">{formatCurrencyBuckets(money, buckets.expense)}</p>
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
                  <p className="shrink-0 text-sm font-semibold text-rose">-{money.fmtAmountFull(transaction.amount, transaction.currency)}</p>
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
  const money = useMoney();
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
          const dueLabel = dueEntries.length ? formatDueLabel(dueEntries, money) : null;
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
                <p className="shrink-0 text-xs font-bold text-[var(--accent)]">{money.fmtAmount(expense.amount, expense.currency)}</p>
              </div>
            ))}
            {selectedSchedules.debts.map((debt) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-[var(--surface-muted)] p-3" key={`debt-${debt.id}`}>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">{debt.name}</p>
                  <p className="mt-0.5 text-[10px] text-titanium">{tx(locale, "Loan or debt payment")}</p>
                </div>
                <p className="shrink-0 text-xs font-bold text-ink">{money.fmtAmount(debt.minimum_payment, debt.currency)}</p>
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
                  {transaction.transaction_type === "income" ? "+" : "-"}{money.fmtAmountFull(transaction.amount, transaction.currency)}
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
  debts,
  holdings,
  locale,
  recurringExpenses,
  totals,
  transactions,
  fx,
}: {
  debts: Debt[];
  holdings: EnrichedHolding[];
  locale: Locale;
  recurringExpenses: RecurringExpense[];
  totals: ReturnType<typeof getPortfolioTotals>;
  transactions: CashflowTransaction[];
  fx: CurrencyFxInput;
}) {
  const money = useMoney();
  const activeRecurring = recurringExpenses.filter((expense) => expense.is_active);
  const annualRecurringUsd = activeRecurring.reduce(
    (sum, expense) =>
      sum +
      currencyAmountToUsd(
        expense.frequency === "monthly" ? expense.amount * 12 : expense.amount,
        expense.currency,
        fx,
      ),
    0,
  );
  const performanceHoldings = holdings.filter(
    (item) => item.asset_type !== "cash" && item.gainConfirmed,
  );
  const best = [...performanceHoldings].sort((a, b) => b.gainPercent - a.gainPercent)[0];
  const worst = [...performanceHoldings].sort((a, b) => a.gainPercent - b.gainPercent)[0];

  const debtPrincipalUsd = debts
    .filter((debt) => debt.is_active)
    .reduce((sum, debt) => sum + currencyAmountToUsd(debt.remaining_principal, debt.currency, fx), 0);
  const netWorthUsd = totals.totalValue - debtPrincipalUsd;

  const expenseDonut = buildExpenseCategoryDonut(transactions, fx, locale);
  const expenseTotal = expenseDonut.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="space-y-4">
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
            {money.fmtUsd(netWorthUsd)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
              <p className="text-[10px] font-medium text-titanium">{tx(locale, "Total assets")}</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">{money.fmtUsd(totals.totalValue)}</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
              <p className="text-[10px] font-medium text-titanium">{tx(locale, "Total debt")}</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">{debtPrincipalUsd > 0 ? `-${money.fmtUsd(debtPrincipalUsd)}` : money.fmtUsd(0)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[26px] border border-line bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
        <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-[var(--accent)] opacity-[0.12] blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-titanium">{tx(locale, "Total return")}</p>
        <div className="mt-2 flex items-center gap-2">
          <p className={clsx("text-[2.25rem] font-semibold leading-none tracking-[-0.045em]", !totals.hasGainData ? "text-ink" : totals.totalReturn >= 0 ? "text-mint" : "text-rose")}>
            {totals.hasGainData ? formatPercent(totals.totalReturn) : "N/A"}
          </p>
          {totals.gainInvestmentCount > 0 && !totals.gainDataComplete && (
            <GainCoverageWarning
              label={getDictionary(locale).gainCoverageWarning.replace("{known}", String(totals.gainKnownCount)).replace("{total}", String(totals.gainInvestmentCount))}
              text={getDictionary(locale).gainCoverageWarning.replace("{known}", String(totals.gainKnownCount)).replace("{total}", String(totals.gainInvestmentCount))}
            />
          )}
        </div>
        <p className="mt-2.5 text-xs text-titanium">
          {tx(locale, "Includes assets with known cost basis only.")}
        </p>
      </section>

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
              <p className="text-lg font-semibold tracking-[-0.03em] text-ink">{money.fmtUsd(expenseTotal)}</p>
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
                  <span className="text-xs tabular-nums text-titanium">{money.fmtUsd(entry.value)}</span>
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
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-ink">{money.fmtUsd(annualRecurringUsd)}</p>
          <p className="mt-1 text-xs text-titanium">
            {tx(locale, "≈ {amount} per month · {count} items", {
              amount: money.fmtUsd(annualRecurringUsd / 12),
              count: activeRecurring.length,
            })}
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

function buildExpenseCategoryDonut(transactions: CashflowTransaction[], fx: CurrencyFxInput, locale: Locale) {
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
      const amount = currencyAmountToUsd(transaction.amount, transaction.currency, fx);
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
  biometricAvailable,
  biometricLock,
  demo,
  displayCurrency,
  locale,
  nativePlatform,
  paymentReminders,
  portfolioName,
  userEmail,
  onBiometricLockChange,
  onDisplayCurrencyChange,
  onEditName,
  onLocaleChange,
  onOpenBank,
  onPaymentRemindersChange,
  onDeleteAccount,
  onSignOut,
}: {
  biometricAvailable: boolean;
  biometricLock: boolean;
  demo: boolean;
  displayCurrency: Currency;
  locale: Locale;
  nativePlatform: boolean;
  paymentReminders: boolean;
  portfolioName: string;
  userEmail: string;
  onBiometricLockChange: (next: boolean) => void;
  onDisplayCurrencyChange: (currency: Currency) => void;
  onEditName: () => void;
  onLocaleChange: (locale: Locale) => void;
  onOpenBank: () => void;
  onPaymentRemindersChange: (next: boolean) => void;
  onDeleteAccount: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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
            {portfolioName || tx(locale, "Not set")}
            <Pencil className="text-titanium" size={12} />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-titanium">{tx(locale, "Currency")}</span>
          <select
            className="input-control focus-ring min-h-10 rounded-full px-3 text-sm font-semibold text-ink"
            value={displayCurrency}
            onChange={(event) => onDisplayCurrencyChange(event.target.value as Currency)}
          >
            {supportedCurrencies.map((item) => (
              <option key={item} value={item}>{item}（{currencySymbols[item]}）</option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-titanium">{tx(locale, "Bank")}</span>
          <button className="focus-ring flex min-h-10 items-center gap-2 rounded-full border border-line bg-[var(--surface-muted)] px-3 text-sm font-semibold text-ink" onClick={onOpenBank} type="button">
            <CircleDollarSign size={16} className="text-[var(--accent)]" />
            {tx(locale, "Cash")}
            <ChevronRight size={14} className="text-titanium" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-titanium">{tx(locale, "Theme")}</span>
          <ThemeToggle compact locale={locale} />
        </div>
        {biometricAvailable && (
          <label className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="text-sm text-titanium">{tx(locale, "Face ID / Touch ID unlock")}</span>
            <input
              checked={biometricLock}
              className="h-5 w-5 shrink-0"
              onChange={(event) => onBiometricLockChange(event.target.checked)}
              type="checkbox"
            />
          </label>
        )}
        {nativePlatform && (
          <label className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="text-sm text-titanium">{tx(locale, "Payment reminders")}</span>
            <input
              checked={paymentReminders}
              className="h-5 w-5 shrink-0"
              onChange={(event) => onPaymentRemindersChange(event.target.checked)}
              type="checkbox"
            />
          </label>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-titanium">{tx(locale, "Language")}</span>
          <select
            aria-label={tx(locale, "Language")}
            className="input-control focus-ring min-h-10 w-[min(11rem,58vw)] rounded-full px-3 text-sm font-semibold text-ink"
            value={locale}
            onChange={(event) => onLocaleChange(event.target.value as Locale)}
          >
            {localeOrder.map((item) => (
              <option key={item} value={item}>{localeNames[item]}</option>
            ))}
          </select>
        </div>
      </section>
      <section className="rounded-[24px] border border-line bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
        <p className="text-xs text-titanium">{demo ? "Demo mode" : tx(locale, "Signed in")}</p>
        <p className="mt-1 truncate text-sm font-medium text-ink">{demo ? (tx(locale, "Read-only sample data")) : userEmail}</p>
        {!demo && (
          <>
            <button className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-rose/20 bg-rose/10 text-sm font-semibold text-rose" onClick={onSignOut} type="button">
              <LogOut size={17} />
              {tx(locale, "Sign out")}
            </button>
            {deleteArmed && (
              <p className="mt-4 rounded-2xl border border-rose/20 bg-rose/10 p-3 text-xs leading-5 text-rose">
                {tx(locale, "This permanently deletes your account and all associated data. This cannot be undone.")}
              </p>
            )}
            {deleteError && <p className="mt-3 text-xs text-rose" role="alert">{deleteError}</p>}
            <button
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-rose/25 bg-transparent text-sm font-semibold text-rose disabled:opacity-50"
              disabled={deleting}
              onClick={async () => {
                if (!deleteArmed) {
                  setDeleteArmed(true);
                  return;
                }
                setDeleting(true);
                setDeleteError("");
                try {
                  await onDeleteAccount();
                } catch (error) {
                  setDeleteError(error instanceof Error ? error.message : tx(locale, "Could not delete this account."));
                  setDeleting(false);
                }
              }}
              type="button"
            >
              <Trash2 size={16} />
              {tx(locale, deleting ? "Deleting account..." : deleteArmed ? "Delete account permanently" : "Delete account")}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function MobileHoldingSheet({
  cashOnly = false,
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
  cashOnly?: boolean;
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
    <MobileSheet title={editing ? (cashOnly ? tx(locale, "Edit cash account") : tx(locale, "Edit holding")) : (cashOnly ? tx(locale, "Add cash account") : tx(locale, "Add holding"))} onClose={onClose}>
      {!editing && !cashOnly && (
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
        {!cashOnly && <MobileField label={tx(locale, "Asset type")}>
          <select className="input-control w-full px-3" value={form.asset_type === "crypto" ? "crypto" : "stock"} onChange={(event) => {
            const assetType = event.target.value === "crypto" ? "crypto" : "stock";
            onUpdate("asset_type", assetType);
            onUpdate("symbol", "");
            onUpdate("name", "");
            onUpdate("market_data_id", null);
            onUpdate("market_code", null);
            onUpdate("exchange_code", null);
            onUpdate("quote_currency", assetType === "crypto" ? "USD" : null);
            onUpdate("lot_size", 1);
            onUpdate("break_even_price", "");
            onUpdate("gain_calculation_mode", "estimated");
            onUpdate("average_cost", "");
            onUpdate("cost_currency", "USD");
          }}>
            <option value="stock">{getDictionary(locale).stock}</option>
            <option value="crypto">{tx(locale, "Crypto")}</option>
          </select>
        </MobileField>}
        <div className="space-y-3">
          {form.asset_type !== "cash" && <MobileField label={tx(locale, "Symbol")}>
            {form.asset_type === "crypto" ? (
              <input className="input-control w-full px-3 uppercase" placeholder="BTC" value={form.symbol} onChange={(event) => onUpdate("symbol", event.target.value)} required />
            ) : (
              <StockSymbolSearch
                locale={locale}
                value={form.symbol}
                onChange={(value) => {
                  onUpdate("symbol", value);
                  onUpdate("market_data_id", null);
                  onUpdate("market_code", null);
                  onUpdate("exchange_code", null);
                  onUpdate("quote_currency", null);
                  onUpdate("lot_size", 1);
                }}
                onSelect={(result) => {
                  onUpdate("asset_type", result.assetType);
                  onUpdate("symbol", result.symbol);
                  onUpdate("name", result.description);
                  onUpdate("market_data_id", null);
                  onUpdate("market_code", result.market);
                  onUpdate("exchange_code", result.exchange);
                  onUpdate("quote_currency", result.currency);
                  onUpdate("lot_size", result.lotSize);
                  onUpdate("cost_currency", result.currency);
                }}
              />
            )}
          </MobileField>}
          <MobileField label={tx(locale, "Currency")}>
            <select className="input-control w-full px-3" value={form.cost_currency} onChange={(event) => {
              const currency = event.target.value as Currency;
              onUpdate("cost_currency", currency);
              if (form.asset_type === "cash") {
                onUpdate("average_cost", "1");
                onUpdate("gain_calculation_mode", "average_cost");
                onUpdate("cost_known", true);
              }
            }}>
              {supportedCurrencies.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </MobileField>
        </div>
        {(cashOnly || form.asset_type !== "cash") && <MobileField label={cashOnly ? tx(locale, "Bank name") : tx(locale, "Name")}>
          <input className="input-control w-full px-3" required={cashOnly} value={form.name} onChange={(event) => onUpdate("name", event.target.value)} />
        </MobileField>}
        <div className="grid grid-cols-2 gap-3">
          <MobileField label={form.asset_type === "tw_stock" ? (tx(locale, "Lots")) : form.asset_type === "cash" ? tx(locale, "Cash balance") : (tx(locale, "Quantity"))}>
            <input className="input-control w-full px-3" inputMode="decimal" type="text" value={form.quantity} onChange={(event) => {
              const next = cleanNumber(event.target.value);
              if (next !== null) onUpdate("quantity", next);
            }} />
          </MobileField>
          {form.asset_type !== "cash" && <MobileField label={tx(locale, "Average cost")}>
            <input className="input-control w-full px-3" inputMode="decimal" type="text" value={form.average_cost} onChange={(event) => {
              const next = cleanNumber(event.target.value);
              if (next !== null) onUpdate("average_cost", next);
            }} />
          </MobileField>}
        </div>
        {form.asset_type !== "cash" && (
          <>
            <GainCalculationModeSelector
              compact
              locale={locale}
              value={form.gain_calculation_mode}
              onChange={(nextMode) => {
                onUpdate("gain_calculation_mode", nextMode);
                if (nextMode !== "break_even") onUpdate("break_even_price", "");
              }}
            />
            {form.asset_type === "tw_stock" && (
              <p className="rounded-2xl border border-amber/25 bg-amber/10 px-3.5 py-2.5 text-xs leading-5 text-titanium">
                {getDictionary(locale).twStockBreakEvenSuggestion}
              </p>
            )}
          </>
        )}
        {form.asset_type !== "cash" && form.gain_calculation_mode === "break_even" && (
          <MobileField label={getDictionary(locale).breakEvenPrice}>
            <input
              className="input-control w-full px-3"
              inputMode="decimal"
              type="text"
              value={form.break_even_price}
              onChange={(event) => {
                const next = cleanNumber(event.target.value);
                if (next !== null) onUpdate("break_even_price", next);
              }}
            />
            <span className="mt-1.5 block text-[11px] leading-4 text-titanium">{getDictionary(locale).breakEvenHelp}</span>
          </MobileField>
        )}
        {form.asset_type !== "cash" && <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-[var(--surface-muted)] px-4 text-sm text-ink">
          <input checked={form.cost_known !== false} onChange={(event) => onUpdate("cost_known", event.target.checked)} type="checkbox" />
          {tx(locale, "Cost basis known")}
        </label>}
        {form.asset_type === "cash" && <p className="text-xs leading-5 text-titanium">{tx(locale, "Cash balances use the selected currency and are converted using live FX rates.")}</p>}
        <button className="primary-button min-h-12 w-full rounded-full font-semibold" type="submit">
          {editing ? (tx(locale, "Save changes")) : (cashOnly ? tx(locale, "Add cash account") : tx(locale, "Add holding"))}
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
              {supportedCurrencies.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </MobileField>
        </div>
        <MobileField label={tx(locale, "Category")}>
          <select className="input-control w-full px-3" value={form.category} onChange={(event) => onUpdate("category", event.target.value)}>
            {categories.map((category) => <option key={category.id} value={category.id}>{tx(locale, category.en)}</option>)}
          </select>
        </MobileField>
        {form.transaction_type === "expense" && <>
        <MobileField label={tx(locale, "Description")}>
          <input className="input-control w-full px-3" value={form.description} onChange={(event) => onUpdate("description", event.target.value)} />
        </MobileField>
        </>}
        <MobileField label={tx(locale, "Date")}>
          <input className="input-control w-full px-3" type="date" value={form.transaction_date} onChange={(event) => onUpdate("transaction_date", event.target.value)} />
        </MobileField>
        {form.transaction_type === "expense" && <>
        <MobileField label={tx(locale, "Payment method")}>
          <select className="input-control w-full px-3" value={form.payment_method} onChange={(event) => onUpdate("payment_method", event.target.value)}>
            <option value="">{tx(locale, "Not set")}</option>
            <option value="Credit card">{tx(locale, "Credit card")}</option>
            <option value="Cash">{tx(locale, "Cash")}</option>
            <option value="Transfer">{tx(locale, "Bank transfer")}</option>
          </select>
        </MobileField>
        </>}
        <button className="primary-button min-h-12 w-full rounded-full font-semibold" type="submit">
          {tx(locale, "Save transaction")}
        </button>
      </form>
    </MobileSheet>
  );
}

function MobileRecurringSheet({
  editing,
  form,
  locale,
  onClose,
  onSave,
  onUpdate,
}: {
  editing: boolean;
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
    <MobileSheet title={editing ? tx(locale, "Edit recurring expense") : tx(locale, "Add recurring expense")} onClose={onClose}>
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
              {supportedCurrencies.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
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
  editing,
  form,
  locale,
  onClose,
  onSave,
  onUpdate,
}: {
  editing: boolean;
  form: DebtInput;
  locale: Locale;
  onClose: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof DebtInput>(key: K, value: DebtInput[K]) => void;
}) {
  const debtTypes: DebtType[] = ["mortgage", "car_loan", "student_loan", "credit_card", "personal_loan", "other"];
  return (
    <MobileSheet title={editing ? tx(locale, "Edit loan or debt") : tx(locale, "Add loan or debt")} onClose={onClose}>
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
              {supportedCurrencies.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
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
            {value.trim().slice(0, 12)}
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
    <nav className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[env(safe-area-inset-bottom)] pt-1.5">
      <div className="mx-auto grid max-w-lg grid-cols-5 rounded-[26px] border border-line bg-[color-mix(in_srgb,var(--surface-raised)_94%,transparent)] px-1.5 py-1 shadow-[var(--shadow)] backdrop-blur-2xl">
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
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  tone?: "positive" | "negative";
  value: string;
  warning?: string;
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
        <span className="flex items-center gap-1">
          {warning && <GainCoverageWarning label={warning} text={warning} />}
          {onClick && <ChevronRight className="text-titanium" size={15} />}
        </span>
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
  const money = useMoney();
  const warning = getDictionary(locale).gainEstimateWarning;
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <AssetMark assetType={holding.asset_type} name={holding.name} symbol={holding.symbol} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{holding.symbol}</p>
          <p className="mt-0.5 truncate text-xs text-titanium">{holding.name}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-ink">{money.fmtUsd(holding.valueUsd)}</p>
        <div className="mt-0.5 flex items-center justify-end gap-0.5">
          <p className={clsx("text-xs font-medium", !holding.gainKnown ? "text-titanium" : holding.gainUsd >= 0 ? "text-mint" : "text-rose")}>
            {!holding.gainKnown ? "N/A" : formatPercent(holding.gainPercent)}
          </p>
          {holding.gainEstimated && <GainCoverageWarning compact label={warning} text={warning} />}
        </div>
      </div>
    </div>
  );
}

function AssetMark({ assetType, name, symbol }: { assetType?: AssetType; name?: string; symbol: string }) {
  if (assetType === "cash") {
    return <BankMark fallback={symbol} name={`${name ?? ""} ${symbol}`} />;
  }
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
    case "stock":
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

function formatMobileGain(holding: EnrichedHolding, money: MoneyFmt) {
  if (!holding.gainKnown) return "N/A";

  const formatted = money.fmtUsd(holding.gainUsd);
  return holding.gainUsd > 0 ? `+${formatted}` : formatted;
}

function AssetFact({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "positive" | "negative";
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] text-titanium">{label}</p>
      <p className={clsx(
        "mt-1 truncate font-semibold tabular-nums",
        tone === "positive" ? "text-mint" : tone === "negative" ? "text-rose" : "text-ink",
      )}>
        {value}
      </p>
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
    income: emptyCurrencyBuckets(),
    expense: emptyCurrencyBuckets(),
  };
  transactions.forEach((transaction) => {
    result[transaction.transaction_type][transaction.currency] += transaction.amount;
  });
  return result;
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

function formatDueLabel(entries: Array<{ amount: number; currency: Currency }>, money: MoneyFmt) {
  const totalUsd = entries.reduce(
    (sum, entry) => sum + currencyAmountToUsd(entry.amount, entry.currency, money.fx),
    0,
  );
  return formatCompactAmount(usdToCurrency(totalUsd, money.displayCurrency, money.fx), money.displayCurrency);
}

function formatCompactAmount(value: number, currency: Currency) {
  const symbol = currencySymbols[currency];
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
