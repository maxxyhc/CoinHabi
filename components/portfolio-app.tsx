"use client";

import { queueFlowActivity } from "@/lib/flow-activity";
import { CashflowFlow } from "@/components/cashflow-flow";
import { InvestmentCost } from "@/components/investment-cost";
import { financialCopy } from "@/components/financial-summary-copy";
import { FxStatus, fxCopy } from "@/components/fx-status";
import { FX_CACHE_KEY, parseFxCache } from "@/lib/market/fx";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Ellipsis,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  LineChart as LineChartIcon,
  Globe2,
  Languages,
  LayoutDashboard,
  Landmark,
  ListChecks,
  LogOut,
  Maximize2,
  Music,
  Pencil,
  PieChart as PieIcon,
  Plus,
  Play,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Utensils,
  WalletCards,
  BriefcaseBusiness,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { TradingViewWidget, toTradingViewSymbol } from "@/components/tradingview-widget";
import { WalletTracker } from "@/components/wallet-tracker";
import { HoldingsImport } from "@/components/holdings-import";
import { ThemeToggle } from "@/components/theme-toggle";
import { StockSymbolSearch } from "@/components/stock-symbol-search";
import { MobilePortfolioApp } from "@/components/mobile-portfolio-app";
import { BankMark } from "@/components/bank-mark";
import { HoldingBubbles } from "@/components/holding-bubbles";
import { GainCoverageWarning } from "@/components/gain-coverage-warning";
import { GainCalculationModeSelector } from "@/components/gain-calculation-mode-selector";
import { BacktestCard } from "@/components/backtest-card";
import { HoldingsNews } from "@/components/holdings-news";
import { InfoTip } from "@/components/info-tip";
import {
  InvestmentHistoryPanel,
  InvestmentPerformancePanel,
  InvestmentSaleModal,
  getQuantityDecreaseHelp,
  getRecordSaleLabel,
} from "@/components/investment-ledger";
import { MoneyProvider, useMoney } from "@/components/money-context";
import { createMoney, formatCurrencyBuckets, formatCurrentPrice, type MoneyFmt } from "@/lib/money";
import { createDemoData } from "@/lib/demo-data";
import { BiometricLock } from "@/components/biometric-lock";
import { authenticate, isBiometricAvailable, isNativePlatform } from "@/lib/biometric";
import { hapticSuccess, tapMedium } from "@/lib/haptics";
import { requestNotificationPermission, syncReminders } from "@/lib/notifications";
import {
  aggregateHoldingsForOverview,
  buildFinancialHealthNotes,
  currencyAmountToUsd,
  currencyBucketTotal,
  currencyBucketsToUsd,
  currencySymbols,
  emptyCurrencyBuckets,
  enrichHoldings,
  formatHealthRatio,
  formatPercent,
  getMonthlyCashflowOverview,
  getInvestmentPerformance,
  getPortfolioTotals,
  groupBy,
  isSameMonth,
  parseDateOnly,
  resolveAssetType,
  resolveGainCalculationMode,
  type CurrencyBuckets,
  type CurrencyFxInput,
  type MonthlyCashflowOverview,
} from "@/lib/calculations";
import { AppLoader } from "@/components/app-loader";
import { getDictionary, isLocale, localeNames, localeOrder, tx } from "@/lib/i18n";
import { supportedCurrencies, totalBudgetCategory } from "@/lib/types";
import type { AssetType, CashflowTransaction, CashflowTransactionInput, CashflowType, CryptoSearchResult, Currency, Debt, DebtInput, DebtType, EnrichedHolding, Holding, HoldingInput, InvestmentSaleInput, InvestmentTransaction, Locale, MarketResponse, MonthlyBudget, MonthlyBudgetInput, RecurringExpense, RecurringExpenseInput } from "@/lib/types";

type Tab = "dashboard" | "holdings" | "quantities" | "bank" | "cashflow" | "financialHealth" | "charts" | "analysis" | "settings";


const emptyForm: HoldingInput = {
  asset_type: "stock",
  symbol: "",
  name: "",
  quantity: "0",
  average_cost: "",
  break_even_price: "",
  gain_calculation_mode: "estimated",
  cost_currency: "USD",
  market_data_id: null,
  market_code: null,
  exchange_code: null,
  quote_currency: "USD",
  lot_size: 1,
  cost_known: true,
};

function createCashForm(currency: Currency): HoldingInput {
  return {
    ...emptyForm,
    asset_type: "cash",
    average_cost: "1",
    gain_calculation_mode: "average_cost",
    cost_currency: currency,
    symbol: "",
    cost_known: true,
  };
}

const emptyCashflowForm: CashflowTransactionInput = {
  transaction_type: "expense",
  amount: "0",
  currency: "USD",
  category: "food",
  description: "",
  transaction_date: new Date().toISOString().slice(0, 10),
  payment_method: "",
  notes: "",
};

const emptyRecurringForm: RecurringExpenseInput = {
  name: "",
  amount: "0",
  currency: "USD",
  category: "subscription",
  frequency: "monthly",
  next_due_date: new Date().toISOString().slice(0, 10),
  payment_method: "",
  is_active: true,
  is_subscription: true,
  usage_status: "active",
  reminder_days: "3",
  notes: "",
};

const emptyDebtForm: DebtInput = {
  name: "",
  debt_type: "credit_card",
  original_principal: "0",
  remaining_principal: "0",
  currency: "USD",
  interest_rate: "0",
  minimum_payment: "0",
  next_payment_date: new Date().toISOString().slice(0, 10),
  lender: "",
  is_active: true,
  notes: "",
};

const emptyBudgetForm: MonthlyBudgetInput = {
  month: new Date().toISOString().slice(0, 7),
  category: "total",
  amount: "0",
  currency: "USD",
  notes: "",
};


const cashflowCategories: Record<CashflowType, Array<{ id: string; en: string; zh: string }>> = {
  income: [
    { id: "salary", en: "Salary", zh: "薪資" },
    { id: "bonus", en: "Bonus", zh: "獎金" },
    { id: "side_income", en: "Side income", zh: "副業收入" },
    { id: "investment_income", en: "Investment income", zh: "投資收入" },
    { id: "other_income", en: "Other income", zh: "其他收入" },
  ],
  expense: [
    { id: "food", en: "Food", zh: "餐飲" },
    { id: "transport", en: "Transport", zh: "交通" },
    { id: "housing", en: "Housing", zh: "居住" },
    { id: "shopping", en: "Shopping", zh: "購物" },
    { id: "entertainment", en: "Entertainment", zh: "娛樂" },
    { id: "health", en: "Health", zh: "醫療健康" },
    { id: "education", en: "Education", zh: "教育" },
    { id: "investment", en: "Investment", zh: "投資投入" },
    { id: "other_expense", en: "Other expense", zh: "其他支出" },
  ],
};

const cashflowCategoryIcons = {
  bonus: Gift,
  education: GraduationCap,
  entertainment: Gamepad2,
  food: Utensils,
  health: HeartPulse,
  housing: House,
  investment: TrendingUp,
  investment_income: TrendingUp,
  other_expense: Ellipsis,
  other_income: Ellipsis,
  salary: BriefcaseBusiness,
  shopping: ShoppingBag,
  side_income: HandCoins,
  transport: Car,
};

const paymentMethods = [
  { en: "Credit card", value: "Credit card", zh: "信用卡" },
  { en: "Cash", value: "Cash", zh: "現金" },
  { en: "Bank transfer", value: "Transfer", zh: "轉帳" },
] as const;

const recurringCategories = [
  { id: "subscription", en: "Subscription", zh: "訂閱" },
  { id: "rent", en: "Rent", zh: "房租" },
  { id: "mortgage", en: "Mortgage", zh: "房貸" },
  { id: "insurance", en: "Insurance", zh: "保險" },
  { id: "utilities", en: "Utilities", zh: "水電網路" },
  { id: "phone", en: "Phone", zh: "手機費" },
  { id: "loan_payment", en: "Loan payment", zh: "貸款付款" },
  { id: "membership", en: "Membership", zh: "會員費" },
  { id: "other_recurring", en: "Other", zh: "其他固定支出" },
];

const subscriptionUsageStatuses = [
  { id: "active", en: "Using it", zh: "有在使用" },
  { id: "rarely_used", en: "Rarely used", zh: "很少使用" },
  { id: "consider_canceling", en: "Consider canceling", zh: "可考慮取消" },
] as const;

const debtTypes: Array<{ id: DebtType; en: string; zh: string }> = [
  { id: "mortgage", en: "Mortgage", zh: "房貸" },
  { id: "car_loan", en: "Car loan", zh: "車貸" },
  { id: "student_loan", en: "Student loan", zh: "學貸" },
  { id: "credit_card", en: "Credit card", zh: "信用卡" },
  { id: "personal_loan", en: "Personal loan", zh: "私人借款" },
  { id: "other", en: "Other", zh: "其他" },
];

const chartColors = [
  "rgb(var(--blue))",
  "rgb(var(--mint))",
  "rgb(var(--amber))",
  "rgb(var(--rose))",
  "rgb(var(--ink))",
  "rgb(var(--titanium))",
];

function sanitizeNumericInput(value: string, allowDecimal: boolean) {
  const normalized = value.replace(/,/g, "").trim();
  const pattern = allowDecimal ? /^\d*(?:\.\d*)?$/ : /^\d*$/;
  if (!pattern.test(normalized)) return null;
  if (normalized === "") return "";

  const [integerPart, decimalPart] = normalized.split(".");
  const trimmedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
  return decimalPart === undefined ? trimmedInteger : `${trimmedInteger}.${decimalPart}`;
}

function normalizePaymentMethod(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "";
  if (normalized.includes("card")) return "Credit card";
  if (normalized.includes("cash")) return "Cash";
  if (normalized.includes("transfer") || normalized.includes("bank") || normalized.includes("debit")) return "Transfer";
  return "";
}

function getPaymentMethodLabel(value: string | null | undefined, locale: Locale) {
  const normalized = normalizePaymentMethod(value);
  const method = paymentMethods.find((option) => option.value === normalized);
  if (!method) return tx(locale, "Not set");
  return locale === "zh" ? method.zh : method.en;
}


export function PortfolioApp({ demo = false }: { demo?: boolean }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [mobileLayout, setMobileLayout] = useState<boolean | null>(null);
  const [locale, setLocale] = useState<Locale>("zh");
  const t = getDictionary(locale);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [cashflowTransactions, setCashflowTransactions] = useState<CashflowTransaction[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudget[]>([]);
  const [fxRefreshFailed, setFxRefreshFailed] = useState(false);
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<HoldingInput>(emptyForm);
  const [cashflowForm, setCashflowForm] = useState<CashflowTransactionInput>(emptyCashflowForm);
  const [recurringForm, setRecurringForm] = useState<RecurringExpenseInput>(emptyRecurringForm);
  const [debtForm, setDebtForm] = useState<DebtInput>(emptyDebtForm);
  const [budgetForm, setBudgetForm] = useState<MonthlyBudgetInput>(emptyBudgetForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCashflowId, setEditingCashflowId] = useState<string | null>(null);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [sellingHolding, setSellingHolding] = useState<EnrichedHolding | null>(null);
  const [portfolioName, setPortfolioName] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState<Currency>("USD");
  const [biometricLock, setBiometricLock] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [nativePlatform, setNativePlatform] = useState(false);
  const [paymentReminders, setPaymentReminders] = useState(false);
  const priceRequestId = useRef(0);

  useEffect(() => {
    document.documentElement.lang = {
      en: "en",
      es: "es",
      ja: "ja",
      ko: "ko",
      zh: "zh-Hant",
    }[locale];
  }, [locale]);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
    setBiometricLock(window.localStorage.getItem("biometricLock") === "on");
    setNativePlatform(isNativePlatform());
    setPaymentReminders(window.localStorage.getItem("paymentReminders") === "on");
  }, []);

  async function changeBiometricLock(next: boolean) {
    if (next) {
      const ok = await authenticate(tx(locale, "Confirm to enable Face ID lock"));
      if (!ok) return;
    }
    setBiometricLock(next);
    window.localStorage.setItem("biometricLock", next ? "on" : "off");
  }

  async function changePaymentReminders(next: boolean) {
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
    }
    setPaymentReminders(next);
    window.localStorage.setItem("paymentReminders", next ? "on" : "off");
  }

  useEffect(() => {
    if (!nativePlatform || demo) return;
    syncReminders(recurringExpenses, debts, locale, paymentReminders);
  }, [debts, demo, locale, nativePlatform, paymentReminders, recurringExpenses]);

  const applyDefaultFormCurrency = useCallback((nextCurrency: Currency) => {
    if (!editingCashflowId) setCashflowForm((current) => ({ ...current, currency: nextCurrency }));
    if (!editingRecurringId) setRecurringForm((current) => ({ ...current, currency: nextCurrency }));
    if (!editingDebtId) setDebtForm((current) => ({ ...current, currency: nextCurrency }));
    if (!editingBudgetId) setBudgetForm((current) => ({ ...current, currency: nextCurrency }));
  }, [editingBudgetId, editingCashflowId, editingDebtId, editingRecurringId]);

  async function changeDisplayCurrency(nextCurrency: Currency) {
    setDisplayCurrency(nextCurrency);
    applyDefaultFormCurrency(nextCurrency);
    window.localStorage.setItem(demo ? "displayCurrency:demo" : `displayCurrency:${userId}`, nextCurrency);

    if (demo) {
      return;
    }

    if (!supabase || !userId) return;
    const { error: settingsError } = await supabase
      .from("user_settings")
      .upsert({ display_currency: nextCurrency, user_id: userId }, { onConflict: "user_id" });
    if (settingsError) {
      setError(settingsError.message.includes("display_currency")
        ? "Please run supabase/migrations/0012_display_currency.sql in Supabase SQL Editor."
        : settingsError.message);
    }
  }

  const money = useMemo<MoneyFmt>(
    () => createMoney(displayCurrency, market?.fx ?? 1 / 32),
    [displayCurrency, market],
  );

  async function changePortfolioName(nextName: string) {
    const trimmed = nextName.trim().slice(0, 12);
    setPortfolioName(trimmed);

    if (demo) {
      if (trimmed) {
        window.localStorage.setItem("portfolioName", trimmed);
      } else {
        window.localStorage.removeItem("portfolioName");
      }
      return;
    }

    if (!supabase || !userId) return;
    const { error: settingsError } = await supabase
      .from("user_settings")
      .upsert({ portfolio_name: trimmed, user_id: userId }, { onConflict: "user_id" });
    if (settingsError) {
      setError(settingsError.message.includes("user_settings")
        ? "Please run supabase/migrations/0010_user_settings.sql in Supabase SQL Editor."
        : settingsError.message);
    }
  }

  useEffect(() => {
    const storedLocale = window.localStorage.getItem("locale");
    if (isLocale(storedLocale)) {
      setLocale(storedLocale);
    }
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const updateLayout = () => setMobileLayout(query.matches);
    updateLayout();
    query.addEventListener("change", updateLayout);
    return () => query.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    if (!demo) return;
    const demoData = createDemoData();
    setUserId("demo-user");
    setUserEmail("demo@example.com");
    const storedPortfolioName = window.localStorage.getItem("portfolioName");
    if (storedPortfolioName) {
      setPortfolioName(storedPortfolioName);
    }
    const storedDisplayCurrency = window.localStorage.getItem("displayCurrency:demo") ?? window.localStorage.getItem("displayCurrency");
    if (storedDisplayCurrency && (supportedCurrencies as readonly string[]).includes(storedDisplayCurrency)) {
      setDisplayCurrency(storedDisplayCurrency as Currency);
    }
    setHoldings(demoData.holdings);
    setCashflowTransactions(demoData.transactions);
    setInvestmentTransactions(demoData.investmentTransactions);
    setRecurringExpenses(demoData.recurringExpenses);
    setDebts(demoData.debts);
    setMonthlyBudgets(demoData.budgets);
    setMarket(demoData.market);
    setLoading(false);
  }, [demo]);

  const loadHoldings = useCallback(async () => {
    if (!supabase) {
      setError("Missing Supabase environment variables.");
      setLoading(false);
      return;
    }

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

    const storedDisplayCurrency = window.localStorage.getItem(`displayCurrency:${user.id}`) ?? window.localStorage.getItem("displayCurrency");
    if (storedDisplayCurrency && (supportedCurrencies as readonly string[]).includes(storedDisplayCurrency)) {
      setDisplayCurrency(storedDisplayCurrency as Currency);
    }

    const { data: settingsData, error: settingsError } = await supabase
      .from("user_settings")
      .select("*")
      .maybeSingle();

    if (settingsError) {
      if (!settingsError.message.includes("user_settings")) {
        setError(settingsError.message);
      }
    } else {
      setPortfolioName(settingsData?.portfolio_name ?? "");
      const storedCurrency = settingsData?.display_currency;
      if (storedCurrency && (supportedCurrencies as readonly string[]).includes(storedCurrency)) {
        setDisplayCurrency(storedCurrency as Currency);
        window.localStorage.setItem(`displayCurrency:${user.id}`, storedCurrency);
      }
    }

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

    const { data: transactionData, error: transactionError } = await supabase
      .from("cashflow_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (transactionError) {
      setError(transactionError.message.includes("cashflow_transactions")
        ? "Please run supabase/migrations/0005_cashflow_transactions.sql in Supabase SQL Editor."
        : transactionError.message);
    } else {
      setCashflowTransactions((transactionData ?? []) as CashflowTransaction[]);
    }

    const { data: investmentTransactionData, error: investmentTransactionError } = await supabase
      .from("investment_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (investmentTransactionError) {
      setError(investmentTransactionError.message.includes("investment_transactions")
        ? "Please run supabase/migrations/0017_investment_transactions.sql in Supabase SQL Editor."
        : investmentTransactionError.message);
    } else {
      setInvestmentTransactions((investmentTransactionData ?? []) as InvestmentTransaction[]);
    }

    const { data: recurringData, error: recurringError } = await supabase
      .from("recurring_expenses")
      .select("*")
      .order("next_due_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (recurringError) {
      setError(recurringError.message.includes("recurring_expenses")
        ? "Please run supabase/migrations/0006_recurring_expenses.sql in Supabase SQL Editor."
        : recurringError.message);
    } else {
      setRecurringExpenses((recurringData ?? []) as RecurringExpense[]);
    }

    const { data: debtData, error: debtError } = await supabase
      .from("debts")
      .select("*")
      .order("next_payment_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (debtError) {
      setError(debtError.message.includes("debts")
        ? "Please run supabase/migrations/0008_debts.sql in Supabase SQL Editor."
        : debtError.message);
    } else {
      setDebts((debtData ?? []) as Debt[]);
    }

    const { data: budgetData, error: budgetError } = await supabase
      .from("monthly_budgets")
      .select("*")
      .order("month", { ascending: false })
      .order("category", { ascending: true });

    if (budgetError) {
      setError(budgetError.message.includes("monthly_budgets")
        ? "Please run supabase/migrations/0009_monthly_budgets.sql in Supabase SQL Editor."
        : budgetError.message);
    } else {
      setMonthlyBudgets((budgetData ?? []) as MonthlyBudget[]);
    }

    setLoading(false);
  }, [supabase]);

  const refreshPrices = useCallback(
    async (nextHoldings = holdings) => {
      const requestId = ++priceRequestId.current;
      setRefreshing(true);
      try {
        let cachedFx = null;
        try { cachedFx = parseFxCache(JSON.parse(localStorage.getItem(FX_CACHE_KEY) ?? "null")); } catch { /* Storage may be unavailable. */ }
        const response = await fetch("/api/market/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holdings: nextHoldings, cachedFx }),
        });
        if (!response.ok) {
          throw new Error("Price refresh failed");
        }
        const data = (await response.json()) as MarketResponse;
        if (requestId === priceRequestId.current) {
          setFxRefreshFailed(false);
          setError((current) => current === "Price refresh failed" ? "" : current);
          try { localStorage.setItem(FX_CACHE_KEY, JSON.stringify(data.fx)); } catch { /* In-memory data remains usable. */ }
          setMarket((current) => ({
            ...data,
            quotes: { ...(current?.quotes ?? {}), ...data.quotes },
          }));
        }
      } catch (refreshError) {
        if (requestId === priceRequestId.current) {
          setFxRefreshFailed(true);
          setError(refreshError instanceof Error ? refreshError.message : "Price refresh failed");
        }
      } finally {
        if (requestId === priceRequestId.current) setRefreshing(false);
      }
    },
    [holdings],
  );

  useEffect(() => {
    if (demo) return;
    loadHoldings();
  }, [demo, loadHoldings]);

  useEffect(() => {
    if (!demo && !loading) {
      refreshPrices(holdings);
    }
  }, [demo, holdings, loading, refreshPrices]);

  const enriched = useMemo(
    () => enrichHoldings(holdings, market?.quotes ?? {}, market?.fx ?? 1 / 32),
    [holdings, market],
  );
  const totals = useMemo(() => getPortfolioTotals(enriched), [enriched]);
  const investmentPerformance = useMemo(
    () => getInvestmentPerformance(enriched, investmentTransactions, market?.fx ?? 1 / 32),
    [enriched, investmentTransactions, market],
  );
  const assetMix = useMemo(() => groupBy(enriched, (holding) => holding.asset_type), [enriched]);
  const currencyMix = useMemo(() => groupBy(enriched, (holding) => holding.cost_currency), [enriched]);
  const editingHolding = useMemo(
    () => holdings.find((holding) => holding.id === editingId) ?? null,
    [editingId, holdings],
  );
  const editingWalletCost = editingHolding?.source_kind === "wallet";
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

  function updateCashflowForm<K extends keyof CashflowTransactionInput>(key: K, value: CashflowTransactionInput[K]) {
    setCashflowForm((current) => {
      const next = {
        ...current,
        [key]: value,
      };
      if (key === "transaction_type") {
        next.category = cashflowCategories[value as CashflowType][0].id;
      }
      return next;
    });
  }

  function updateRecurringForm<K extends keyof RecurringExpenseInput>(key: K, value: RecurringExpenseInput[K]) {
    setRecurringForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateDebtForm<K extends keyof DebtInput>(key: K, value: DebtInput[K]) {
    setDebtForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateBudgetForm<K extends keyof MonthlyBudgetInput>(key: K, value: MonthlyBudgetInput[K]) {
    setBudgetForm((current) => ({
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
      quantity: String(holding.quantity),
      average_cost: String(holding.average_cost),
      break_even_price: holding.break_even_price == null
        ? ""
        : String(holding.break_even_price),
      gain_calculation_mode: resolveGainCalculationMode(holding),
      cost_currency: holding.cost_currency,
      market_data_id: holding.market_data_id ?? null,
      market_code: holding.market_code ?? null,
      exchange_code: holding.exchange_code ?? null,
      quote_currency: holding.quote_currency ?? holding.cost_currency,
      lot_size: holding.lot_size ?? (holding.asset_type === "tw_stock" ? 1000 : 1),
      cost_known: holding.cost_known !== false,
    });
    setActiveTab(holding.asset_type === "cash" ? "bank" : "holdings");
  }

  function startEditCashflow(transaction: CashflowTransaction) {
    setEditingCashflowId(transaction.id);
    setCashflowForm({
      transaction_type: transaction.transaction_type,
      amount: String(transaction.amount),
      currency: transaction.currency,
      category: transaction.category,
      description: transaction.description,
      transaction_date: transaction.transaction_date,
      payment_method: normalizePaymentMethod(transaction.payment_method),
      notes: transaction.notes ?? "",
    });
    setActiveTab("cashflow");
  }

  function startEditRecurring(expense: RecurringExpense) {
    setEditingRecurringId(expense.id);
    setRecurringForm({
      name: expense.name,
      amount: String(expense.amount),
      currency: expense.currency,
      category: expense.category,
      frequency: expense.frequency,
      next_due_date: expense.next_due_date,
      payment_method: normalizePaymentMethod(expense.payment_method),
      is_active: expense.is_active,
      is_subscription: expense.is_subscription ?? false,
      usage_status: expense.usage_status ?? "active",
      reminder_days: String(expense.reminder_days ?? 3),
      notes: expense.notes ?? "",
    });
    setActiveTab("cashflow");
  }

  function startEditDebt(debt: Debt) {
    setEditingDebtId(debt.id);
    setDebtForm({
      name: debt.name,
      debt_type: debt.debt_type,
      original_principal: String(debt.original_principal),
      remaining_principal: String(debt.remaining_principal),
      currency: debt.currency,
      interest_rate: String(debt.interest_rate),
      minimum_payment: String(debt.minimum_payment),
      next_payment_date: debt.next_payment_date,
      lender: debt.lender ?? "",
      is_active: debt.is_active,
      notes: debt.notes ?? "",
    });
    setActiveTab("cashflow");
  }

  function startEditBudget(budget: MonthlyBudget) {
    setEditingBudgetId(budget.id);
    setBudgetForm({
      month: budget.month.slice(0, 7),
      category: budget.category,
      amount: String(budget.amount),
      currency: budget.currency,
      notes: budget.notes ?? "",
    });
    setActiveTab("cashflow");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function resetCashForm() {
    setEditingId(null);
    setForm(createCashForm(displayCurrency));
  }

  function resetCashflowForm() {
    setEditingCashflowId(null);
    setCashflowForm({
      ...emptyCashflowForm,
      currency: displayCurrency,
      transaction_date: new Date().toISOString().slice(0, 10),
    });
  }

  function resetRecurringForm() {
    setEditingRecurringId(null);
    setRecurringForm({
      ...emptyRecurringForm,
      currency: displayCurrency,
      next_due_date: new Date().toISOString().slice(0, 10),
    });
  }

  function resetDebtForm() {
    setEditingDebtId(null);
    setDebtForm({
      ...emptyDebtForm,
      currency: displayCurrency,
      next_payment_date: new Date().toISOString().slice(0, 10),
    });
  }

  function resetBudgetForm() {
    setEditingBudgetId(null);
    setBudgetForm({
      ...emptyBudgetForm,
      category: totalBudgetCategory,
      currency: displayCurrency,
      month: new Date().toISOString().slice(0, 7),
    });
  }

  async function saveHolding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Changes are not saved."));
      return;
    }
    if (!supabase || !userId) {
      setError("Supabase is not ready.");
      return;
    }

    const quantity = Number(form.quantity || 0);
    const averageCost = form.asset_type === "cash" ? 1 : Number(form.average_cost || 0);
    const gainCalculationMode = form.asset_type === "cash"
      ? "average_cost"
      : form.gain_calculation_mode;
    const breakEvenInput = form.break_even_price.trim();
    const parsedBreakEvenPrice = gainCalculationMode !== "break_even" || breakEvenInput === ""
      ? null
      : Number(breakEvenInput);
    const breakEvenPrice = parsedBreakEvenPrice;
    if (form.quantity === "" || form.average_cost === "") {
      setForm((current) => ({
        ...current,
        quantity: current.quantity || "0",
        average_cost: current.average_cost || "0",
      }));
    }
    if (!Number.isFinite(quantity) || !Number.isFinite(averageCost)) {
      setError("Quantity and average cost must be valid numbers.");
      return;
    }
    // A new zero-quantity position is an empty row that later gets mistaken for
    // the real one and edited into a duplicate.
    if (!editingId && form.asset_type !== "cash" && quantity <= 0) {
      setError(tx(locale, "Quantity must be greater than zero."));
      return;
    }
    if (
      editingId &&
      !editingWalletCost &&
      editingHolding &&
      editingHolding.asset_type !== "cash" &&
      quantity < editingHolding.quantity
    ) {
      setError(getQuantityDecreaseHelp(locale));
      return;
    }
    if (
      gainCalculationMode === "break_even" &&
      (breakEvenPrice === null || !Number.isFinite(breakEvenPrice) || breakEvenPrice <= 0)
    ) {
      setError(t.breakEvenInvalid);
      return;
    }

    if (editingId && editingWalletCost) {
      const { error: costError } = await supabase
        .from("holdings")
        .update({
          average_cost: averageCost,
          break_even_price: breakEvenPrice,
          gain_calculation_mode: gainCalculationMode,
          cost_currency: form.cost_currency,
          cost_known: form.cost_known !== false,
        })
        .eq("id", editingId);

      if (costError) {
        setError(costError.message);
        return;
      }

      resetForm();
      await loadHoldings();
      return;
    }

    const isCash = form.asset_type === "cash";
    if (isCash && !form.name.trim()) {
      setError(tx(locale, "Enter a bank name."));
      return;
    }
    const payload = {
      ...form,
      asset_type: resolveAssetType(form),
      user_id: userId,
      symbol: isCash ? form.cost_currency : form.symbol.toUpperCase().trim(),
      name: isCash ? form.name.trim() : (form.name.trim() || form.symbol.toUpperCase().trim()),
      quantity,
      average_cost: averageCost,
      break_even_price: breakEvenPrice,
      gain_calculation_mode: gainCalculationMode,
      cost_known: isCash ? true : form.cost_known,
    };

    // A manual top-up belongs to the existing position, not a second row. Wallet
    // assets remain separate because their on-chain cost basis is not reliable.
    if (!editingId && !isCash) {
      const { data: matches, error: findError } = await supabase
        .from("holdings")
        .select("id, quantity, average_cost, break_even_price, gain_calculation_mode, cost_known, name, market_data_id, market_code, exchange_code, quote_currency, lot_size")
        .eq("user_id", userId)
        .eq("source_kind", "manual")
        // Stock types differ only by how the listing was resolved, so a typed
        // SPCX ("stock") and a searched SPCX ("us_stock") are one position.
        .in("asset_type", ["stock", "us_stock", "tw_stock"].includes(payload.asset_type) ? ["stock", "us_stock", "tw_stock"] : [payload.asset_type])
        .eq("symbol", payload.symbol)
        .eq("cost_currency", payload.cost_currency)
        .limit(1);

      if (findError) {
        setError(findError.message);
        return;
      }

      const existing = matches?.[0];
      if (existing) {
        const mergedQuantity = existing.quantity + quantity;
        const bothCostsKnown = existing.cost_known !== false && payload.cost_known !== false;
        const mergedAverageCost = bothCostsKnown && mergedQuantity > 0
          ? ((existing.quantity * existing.average_cost) + (quantity * averageCost)) / mergedQuantity
          : existing.average_cost;
        const { error: mergeError } = await supabase
          .from("holdings")
          .update({
            quantity: mergedQuantity,
            average_cost: mergedAverageCost,
            break_even_price: breakEvenPrice,
            gain_calculation_mode: gainCalculationMode,
            cost_known: bothCostsKnown,
            name: existing.name || payload.name,
            market_data_id: payload.market_data_id ?? existing.market_data_id ?? null,
            market_code: payload.market_code ?? existing.market_code ?? null,
            exchange_code: payload.exchange_code ?? existing.exchange_code ?? null,
            quote_currency: payload.quote_currency ?? existing.quote_currency ?? null,
            lot_size: payload.lot_size ?? existing.lot_size ?? 1,
          })
          .eq("id", existing.id);

        if (mergeError) {
          setError(mergeError.message);
          return;
        }

        hapticSuccess();
        resetForm();
        await loadHoldings();
        return;
      }
    }

    const query = editingId
      ? supabase.from("holdings").update(payload).eq("id", editingId)
      : supabase.from("holdings").insert(payload);

    const { error: saveError } = await query;
    if (saveError) {
      setError(saveError.message);
      return;
    }

    hapticSuccess();
    resetForm();
    await loadHoldings();
  }

  async function recordInvestmentSale(input: InvestmentSaleInput) {
    if (demo) {
      throw new Error(tx(locale, "Demo mode is read-only. Changes are not saved."));
    }
    if (!supabase || !userId) {
      throw new Error("Supabase is not ready.");
    }

    const { error: saleError } = await supabase.rpc("record_investment_sale", {
      p_fees: input.fees,
      p_holding_id: input.holdingId,
      p_notes: input.notes.trim() || null,
      p_price_per_unit: input.pricePerUnit,
      p_quantity: input.quantity,
      p_transaction_date: input.transactionDate,
    });

    if (saleError) {
      throw new Error(
        saleError.message.includes("record_investment_sale") || saleError.message.includes("investment_transactions")
          ? "Please run supabase/migrations/0017_investment_transactions.sql in Supabase SQL Editor."
          : saleError.message,
      );
    }

    hapticSuccess();
    await loadHoldings();
  }

  async function saveCashflowTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Changes are not saved."));
      return;
    }
    if (!supabase || !userId) {
      setError("Supabase is not ready.");
      return;
    }

    const amount = Number(cashflowForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(tx(locale, "Amount must be greater than 0."));
      return;
    }

    const payload = {
      user_id: userId,
      transaction_type: cashflowForm.transaction_type,
      amount,
      currency: cashflowForm.currency,
      category: cashflowForm.category,
      description: cashflowForm.description.trim() || getCategoryLabel(cashflowForm.category, locale),
      transaction_date: cashflowForm.transaction_date,
      payment_method: cashflowForm.payment_method.trim() || null,
      notes: cashflowForm.notes.trim() || null,
    };

    const query = editingCashflowId
      ? supabase.from("cashflow_transactions").update(payload).eq("id", editingCashflowId)
      : supabase.from("cashflow_transactions").insert(payload);

    const { data: saved, error: saveError } = await query.select("id").single();
    if (saveError) {
      setError(saveError.message);
      return;
    }

    if (!editingCashflowId && saved) queueFlowActivity(saved.id);

    resetCashflowForm();
    await loadHoldings();
  }

  async function saveRecurringExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Changes are not saved."));
      return;
    }
    if (!supabase || !userId) {
      setError("Supabase is not ready.");
      return;
    }

    const amount = Number(recurringForm.amount || 0);
    const reminderDays = Number(recurringForm.reminder_days || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(tx(locale, "Amount must be greater than 0."));
      return;
    }
    if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 60) {
      setError(tx(locale, "Reminder days must be an integer from 0 to 60."));
      return;
    }

    const payload = {
      user_id: userId,
      name: recurringForm.name.trim(),
      amount,
      currency: recurringForm.currency,
      category: recurringForm.category,
      frequency: recurringForm.frequency,
      next_due_date: recurringForm.next_due_date,
      payment_method: recurringForm.payment_method.trim() || null,
      is_active: recurringForm.is_active,
      is_subscription: recurringForm.is_subscription,
      usage_status: recurringForm.usage_status,
      reminder_days: reminderDays,
      notes: recurringForm.notes.trim() || null,
    };

    if (!payload.name) {
      setError(tx(locale, "Please enter a recurring expense name."));
      return;
    }

    const query = editingRecurringId
      ? supabase.from("recurring_expenses").update(payload).eq("id", editingRecurringId)
      : supabase.from("recurring_expenses").insert(payload);

    const { error: saveError } = await query;
    if (saveError) {
      setError(saveError.message.includes("is_subscription") || saveError.message.includes("usage_status") || saveError.message.includes("reminder_days")
        ? "Please run supabase/migrations/0007_subscription_management.sql in Supabase SQL Editor."
        : saveError.message);
      return;
    }

    resetRecurringForm();
    await loadHoldings();
  }

  async function saveDebt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Changes are not saved."));
      return;
    }
    if (!supabase || !userId) {
      setError("Supabase is not ready.");
      return;
    }

    const originalPrincipal = Number(debtForm.original_principal || 0);
    const remainingPrincipal = Number(debtForm.remaining_principal || 0);
    const interestRate = Number(debtForm.interest_rate || 0);
    const minimumPayment = Number(debtForm.minimum_payment || 0);

    if (!Number.isFinite(originalPrincipal) || !Number.isFinite(remainingPrincipal) || !Number.isFinite(interestRate) || !Number.isFinite(minimumPayment)) {
      setError(tx(locale, "Principal, interest rate, and payment must be valid numbers."));
      return;
    }
    if (remainingPrincipal < 0 || originalPrincipal < 0 || interestRate < 0 || minimumPayment < 0) {
      setError(tx(locale, "Debt amounts, interest rate, and payment cannot be negative."));
      return;
    }

    const payload = {
      user_id: userId,
      name: debtForm.name.trim(),
      debt_type: debtForm.debt_type,
      original_principal: originalPrincipal,
      remaining_principal: remainingPrincipal,
      currency: debtForm.currency,
      interest_rate: interestRate,
      minimum_payment: minimumPayment,
      next_payment_date: debtForm.next_payment_date,
      lender: debtForm.lender.trim() || null,
      is_active: debtForm.is_active,
      notes: debtForm.notes.trim() || null,
    };

    if (!payload.name) {
      setError(tx(locale, "Please enter a debt name."));
      return;
    }

    const query = editingDebtId
      ? supabase.from("debts").update(payload).eq("id", editingDebtId)
      : supabase.from("debts").insert(payload);

    const { error: saveError } = await query;
    if (saveError) {
      setError(saveError.message.includes("debts")
        ? "Please run supabase/migrations/0008_debts.sql in Supabase SQL Editor."
        : saveError.message);
      return;
    }

    resetDebtForm();
    await loadHoldings();
  }

  async function saveMonthlyBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Changes are not saved."));
      return;
    }
    if (!supabase || !userId) {
      setError("Supabase is not ready.");
      return;
    }

    const amount = Number(budgetForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(tx(locale, "Budget amount must be greater than 0."));
      return;
    }

    const payload = {
      user_id: userId,
      month: `${budgetForm.month}-01`,
      category: budgetForm.category,
      amount,
      currency: budgetForm.currency,
      notes: budgetForm.notes.trim() || null,
    };

    const query = editingBudgetId
      ? supabase.from("monthly_budgets").update(payload).eq("id", editingBudgetId)
      : supabase.from("monthly_budgets").upsert(payload, { onConflict: "user_id,month,category,currency" });

    const { error: saveError } = await query;
    if (saveError) {
      setError(saveError.message.includes("monthly_budgets")
        ? "Please run supabase/migrations/0011_multi_currency_total_budget.sql in Supabase SQL Editor."
        : saveError.message);
      return;
    }

    resetBudgetForm();
    await loadHoldings();
  }

  async function deleteHolding(id: string) {
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Nothing was deleted."));
      return;
    }
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

  async function clearAllHoldings() {
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Nothing was deleted."));
      return;
    }
    if (!supabase || !userId || !holdings.length) {
      return;
    }
    const confirmed = window.confirm(
      tx(locale, "Delete all {count} holdings? This cannot be undone. Wallet-tracked assets will reappear after the next wallet sync.", {
        count: holdings.length,
      }),
    );
    if (!confirmed) return;
    const { error: deleteError } = await supabase.from("holdings").delete().eq("user_id", userId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    tapMedium();
    resetForm();
    await loadHoldings();
  }

  async function deleteCashflowTransaction(id: string) {
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Nothing was deleted."));
      return;
    }
    if (!supabase) {
      return;
    }
    const { error: deleteError } = await supabase.from("cashflow_transactions").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (editingCashflowId === id) resetCashflowForm();
    await loadHoldings();
  }

  async function deleteRecurringExpense(id: string) {
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Nothing was deleted."));
      return;
    }
    if (!supabase) {
      return;
    }
    const { error: deleteError } = await supabase.from("recurring_expenses").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (editingRecurringId === id) resetRecurringForm();
    await loadHoldings();
  }

  async function deleteDebt(id: string) {
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Nothing was deleted."));
      return;
    }
    if (!supabase) {
      return;
    }
    const { error: deleteError } = await supabase.from("debts").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (editingDebtId === id) resetDebtForm();
    await loadHoldings();
  }

  async function deleteMonthlyBudget(id: string) {
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Nothing was deleted."));
      return;
    }
    if (!supabase) {
      return;
    }
    const { error: deleteError } = await supabase.from("monthly_budgets").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (editingBudgetId === id) resetBudgetForm();
    await loadHoldings();
  }

  async function signOut() {
    if (demo) {
      window.location.href = "/";
      return;
    }
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function deleteAccount() {
    if (demo) {
      throw new Error(tx(locale, "Demo mode is read-only. Nothing was deleted."));
    }
    if (!supabase) {
      throw new Error(tx(locale, "Supabase environment variables are missing."));
    }

    const response = await fetch("/api/account/delete", { method: "DELETE" });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.error ?? tx(locale, "Could not delete this account."));
    }

    await supabase.auth.signOut();
    window.location.href = "/login?account_deleted=1";
  }

  if (loading || (!market && !fxRefreshFailed) || mobileLayout === null) {
    return <AppLoader label={tx(locale, "Loading portfolio")} />;
  }

  if (!market) {
    const c = fxCopy(locale);
    return <BiometricLock demo={demo} enabled={biometricLock} locale={locale}>
      <main className="flex min-h-[100dvh] items-center justify-center p-5">
        <div role="status" className="apple-card max-w-md space-y-4 border border-line p-6 text-ink">
          <p>{c.unavailable}</p>
          <button type="button" disabled={refreshing} onClick={() => refreshPrices()} className="primary-button focus-ring min-h-11 rounded-xl px-5 disabled:opacity-50">{c.retry}</button>
        </div>
      </main>
    </BiometricLock>;
  }

  if (mobileLayout) {
    return (
      <BiometricLock demo={demo} enabled={biometricLock} locale={locale}>
      <MobilePortfolioApp
        fxStatus={<FxStatus fx={market.fx} locale={locale} failed={fxRefreshFailed} />}
        biometricAvailable={biometricAvailable}
        biometricLock={biometricLock}
        nativePlatform={nativePlatform}
        paymentReminders={paymentReminders}
        onBiometricLockChange={changeBiometricLock}
        onPaymentRemindersChange={changePaymentReminders}
        budgets={monthlyBudgets}
        cashflowForm={cashflowForm}
        debtForm={debtForm}
        debts={debts}
        demo={demo}
        editingDebt={Boolean(editingDebtId)}
        editingHolding={Boolean(editingId)}
        editingRecurring={Boolean(editingRecurringId)}
        enriched={enriched}
        error={error}
        form={form}
        investmentPerformance={investmentPerformance}
        investmentTransactions={investmentTransactions}
        locale={locale}
        portfolioName={portfolioName}
        recurringExpenses={recurringExpenses}
        recurringForm={recurringForm}
        refreshedAt={market?.refreshedAt}
        refreshing={refreshing}
        transactions={cashflowTransactions}
        displayCurrency={displayCurrency}
        fx={market?.fx ?? 1 / 32}
        userEmail={userEmail}
        userId={userId}
        onDeleteHolding={deleteHolding}
        onEditHolding={startEdit}
        onSellHolding={setSellingHolding}
        onCloseSale={() => setSellingHolding(null)}
        onRecordSale={recordInvestmentSale}
        sellingHolding={sellingHolding}
        onDeleteDebt={deleteDebt}
        onDeleteRecurring={deleteRecurringExpense}
        onEditDebt={startEditDebt}
        onEditRecurring={startEditRecurring}
        onDisplayCurrencyChange={changeDisplayCurrency}
        onHoldingsChanged={loadHoldings}
        onLocaleChange={changeLocale}
        onPortfolioNameChange={changePortfolioName}
        onRefresh={() => refreshPrices()}
        onResetCashflow={resetCashflowForm}
        onResetCashHolding={resetCashForm}
        onResetDebt={resetDebtForm}
        onResetHolding={resetForm}
        onResetRecurring={resetRecurringForm}
        onSaveCashflow={saveCashflowTransaction}
        onSaveDebt={saveDebt}
        onSaveHolding={saveHolding}
        onSaveRecurring={saveRecurringExpense}
        onDeleteAccount={deleteAccount}
        onSignOut={signOut}
        onUpdateCashflow={updateCashflowForm}
        onUpdateDebt={updateDebtForm}
        onUpdateHolding={updateForm}
        onUpdateRecurring={updateRecurringForm}
      />
      </BiometricLock>
    );
  }

  return (
    <MoneyProvider money={money}>
    <BiometricLock demo={demo} enabled={biometricLock} locale={locale}>
    <main className="min-h-screen px-3 py-3 sm:px-6 sm:py-6">
      <div className="mx-auto grid max-w-[1520px] grid-cols-1 gap-5 lg:grid-cols-[236px_1fr]">
        <aside className="glass-panel app-sidebar p-3.5 lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] lg:overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-6 flex shrink-0 items-center gap-3 px-2 pt-1">
              <div className="primary-button flex h-11 w-11 items-center justify-center rounded-[16px]">
                <CircleDollarSign size={21} />
              </div>
              <div>
                <h1 className="font-semibold text-ink">{t.appName}</h1>
                <p className="text-xs text-titanium">Portfolio workspace</p>
              </div>
            </div>

            <nav className="app-sidebar-nav min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <NavSection label={tx(locale, "Investing")}>
                <NavButton active={activeTab === "dashboard"} icon={<LayoutDashboard size={18} />} label={t.dashboard} onClick={() => setActiveTab("dashboard")} />
                <NavButton active={activeTab === "holdings"} icon={<WalletCards size={18} />} label={t.holdings} onClick={() => setActiveTab("holdings")} />
                <NavButton active={activeTab === "quantities"} icon={<ListChecks size={18} />} label={t.quantities} onClick={() => setActiveTab("quantities")} />
                <NavButton active={activeTab === "analysis"} icon={<BarChart3 size={18} />} label={t.analysis} onClick={() => setActiveTab("analysis")} />
              </NavSection>
              <NavSection label={tx(locale, "Bank")}>
                <NavButton active={activeTab === "bank"} icon={<Landmark size={18} />} label={tx(locale, "Cash")} onClick={() => { resetCashForm(); setActiveTab("bank"); }} />
              </NavSection>
              <NavSection label={tx(locale, "Cashflow")}>
                <NavButton active={activeTab === "cashflow"} icon={<ReceiptText size={18} />} label={t.cashflow} onClick={() => setActiveTab("cashflow")} />
                <NavButton active={activeTab === "financialHealth"} icon={<Activity size={18} />} label={t.financialHealth} onClick={() => setActiveTab("financialHealth")} />
                <NavButton active={activeTab === "charts"} icon={<LineChartIcon size={18} />} label={t.charts} onClick={() => setActiveTab("charts")} />
              </NavSection>
              <NavSection label={tx(locale, "System")}>
                <NavButton active={activeTab === "settings"} icon={<Settings size={18} />} label={t.settings} onClick={() => setActiveTab("settings")} />
              </NavSection>
            </nav>

            <div className="mt-5 shrink-0 space-y-2.5 lg:mt-3 lg:border-t lg:border-line lg:px-0.5 lg:pb-1 lg:pt-3">
              <div className="subtle-panel apple-card-sm p-3.5">
                <p className="text-xs uppercase text-titanium">{demo ? "Demo mode" : t.signedIn}</p>
                <p className="mt-1 truncate text-sm text-ink">{demo ? (tx(locale, "Sample data, read-only")) : userEmail}</p>
              </div>
              {!demo && (
                <button
                  className="interactive-muted focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm text-ink transition"
                  onClick={signOut}
                  type="button"
                >
                  <LogOut size={16} />
                  {t.signOut}
                </button>
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          <Header
            activeTab={activeTab}
            displayCurrency={displayCurrency}
            locale={locale}
            refreshedAt={market?.refreshedAt}
            refreshing={refreshing}
            t={t}
            onRefresh={() => refreshPrices()}
            onDisplayCurrencyChange={changeDisplayCurrency}
            onLocaleChange={changeLocale}
          />

          <FxStatus fx={market.fx} locale={locale} failed={fxRefreshFailed} />

          {error && (
            <div className="apple-card-sm border border-rose/30 bg-rose/10 p-4 text-sm text-rose">
              {error}
            </div>
          )}

          {activeTab === "dashboard" && (
            <DashboardView enriched={enriched} assetMix={assetMix} investmentPerformance={investmentPerformance} locale={locale} totals={totals} t={t} onEdit={startEdit} />
          )}

          {activeTab === "holdings" && (
            <HoldingsView
              demo={demo}
              editingId={editingId}
              enriched={enriched}
              form={form}
              investmentTransactions={investmentTransactions}
              editingWalletCost={editingWalletCost}
              locale={locale}
              t={t}
              userId={userId}
              onClearAll={clearAllHoldings}
              onDelete={deleteHolding}
              onEdit={startEdit}
              onSell={setSellingHolding}
              onReset={resetForm}
              onSave={saveHolding}
              onUpdateForm={updateForm}
              onHoldingsChanged={loadHoldings}
            />
          )}

          {activeTab === "bank" && (
            <HoldingsView
              cashOnly
              demo={demo}
              editingId={editingId}
              editingWalletCost={false}
              enriched={enriched}
              form={form}
              locale={locale}
              t={t}
              userId={userId}
              onClearAll={clearAllHoldings}
              onDelete={deleteHolding}
              onEdit={startEdit}
              onReset={resetCashForm}
              onSave={saveHolding}
              onUpdateForm={updateForm}
              onHoldingsChanged={loadHoldings}
            />
          )}

          {activeTab === "quantities" && (
            <QuantitiesView enriched={aggregateHoldingsForOverview(enriched.filter((holding) => holding.asset_type !== "cash"))} locale={locale} t={t} />
          )}

          {activeTab === "cashflow" && (
            <CashflowView
              assetValue={totals.totalValue}
              cashValue={enriched.filter(h => h.asset_type === "cash").reduce((sum, h) => sum + h.valueUsd, 0)}
              budgetEditingId={editingBudgetId}
              budgetForm={budgetForm}
              budgets={monthlyBudgets}
              debtEditingId={editingDebtId}
              debtForm={debtForm}
              debts={debts}
              editingId={editingCashflowId}
              form={cashflowForm}
              locale={locale}
              recurringEditingId={editingRecurringId}
              recurringExpenses={recurringExpenses}
              recurringForm={recurringForm}
              transactions={cashflowTransactions}
              onDelete={deleteCashflowTransaction}
              onDeleteBudget={deleteMonthlyBudget}
              onDeleteDebt={deleteDebt}
              onEdit={startEditCashflow}
              onEditBudget={startEditBudget}
              onEditDebt={startEditDebt}
              onDeleteRecurring={deleteRecurringExpense}
              onEditRecurring={startEditRecurring}
              onReset={resetCashflowForm}
              onResetBudget={resetBudgetForm}
              onResetDebt={resetDebtForm}
              onResetRecurring={resetRecurringForm}
              onSave={saveCashflowTransaction}
              onSaveBudget={saveMonthlyBudget}
              onSaveDebt={saveDebt}
              onSaveRecurring={saveRecurringExpense}
              onUpdateBudgetForm={updateBudgetForm}
              onUpdateDebtForm={updateDebtForm}
              onUpdateForm={updateCashflowForm}
              onUpdateRecurringForm={updateRecurringForm}
            />
          )}

          {activeTab === "financialHealth" && (
            <FinancialHealthView
              budgets={monthlyBudgets}
              debts={debts}
              enriched={enriched}
              locale={locale}
              recurringExpenses={recurringExpenses}
              totals={totals}
              transactions={cashflowTransactions}
              twdToUsd={market?.fx ?? 1 / 32}
            />
          )}

          {activeTab === "charts" && (
            <ChartsView
              debts={debts}
              enriched={enriched}
              locale={locale}
              recurringExpenses={recurringExpenses}
              totals={totals}
              transactions={cashflowTransactions}
              twdToUsd={market?.fx ?? 1 / 32}
            />
          )}

          {activeTab === "analysis" && (
            <AnalysisView
              assetMix={assetMix}
              currencyMix={currencyMix}
              enriched={enriched}
              locale={locale}
              t={t}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView biometricAvailable={biometricAvailable} biometricLock={biometricLock} demo={demo} displayCurrency={displayCurrency} locale={locale} market={market} nativePlatform={nativePlatform} paymentReminders={paymentReminders} t={t} onBiometricLockChange={changeBiometricLock} onDeleteAccount={deleteAccount} onDisplayCurrencyChange={changeDisplayCurrency} onLocaleChange={changeLocale} onPaymentRemindersChange={changePaymentReminders} />
          )}
        </section>
      </div>
      {sellingHolding && (
        <InvestmentSaleModal
          holding={sellingHolding}
          locale={locale}
          onClose={() => setSellingHolding(null)}
          onSubmit={recordInvestmentSale}
        />
      )}
    </main>
    </BiometricLock>
    </MoneyProvider>
  );
}

function Header({
  activeTab,
  displayCurrency,
  locale,
  refreshedAt,
  refreshing,
  t,
  onRefresh,
  onDisplayCurrencyChange,
  onLocaleChange,
}: {
  activeTab: Tab;
  displayCurrency: Currency;
  locale: Locale;
  refreshedAt?: string;
  refreshing: boolean;
  t: ReturnType<typeof getDictionary>;
  onRefresh: () => void;
  onDisplayCurrencyChange: (currency: Currency) => void;
  onLocaleChange: (locale: Locale) => void;
}) {
  const title = activeTab === "bank" ? tx(locale, "Cash") : t[activeTab];
  return (
    <header className="glass-panel apple-card flex items-center justify-between gap-3 px-3.5 py-3 sm:flex-wrap sm:gap-4 sm:px-6 sm:py-4">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl font-semibold capitalize tracking-[-0.035em] text-ink sm:text-2xl">{title}</h2>
        <p className="mt-1 truncate text-[11px] text-titanium sm:text-xs">
          {t.lastUpdated}: {refreshedAt ? new Date(refreshedAt).toLocaleString() : "Pending first refresh"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:flex-wrap sm:gap-3">
        <ThemeToggle compact locale={locale} />
        <label className="pill-panel focus-within:ring-2 focus-within:ring-[var(--accent)]/35 relative hidden h-11 min-w-[118px] cursor-pointer items-center justify-center gap-2 rounded-full px-4 min-[390px]:flex">
          <Languages aria-hidden="true" className="shrink-0 text-[var(--accent)]" size={18} />
          <span className="text-sm font-semibold text-ink">{localeNames[locale]}</span>
          <select
            aria-label={t.language}
            title={localeNames[locale]}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
            value={locale}
            onChange={(event) => onLocaleChange(event.target.value as Locale)}
          >
            {localeOrder.map((item) => <option key={item} value={item}>{localeNames[item]}</option>)}
          </select>
        </label>
        <label className="pill-panel focus-within:ring-2 focus-within:ring-[var(--accent)]/35 relative hidden h-11 min-w-[112px] cursor-pointer items-center justify-center gap-2 rounded-full px-4 min-[520px]:flex">
          <CircleDollarSign aria-hidden="true" className="shrink-0 text-[var(--accent)]" size={18} />
          <span className="text-sm font-semibold text-ink">{currencySymbols[displayCurrency]} {displayCurrency}</span>
          <select
            aria-label={t.baseCurrency}
            title={t.baseCurrency}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
            value={displayCurrency}
            onChange={(event) => onDisplayCurrencyChange(event.target.value as Currency)}
          >
            {supportedCurrencies.map((currency) => (
              <option key={currency} value={currency}>{currencySymbols[currency]} {currency}</option>
            ))}
          </select>
        </label>
        <button
          aria-label={t.refresh}
          className="primary-button focus-ring flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition sm:px-4"
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw className={clsx(refreshing && "animate-spin")} size={17} />
          <span className="hidden sm:inline">{t.refresh}</span>
        </button>
      </div>
    </header>
  );
}

function DashboardView({
  enriched,
  assetMix,
  investmentPerformance,
  locale,
  totals,
  t,
  onEdit,
}: {
  enriched: EnrichedHolding[];
  assetMix: Array<{ name: string; value: number }>;
  investmentPerformance: ReturnType<typeof getInvestmentPerformance>;
  locale: Locale;
  totals: ReturnType<typeof getPortfolioTotals>;
  t: ReturnType<typeof getDictionary>;
  onEdit: (holding: Holding) => void;
}) {
  const money = useMoney();
  const overviewHoldings = useMemo(
    () => sortDashboardHoldings(aggregateHoldingsForOverview(enriched)),
    [enriched],
  );
  const investmentHoldings = useMemo(
    () => overviewHoldings.filter((holding) => holding.asset_type !== "cash"),
    [overviewHoldings],
  );
  const cashHoldings = useMemo(
    () => overviewHoldings.filter((holding) => holding.asset_type === "cash"),
    [overviewHoldings],
  );
  const sourceMap = useMemo(() => buildSourceMap(enriched), [enriched]);
  const [chartKey, setChartKey] = useState("");
  const [tradingViewTheme, setTradingViewTheme] = useState<"dark" | "light">("light");
  const selectedChartHolding = investmentHoldings.find((holding) => holdingSourceKey(holding) === chartKey) ?? investmentHoldings[0] ?? null;
  const tradingViewSymbol = selectedChartHolding ? toTradingViewSymbol(selectedChartHolding) : null;
  const performanceHoldings = investmentHoldings.filter((holding) => holding.gainConfirmed);
  const leaders = [...performanceHoldings].sort((a, b) => b.gainPercent - a.gainPercent).slice(0, 3);
  const laggards = [...performanceHoldings].sort((a, b) => a.gainPercent - b.gainPercent).slice(0, 3);
  const gainWarning = t.gainCoverageWarning
    .replace("{known}", String(totals.gainKnownCount))
    .replace("{total}", String(totals.gainInvestmentCount));
  const showGainWarning = totals.gainInvestmentCount > 0 && !totals.gainDataComplete;

  useEffect(() => {
    const updateTheme = () => setTradingViewTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributeFilter: ["data-theme"], attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!investmentHoldings.length) {
      setChartKey("");
      return;
    }
    if (!investmentHoldings.some((holding) => holdingSourceKey(holding) === chartKey)) {
      setChartKey(holdingSourceKey(investmentHoldings[0]));
    }
  }, [chartKey, investmentHoldings]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard footer={<InvestmentCost holdings={enriched} locale={locale} />} primary label={t.totalValue} value={money.fmtUsd(totals.totalValue)} icon={<CircleDollarSign size={20} />} />
        <MetricCard
          icon={<Activity size={20} />}
          label={t.totalGain}
          trend={totals.hasGainData ? totals.totalGain : undefined}
          value={totals.hasGainData ? money.fmtUsd(totals.totalGain) : "N/A"}
          warning={showGainWarning ? gainWarning : undefined}
        />
        <MetricCard label={t.dayChange} value={money.fmtUsd(totals.dayChange)} detail={formatPercent(totals.dayChangePercent)} trend={totals.dayChange} icon={<RefreshCw size={20} />} />
        <MetricCard
          icon={<BarChart3 size={20} />}
          label={t.returnRate}
          trend={totals.hasGainData ? totals.totalReturn : undefined}
          value={totals.hasGainData ? formatPercent(totals.totalReturn) : "N/A"}
          warning={showGainWarning ? gainWarning : undefined}
        />
      </div>

      <InvestmentPerformancePanel locale={locale} performance={investmentPerformance} />

      <section className="glass-panel apple-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-ink">TradingView</h3>
          </div>
          <select
            className="input-control focus-ring min-w-[180px] px-3 text-sm"
            value={selectedChartHolding ? holdingSourceKey(selectedChartHolding) : ""}
            onChange={(event) => setChartKey(event.target.value)}
          >
            {investmentHoldings.map((holding) => (
              <option key={holdingSourceKey(holding)} value={holdingSourceKey(holding)}>
                {holding.symbol} · {holding.name}
              </option>
            ))}
          </select>
        </div>
        <TradingViewWidget locale={locale} symbol={tradingViewSymbol} theme={tradingViewTheme} />
      </section>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="glass-panel apple-card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-ink">{t.investmentHoldings}</h3>
              <p className="mt-1 text-sm text-titanium">{investmentHoldings.length}</p>
            </div>
          </div>
          <HoldingsTable
            allowEdit={false}
            compact
            enriched={investmentHoldings}
            locale={locale}
            sourceMap={sourceMap}
            t={t}
            onDelete={() => undefined}
            onEdit={onEdit}
          />
        </section>

        <div className="space-y-5">
          <section className="glass-panel apple-card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-2">
              <PieIcon size={20} style={{ color: "var(--accent)" }} />
              <h3 className="text-xl font-semibold text-ink">{t.assetMix}</h3>
            </div>
            <ChartPanel data={assetMix.map((item) => ({ ...item, name: t[item.name as AssetType] }))} />
          </section>

          <DayMoversPanel holdings={investmentHoldings} locale={locale} totals={totals} />
        </div>
      </div>

      <section className="glass-panel apple-card p-5 sm:p-6">
        <div className="mb-5">
          <h3 className="text-xl font-semibold text-ink">{t.bankCash}</h3>
          <p className="mt-1 text-sm text-titanium">{cashHoldings.length}</p>
        </div>
        <HoldingsTable
          allowEdit={false}
          cashOnly
          compact
          enriched={cashHoldings}
          locale={locale}
          sourceMap={sourceMap}
          t={t}
          onDelete={() => undefined}
          onEdit={onEdit}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <RankPanel title={t.leaders} holdings={leaders} t={t} />
        <RankPanel title={t.laggards} holdings={laggards} t={t} />
      </div>

      <HoldingsNews holdings={enriched} locale={locale} />
    </div>
  );
}

function DayMoversPanel({
  holdings,
  locale,
  totals,
}: {
  holdings: EnrichedHolding[];
  locale: Locale;
  totals: ReturnType<typeof getPortfolioTotals>;
}) {
  const money = useMoney();
  const movers = [...holdings]
    .filter((holding) => holding.asset_type !== "cash" && holding.quote && Math.abs(holding.dayChangeUsd) > 0.005)
    .sort((a, b) => b.dayChangeUsd - a.dayChangeUsd)
    .slice(0, 8);
  const maxAbs = Math.max(...movers.map((holding) => Math.abs(holding.dayChangeUsd)), 1);
  const totalPositive = totals.dayChange >= 0;

  return (
    <section className="glass-panel apple-card p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Activity size={20} style={{ color: "var(--accent)" }} />
        <h3 className="text-xl font-semibold text-ink">{tx(locale, "Today's movers")}</h3>
      </div>
      <p className="mb-5 text-sm text-titanium">
        {tx(locale, "What moved your portfolio today (USD)")}
      </p>
      {movers.length ? (
        <>
          <div className="space-y-2.5">
            {movers.map((holding) => {
              const positive = holding.dayChangeUsd >= 0;
              const width = Math.max((Math.abs(holding.dayChangeUsd) / maxAbs) * 50, 1.5);
              return (
                <div className="grid grid-cols-[76px_minmax(0,1fr)_92px] items-center gap-3 text-sm" key={holding.id}>
                  <span className="truncate font-medium text-ink" title={holding.name}>{holding.symbol}</span>
                  <div className="relative h-3.5">
                    <span className="absolute bottom-[-3px] left-1/2 top-[-3px] w-px bg-line" />
                    <span
                      className={clsx(
                        "absolute inset-y-0",
                        positive ? "left-1/2 rounded-r bg-mint" : "right-1/2 rounded-l bg-rose",
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className={clsx("text-right tabular-nums", positive ? "text-mint" : "text-rose")}>
                    {positive ? "+" : ""}
                    {money.fmtUsd(holding.dayChangeUsd)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-line pt-3">
            <span className="text-sm text-titanium">{tx(locale, "Total today")}</span>
            <span className={clsx("font-semibold tabular-nums", totalPositive ? "text-mint" : "text-rose")}>
              {totalPositive ? "+" : ""}
              {money.fmtUsd(totals.dayChange)} · {formatPercent(totals.dayChangePercent)}
            </span>
          </div>
        </>
      ) : (
        <p className="subtle-panel apple-card-sm p-4 text-sm text-titanium">
          {tx(locale, "No intraday change data to show yet.")}
        </p>
      )}
    </section>
  );
}

function QuantitiesView({
  enriched,
  locale,
  t,
}: {
  enriched: EnrichedHolding[];
  locale: Locale;
  t: ReturnType<typeof getDictionary>;
}) {
  return <HoldingQuantitySummary enriched={enriched} locale={locale} t={t} />;
}

function ChartsView({
  debts,
  enriched,
  locale,
  recurringExpenses,
  totals,
  transactions,
  twdToUsd,
}: {
  debts: Debt[];
  enriched: EnrichedHolding[];
  locale: Locale;
  recurringExpenses: RecurringExpense[];
  totals: ReturnType<typeof getPortfolioTotals>;
  transactions: CashflowTransaction[];
  twdToUsd: CurrencyFxInput;
}) {
  const zh = locale === "zh";
  const monthlyCashflow = useMemo(() => getMonthlyCashflowChartData(transactions, twdToUsd, locale), [locale, transactions, twdToUsd]);
  const expenseCategoryData = useMemo(() => getExpenseCategoryChartData(transactions, twdToUsd, locale), [locale, transactions, twdToUsd]);
  const fixedExpenseTrend = useMemo(() => getFixedExpenseTrendData(recurringExpenses, twdToUsd, locale), [locale, recurringExpenses, twdToUsd]);
  const subscriptionAnnualized = useMemo(() => getSubscriptionAnnualizedData(recurringExpenses, twdToUsd), [recurringExpenses, twdToUsd]);
  const debtDecline = useMemo(() => getDebtDeclineData(debts, twdToUsd, locale), [debts, locale, twdToUsd]);
  const netWorthTrend = useMemo(() => getNetWorthTrendData(transactions, totals.totalValue - getDebtPrincipalUsd(debts, twdToUsd), twdToUsd, locale), [debts, locale, totals.totalValue, transactions, twdToUsd]);

  return (
    <div className="space-y-5">
      <section className="glass-panel apple-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-titanium">{tx(locale, "Visual overview of cashflow, recurring costs, debt, and portfolio data")}</p>
            <h3 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-ink">{tx(locale, "Charts")}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-titanium">
              {zh
                ? "圖表使用目前已輸入的資料與現有匯率換算成 USD。淨資產趨勢是依記帳現金流回推的估算，不是完整歷史價格快照。"
                : "Charts use your current data and FX rate normalized to USD. Net worth trend is cashflow-based estimated history, not a full historical price snapshot."}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-titanium">
            {zh ? `${enriched.length} 筆資產資料` : `${enriched.length} holding rows`}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title={tx(locale, "Monthly income vs expense")} subtitle={tx(locale, "Grouped by transaction date for the last 6 months.")} isEmpty={!monthlyCashflow.some((item) => item.income || item.expense)}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyCashflow}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => compactUsd(Number(value))} tickLine={false} axisLine={false} width={54} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="income" name={tx(locale, "Income")} fill="rgb(var(--mint))" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expense" name={tx(locale, "Expense")} fill="rgb(var(--rose))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={tx(locale, "Expense category pie")} subtitle={tx(locale, "Shows this month's expense mix by category.")} isEmpty={!expenseCategoryData.length}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={expenseCategoryData} dataKey="value" innerRadius={62} outerRadius={106} paddingAngle={4}>
                {expenseCategoryData.map((entry, index) => (
                  <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip content={<MoneyTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <ChartLegend data={expenseCategoryData} />
        </ChartCard>

        <ChartCard title={tx(locale, "Fixed expense trend")} subtitle={tx(locale, "Estimated for the next 6 months from active recurring expenses.")} isEmpty={!fixedExpenseTrend.some((item) => item.value)}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={fixedExpenseTrend}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => compactUsd(Number(value))} tickLine={false} axisLine={false} width={54} />
              <Tooltip content={<MoneyTooltip />} />
              <Line type="monotone" dataKey="value" name={tx(locale, "Fixed expenses")} stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={tx(locale, "Subscription annualized cost")} subtitle={tx(locale, "Monthly and yearly subscriptions converted to annual cost.")} isEmpty={!subscriptionAnnualized.length}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={subscriptionAnnualized} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => compactUsd(Number(value))} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={110} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="value" name={tx(locale, "Annualized cost")} fill="var(--accent)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={tx(locale, "Debt decline curve")} subtitle={tx(locale, "12-month estimate from current principal and minimum payments, excluding interest changes.")} isEmpty={!debtDecline.some((item) => item.value)}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={debtDecline}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => compactUsd(Number(value))} tickLine={false} axisLine={false} width={54} />
              <Tooltip content={<MoneyTooltip />} />
              <Line type="monotone" dataKey="value" name={tx(locale, "Remaining debt")} stroke="rgb(var(--rose))" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={tx(locale, "Net worth trend")} subtitle={tx(locale, "Estimated from current net worth and the last 6 months of recorded cashflow.")} isEmpty={!netWorthTrend.some((item) => item.value)}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={netWorthTrend}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => compactUsd(Number(value))} tickLine={false} axisLine={false} width={54} />
              <Tooltip content={<MoneyTooltip />} />
              <Line type="monotone" dataKey="value" name={tx(locale, "Estimated net worth")} stroke="rgb(var(--mint))" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  children,
  isEmpty,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  isEmpty: boolean;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="glass-panel apple-card p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-titanium">{subtitle}</p>
      </div>
      {isEmpty ? (
        <div className="subtle-panel apple-card-sm flex h-[280px] items-center justify-center p-6 text-center text-sm text-titanium">
          No data yet
        </div>
      ) : children}
    </section>
  );
}

function FinancialHealthView({
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
  twdToUsd: CurrencyFxInput;
}) {
  const money = useMoney();
  const zh = locale === "zh";
  const monthTransactions = transactions.filter((transaction) => isSameMonth(transaction.transaction_date));
  const activeRecurringExpenses = recurringExpenses.filter((expense) => expense.is_active);
  const activeDebts = debts.filter((debt) => debt.is_active);
  const monthlyOverview = getMonthlyCashflowOverview(monthTransactions, activeRecurringExpenses, activeDebts);
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentBudgets = budgets.filter((budget) => budget.month.slice(0, 7) === currentMonthKey);
  const budgetRows = getBudgetRows(currentBudgets, monthTransactions, locale);
  const overBudgetRows = budgetRows.filter((row) => row.remaining < 0);
  const subscriptionsToReview = activeRecurringExpenses.filter(
    (expense) => expense.is_subscription && (expense.usage_status === "rarely_used" || expense.usage_status === "consider_canceling"),
  );
  const unknownCostCount = enriched.filter((holding) => holding.cost_known === false).length;
  const missingPriceCount = enriched.filter((holding) => holding.asset_type !== "cash" && !holding.quote).length;

  const incomeUsd = currencyBucketsToUsd(monthlyOverview.income, twdToUsd);
  const fixedUsd = currencyBucketsToUsd(monthlyOverview.recurring, twdToUsd) + currencyBucketsToUsd(monthlyOverview.debtPayments, twdToUsd);
  const leftoverUsd = currencyBucketsToUsd(monthlyOverview.leftover, twdToUsd);
  const debtPaymentUsd = currencyBucketsToUsd(monthlyOverview.debtPayments, twdToUsd);
  const debtPrincipalUsd = activeDebts.reduce((sum, debt) => sum + currencyAmountToUsd(debt.remaining_principal, debt.currency, twdToUsd), 0);
  const netWorthUsd = totals.totalValue - debtPrincipalUsd;
  const savingsRate = incomeUsd > 0 ? (leftoverUsd / incomeUsd) * 100 : null;
  const fixedPressure = incomeUsd > 0 ? (fixedUsd / incomeUsd) * 100 : null;
  const debtIncomeRatio = incomeUsd > 0 ? (debtPaymentUsd / incomeUsd) * 100 : null;
  const dataIssues = unknownCostCount + missingPriceCount;
  const notes = buildFinancialHealthNotes({
    dataIssues,
    debtIncomeRatio,
    fixedPressure,
    incomeUsd,
    locale,
    overBudgetCount: overBudgetRows.length,
    savingsRate,
    subscriptionsToReviewCount: subscriptionsToReview.length,
    unknownCostCount,
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label={tx(locale, "Net worth")} value={money.fmtUsd(netWorthUsd)} trend={netWorthUsd} info={tx(locale, "Portfolio value minus debt")} icon={<CircleDollarSign size={20} />} />
        <MetricCard label={tx(locale, "Savings rate")} value={formatHealthRatio(savingsRate)} trend={savingsRate ?? undefined} info={tx(locale, "Leftover divided by income")} icon={<BarChart3 size={20} />} />
        <MetricCard label={tx(locale, "Fixed pressure")} value={formatHealthRatio(fixedPressure)} trend={fixedPressure === null ? undefined : -fixedPressure} info={tx(locale, "Recurring plus debt minimums")} icon={<RefreshCw size={20} />} />
        <MetricCard label={tx(locale, "Debt-to-income")} value={formatHealthRatio(debtIncomeRatio)} trend={debtIncomeRatio === null ? undefined : -debtIncomeRatio} info={tx(locale, "Debt minimums divided by income")} icon={<Activity size={20} />} />
        <MetricCard label={tx(locale, "Total debt")} value={money.fmtUsd(debtPrincipalUsd)} trend={debtPrincipalUsd ? -debtPrincipalUsd : undefined} info={activeDebts.length ? (zh ? `${activeDebts.length} 筆啟用債務` : `${activeDebts.length} active debts`) : (tx(locale, "No active debts"))} icon={<ReceiptText size={20} />} />
        <MetricCard label={tx(locale, "Data quality")} value={dataIssues ? `${dataIssues}` : (tx(locale, "Good"))} trend={dataIssues ? -dataIssues : 1} info={tx(locale, "Unknown cost or missing price count")} icon={<ShieldCheck size={20} />} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel apple-card p-5 sm:p-6">
          <h3 className="text-xl font-semibold text-ink">{tx(locale, "Health notes")}</h3>
          <div className="mt-4 space-y-3">
            {notes.map((note) => (
              <div key={note} className="subtle-panel apple-card-sm flex gap-3 p-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <p className="text-sm leading-6 text-ink">{note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel apple-card p-5 sm:p-6">
          <h3 className="text-xl font-semibold text-ink">{tx(locale, "Current inputs")}</h3>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-panel/70">
            <HealthRow label={tx(locale, "Portfolio value")} value={money.fmtUsd(totals.totalValue)} />
            <HealthRow label={tx(locale, "Outstanding debt")} value={money.fmtUsd(debtPrincipalUsd)} />
            <HealthRow label={tx(locale, "Monthly income")} value={money.fmtUsd(incomeUsd)} />
            <HealthRow label={tx(locale, "Estimated leftover")} value={money.fmtUsd(leftoverUsd)} />
            <HealthRow label={tx(locale, "Over-budget categories")} value={`${overBudgetRows.length}`} />
            <HealthRow label={tx(locale, "Subscriptions to review")} value={`${subscriptionsToReview.length}`} />
          </div>
        </section>
      </div>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-titanium">{label}</span>
      <span className="text-right text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

function CashflowCalendar({
  events,
  locale,
  onSelectDate,
  selectedDate,
}: {
  events: CashflowCalendarEvent[];
  locale: Locale;
  onSelectDate: (date: string) => void;
  selectedDate: string;
}) {
  const zh = locale === "zh";
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState<"all" | "transactions" | "recurring" | "debt">("all");
  const todayKey = new Date().toISOString().slice(0, 10);
  const selected = parseDateOnly(selectedDate);
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthLabel = monthStart.toLocaleDateString(locale === "zh" ? "zh-TW" : "en-US", { month: "long", year: "numeric" });
  const days = getCalendarDays(selectedDate);
  const filteredEvents = events.filter((event) => {
    if (eventFilter === "all") return true;
    if (eventFilter === "transactions") return event.kind === "income" || event.kind === "expense";
    return event.kind === eventFilter;
  });
  const eventsByDate = filteredEvents.reduce<Map<string, CashflowCalendarEvent[]>>((acc, event) => {
    acc.set(event.date, [...(acc.get(event.date) ?? []), event]);
    return acc;
  }, new Map());
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const weekdayLabels = zh ? ["日", "一", "二", "三", "四", "五", "六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const yearOptions = getCalendarYearOptions(selected.getFullYear());
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    label: new Date(selected.getFullYear(), index, 1).toLocaleDateString(locale === "zh" ? "zh-TW" : "en-US", { month: "long" }),
    value: index,
  }));

  function changeMonth(offset: number) {
    const next = new Date(selected.getFullYear(), selected.getMonth() + offset, 1);
    onSelectDate(toDateKey(next));
  }

  function changeCalendarMonth(nextYear: number, nextMonth: number) {
    onSelectDate(toDateKey(new Date(nextYear, nextMonth, 1)));
  }

  return (
    <section className="glass-panel apple-card p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} style={{ color: "var(--accent)" }} />
          <div>
            <h3 className="text-xl font-semibold text-ink">{tx(locale, "Calendar")}</h3>
            <p className="mt-1 text-sm text-titanium">{tx(locale, "Income, expenses, recurring charges, and debt payments.")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="focus-ring rounded-full border border-line px-3 py-2 text-sm text-titanium hover:text-ink" onClick={() => changeMonth(-1)} type="button">
            {tx(locale, "Prev")}
          </button>
          <div className="relative">
            <button
              className="focus-ring min-w-[130px] rounded-full px-3 py-2 text-center text-sm font-semibold text-ink transition hover:bg-white/10"
              onClick={() => setMonthPickerOpen((current) => !current)}
              type="button"
            >
              {monthLabel}
            </button>
            {monthPickerOpen && (
              <div className="glass-panel apple-card-sm absolute right-0 z-20 mt-2 w-64 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label={tx(locale, "Year")}>
                    <select
                      className="input-control focus-ring w-full px-3 text-ink"
                      value={selected.getFullYear()}
                      onChange={(event) => changeCalendarMonth(Number(event.target.value), selected.getMonth())}
                    >
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={tx(locale, "Month")}>
                    <select
                      className="input-control focus-ring w-full px-3 text-ink"
                      value={selected.getMonth()}
                      onChange={(event) => changeCalendarMonth(selected.getFullYear(), Number(event.target.value))}
                    >
                      {monthOptions.map((month) => (
                        <option key={month.value} value={month.value}>{month.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <button
                  className="focus-ring mt-3 w-full rounded-full border border-line px-3 py-2 text-sm text-titanium hover:text-ink"
                  onClick={() => setMonthPickerOpen(false)}
                  type="button"
                >
                  {tx(locale, "Done")}
                </button>
              </div>
            )}
          </div>
          <button className="focus-ring rounded-full border border-line px-3 py-2 text-sm text-titanium hover:text-ink" onClick={() => changeMonth(1)} type="button">
            {tx(locale, "Next")}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-full border border-line bg-panel/70 p-1 md:inline-grid md:grid-cols-4">
        {[
          { id: "all", label: tx(locale, "All") },
          { id: "transactions", label: tx(locale, "Income / Expense") },
          { id: "recurring", label: tx(locale, "Recurring") },
          { id: "debt", label: tx(locale, "Debt") },
        ].map((filter) => (
          <button
            className={clsx(
              "focus-ring min-h-10 rounded-full px-3 text-sm font-medium transition",
              eventFilter === filter.id ? "primary-button" : "text-titanium hover:text-ink",
            )}
            key={filter.id}
            onClick={() => setEventFilter(filter.id as typeof eventFilter)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">
        <div>
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-titanium">
            {weekdayLabels.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = toDateKey(day);
              const dayEvents = eventsByDate.get(key) ?? [];
              const isCurrentMonth = day.getMonth() === selected.getMonth();
              const isSelected = key === selectedDate;
              const isTodayDate = key === todayKey;
              return (
                <button
                  className={clsx(
                    "focus-ring min-h-[76px] rounded-2xl border p-2 text-left transition",
                    isSelected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line bg-panel/55 hover:bg-white/10",
                    !isCurrentMonth && "opacity-45",
                  )}
                  key={key}
                  onClick={() => onSelectDate(key)}
                  type="button"
                >
                  <span className={clsx("inline-flex h-7 min-w-7 items-center justify-center rounded-full text-sm font-medium", isTodayDate ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-ink")}>
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dayEvents.slice(0, 4).map((event, index) => (
                        <span className={clsx("h-1.5 w-1.5 rounded-full", calendarEventDotClass(event.kind))} key={`${event.kind}-${event.title}-${index}`} />
                      ))}
                      {dayEvents.length > 4 && <span className="text-[10px] leading-none text-titanium">+{dayEvents.length - 4}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="subtle-panel apple-card-sm p-4">
          <p className="text-sm font-semibold text-ink">{formatDateOnly(selectedDate, locale)}</p>
          <div className="mt-4 space-y-3">
            {!selectedEvents.length ? (
              <p className="rounded-2xl border border-line bg-panel/70 p-4 text-sm text-titanium">{tx(locale, "No records or payment reminders for this day in the current filter.")}</p>
            ) : (
              selectedEvents.map((event, index) => (
                <div className="rounded-2xl border border-line bg-panel/70 p-3" key={`${event.kind}-${event.title}-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{event.title}</p>
                      <p className="mt-1 text-xs text-titanium">{event.label}</p>
                    </div>
                    <span className={clsx("shrink-0 text-sm font-semibold", calendarEventTextClass(event.kind))}>{event.amount}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-titanium">
            <CalendarLegendDot className="bg-mint" label={tx(locale, "Income")} />
            <CalendarLegendDot className="bg-rose" label={tx(locale, "Expense")} />
            <CalendarLegendDot className="bg-[var(--accent)]" label={tx(locale, "Recurring")} />
            <CalendarLegendDot className="bg-titanium" label={tx(locale, "Debt")} />
          </div>
        </aside>
      </div>
    </section>
  );
}

function CalendarLegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={clsx("h-2 w-2 rounded-full", className)} />
      {label}
    </span>
  );
}

function BrandIcon({ name }: { name: string }) {
  const brand = getBrandIconConfig(name);

  return (
    <span
      aria-hidden="true"
      className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm", brand.className)}
      title={brand.label}
    >
      {brand.kind === "text" ? (
        <span className="text-sm font-bold">{brand.text}</span>
      ) : brand.kind === "music" ? (
        <Music size={18} />
      ) : brand.kind === "play" ? (
        <Play size={18} fill="currentColor" />
      ) : (
        <CreditCard size={18} />
      )}
    </span>
  );
}

function getBrandIconConfig(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("spotify")) return { className: "bg-[#1DB954]", kind: "music" as const, label: "Spotify" };
  if (normalized.includes("youtube") || normalized.includes("yt ")) return { className: "bg-[#FF0000]", kind: "play" as const, label: "YouTube" };
  if (normalized.includes("netflix")) return { className: "bg-[#E50914]", kind: "text" as const, label: "Netflix", text: "N" };
  if (normalized.includes("apple")) return { className: "bg-[#111827]", kind: "text" as const, label: "Apple", text: "A" };
  if (normalized.includes("google")) return { className: "bg-[#4285F4]", kind: "text" as const, label: "Google", text: "G" };
  if (normalized.includes("amazon") || normalized.includes("prime")) return { className: "bg-[#232F3E]", kind: "text" as const, label: "Amazon", text: "a" };
  if (normalized.includes("disney")) return { className: "bg-[#113CCF]", kind: "text" as const, label: "Disney", text: "D" };
  if (normalized.includes("openai") || normalized.includes("chatgpt")) return { className: "bg-[#111827]", kind: "text" as const, label: "OpenAI", text: "AI" };
  if (normalized.includes("notion")) return { className: "bg-[#111827]", kind: "text" as const, label: "Notion", text: "N" };
  if (normalized.includes("adobe")) return { className: "bg-[#FA0F00]", kind: "text" as const, label: "Adobe", text: "A" };
  return { className: "bg-titanium", kind: "generic" as const, label: "Subscription" };
}

function ExpandedListModal({
  children,
  onClose,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <section className="glass-panel apple-card flex max-h-[86vh] w-full max-w-4xl flex-col p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{title}</h3>
            <p className="mt-1 text-sm text-titanium">{subtitle}</p>
          </div>
          <button
            aria-label="Close"
            className="focus-ring rounded-full border border-line p-2 text-titanium transition hover:bg-white/10 hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {children}
        </div>
      </section>
    </div>
  );
}

function CashflowView({
  assetValue,
  cashValue,
  budgetEditingId,
  budgetForm,
  budgets,
  debtEditingId,
  debtForm,
  debts,
  editingId,
  form,
  locale,
  recurringEditingId,
  recurringExpenses,
  recurringForm,
  transactions,
  onDelete,
  onDeleteBudget,
  onDeleteDebt,
  onEdit,
  onEditBudget,
  onEditDebt,
  onDeleteRecurring,
  onEditRecurring,
  onReset,
  onResetBudget,
  onResetDebt,
  onResetRecurring,
  onSave,
  onSaveBudget,
  onSaveDebt,
  onSaveRecurring,
  onUpdateBudgetForm,
  onUpdateDebtForm,
  onUpdateForm,
  onUpdateRecurringForm,
}: {
  assetValue: number;
  cashValue: number;
  budgetEditingId: string | null;
  budgetForm: MonthlyBudgetInput;
  budgets: MonthlyBudget[];
  debtEditingId: string | null;
  debtForm: DebtInput;
  debts: Debt[];
  editingId: string | null;
  form: CashflowTransactionInput;
  locale: Locale;
  recurringEditingId: string | null;
  recurringExpenses: RecurringExpense[];
  recurringForm: RecurringExpenseInput;
  transactions: CashflowTransaction[];
  onDelete: (id: string) => void;
  onDeleteBudget: (id: string) => void;
  onDeleteDebt: (id: string) => void;
  onEdit: (transaction: CashflowTransaction) => void;
  onEditBudget: (budget: MonthlyBudget) => void;
  onEditDebt: (debt: Debt) => void;
  onDeleteRecurring: (id: string) => void;
  onEditRecurring: (expense: RecurringExpense) => void;
  onReset: () => void;
  onResetBudget: () => void;
  onResetDebt: () => void;
  onResetRecurring: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveBudget: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveDebt: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveRecurring: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdateBudgetForm: <K extends keyof MonthlyBudgetInput>(key: K, value: MonthlyBudgetInput[K]) => void;
  onUpdateDebtForm: <K extends keyof DebtInput>(key: K, value: DebtInput[K]) => void;
  onUpdateForm: <K extends keyof CashflowTransactionInput>(key: K, value: CashflowTransactionInput[K]) => void;
  onUpdateRecurringForm: <K extends keyof RecurringExpenseInput>(key: K, value: RecurringExpenseInput[K]) => void;
}) {
  const money = useMoney();
  const zh = locale === "zh";
  const [cashflowMode, setCashflowMode] = useState<"transactions" | "recurring" | "debts" | "budgets" | "flow">("transactions");
  const [overviewMode, setOverviewMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date().toISOString().slice(0, 10));
  const [expandedList, setExpandedList] = useState<"transactions" | "recurring" | "debts" | null>(null);
  const [transactionHistoryFilter, setTransactionHistoryFilter] = useState<"all" | "income" | "expense" | "today">("all");
  const monthTransactions = transactions.filter((transaction) => isSameMonth(transaction.transaction_date));
  const selectedMonthKey = selectedCalendarDate.slice(0, 7);
  const selectedMonthTransactions = transactions.filter((transaction) => transaction.transaction_date.slice(0, 7) === selectedMonthKey);
  const filteredSelectedMonthTransactions = selectedMonthTransactions.filter((transaction) => {
    if (transactionHistoryFilter === "all") return true;
    if (transactionHistoryFilter === "today") {
      return transaction.transaction_type === "expense" && isToday(transaction.transaction_date);
    }
    return transaction.transaction_type === transactionHistoryFilter;
  });
  const selectedMonthLabel = formatMonthYearKey(selectedMonthKey, locale);
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentBudgets = budgets.filter((budget) => budget.month.slice(0, 7) === currentMonthKey);
  const budgetRows = getBudgetRows(currentBudgets, monthTransactions, locale);
  const totalBudgetRows = budgetRows.filter((row) => row.budget.category === totalBudgetCategory);
  const categoryBudgetRows = budgetRows.filter((row) => row.budget.category !== totalBudgetCategory);
  const summaryBudgetRows = totalBudgetRows.length ? totalBudgetRows : categoryBudgetRows;
  const overBudgetRows = budgetRows.filter((row) => row.remaining < 0);
  const activeRecurringExpenses = recurringExpenses.filter((expense) => expense.is_active);
  const activeSubscriptions = activeRecurringExpenses.filter((expense) => expense.is_subscription);
  const subscriptionsToReview = activeSubscriptions.filter((expense) => expense.usage_status === "rarely_used" || expense.usage_status === "consider_canceling");
  const upcomingRecurringExpenses = [...activeRecurringExpenses]
    .sort((a, b) => parseDateOnly(a.next_due_date).getTime() - parseDateOnly(b.next_due_date).getTime())
    .slice(0, 5);
  const upcomingSubscriptionAlerts = activeSubscriptions
    .filter((expense) => daysUntil(expense.next_due_date) <= (expense.reminder_days ?? 3))
    .sort((a, b) => parseDateOnly(a.next_due_date).getTime() - parseDateOnly(b.next_due_date).getTime())
    .slice(0, 5);
  const todayExpenses = transactions.filter((transaction) => transaction.transaction_type === "expense" && isToday(transaction.transaction_date));
  const todayTotal = formatCashflowTotals(todayExpenses, "expense", money);
  const netTotal = formatNetCashflow(monthTransactions, money);
  const recurringMonthlyTotal = formatRecurringMonthlyTotal(activeRecurringExpenses, money);
  const subscriptionAnnualTotal = formatRecurringAnnualTotal(activeSubscriptions, money);
  const activeDebts = debts.filter((debt) => debt.is_active);
  const totalDebtPrincipal = formatDebtPrincipalTotal(activeDebts, money);
  const totalDebtMonthlyPayment = formatDebtMonthlyPaymentTotal(activeDebts, money);
  const highestInterestDebt = [...activeDebts].sort((a, b) => b.interest_rate - a.interest_rate)[0] ?? null;
  const upcomingDebtPayments = [...activeDebts]
    .sort((a, b) => parseDateOnly(a.next_payment_date).getTime() - parseDateOnly(b.next_payment_date).getTime())
    .slice(0, 5);
  const monthlyOverview = getMonthlyCashflowOverview(monthTransactions, activeRecurringExpenses, activeDebts);
  const yearlyOverview = getYearlyCashflowOverview(transactions, activeRecurringExpenses, activeDebts);
  const overview = overviewMode === "monthly" ? monthlyOverview : yearlyOverview;
  const overviewPeriodLabel = overviewMode === "monthly"
    ? new Date().toLocaleDateString(locale === "zh" ? "zh-TW" : "en-US", { month: "long", year: "numeric" })
    : String(new Date().getFullYear());
  const calendarEvents = useMemo(
    () => getCashflowCalendarEvents(transactions, activeRecurringExpenses, activeDebts, locale, money),
    [activeDebts, activeRecurringExpenses, locale, money, transactions],
  );
  const categoryOptions = cashflowCategories[form.transaction_type];
  const transactionHistoryTitle = transactionHistoryFilter === "income"
    ? (tx(locale, "Monthly income details"))
    : transactionHistoryFilter === "expense"
      ? (tx(locale, "Monthly expense details"))
      : transactionHistoryFilter === "today"
        ? (tx(locale, "Today's expense details"))
        : (tx(locale, "Income / Expense History"));
  const transactionHistoryPeriod = transactionHistoryFilter === "today"
    ? formatDateOnly(new Date().toISOString().slice(0, 10), locale)
    : selectedMonthLabel;

  function changeSelectedHistoryMonth(offset: number) {
    const selected = parseDateOnly(selectedCalendarDate);
    const next = new Date(selected.getFullYear(), selected.getMonth() + offset, 1);
    setSelectedCalendarDate(toDateKey(next));
    if (transactionHistoryFilter === "today") setTransactionHistoryFilter("expense");
  }

  function openTransactionHistory(filter: "all" | "income" | "expense" | "today") {
    setSelectedCalendarDate(new Date().toISOString().slice(0, 10));
    setTransactionHistoryFilter(filter);
    setExpandedList("transactions");
  }

  return (
    <div className="space-y-5">
      <section className="glass-panel apple-card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{overviewMode === "monthly" ? (tx(locale, "Monthly cashflow overview")) : (tx(locale, "Yearly cashflow overview"))}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="focus-ring h-9 rounded-full border border-line bg-panel px-3 pr-8 text-sm text-ink"
              value={overviewMode}
              onChange={(event) => setOverviewMode(event.target.value as "monthly" | "yearly")}
            >
              <option value="monthly">{tx(locale, "Monthly cashflow overview")}</option>
              <option value="yearly">{tx(locale, "Yearly cashflow overview")}</option>
            </select>
            <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-titanium">
              {overviewPeriodLabel}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            actionLabel={overviewMode === "monthly" ? (tx(locale, "View monthly income details")) : undefined}
            icon={<ReceiptText size={20} />}
            label={overviewMode === "monthly" ? (tx(locale, "Monthly income")) : (tx(locale, "Yearly income"))}
            onClick={overviewMode === "monthly" ? () => openTransactionHistory("income") : undefined}
            trend={1}
            value={formatCurrencyBuckets(money, overview.income)}
          />
          <MetricCard
            actionLabel={overviewMode === "monthly" ? (tx(locale, "View monthly expense details")) : undefined}
            icon={<ReceiptText size={20} />}
            label={overviewMode === "monthly" ? (tx(locale, "Monthly expenses")) : (tx(locale, "Yearly expenses"))}
            onClick={overviewMode === "monthly" ? () => openTransactionHistory("expense") : undefined}
            trend={-1}
            value={formatCurrencyBuckets(money, overview.expenses)}
          />
          <MetricCard
            actionLabel={tx(locale, "View recurring expense details")}
            icon={<RefreshCw size={20} />}
            label={overviewMode === "monthly" ? (tx(locale, "Recurring")) : (tx(locale, "Annualized recurring"))}
            onClick={() => setExpandedList("recurring")}
            trend={hasCurrencyValue(overview.recurring) ? -1 : undefined}
            value={formatCurrencyBuckets(money, overview.recurring)}
          />
          <MetricCard
            actionLabel={tx(locale, "View loan and debt details")}
            icon={<Activity size={20} />}
            label={overviewMode === "monthly" ? (tx(locale, "Debt minimums")) : (tx(locale, "Annualized debt minimums"))}
            onClick={() => setExpandedList("debts")}
            trend={hasCurrencyValue(overview.debtPayments) ? -1 : undefined}
            value={formatCurrencyBuckets(money, overview.debtPayments)}
          />
          <MetricCard label={tx(locale, "Estimated leftover")} value={formatCurrencyBuckets(money, overview.leftover)} trend={currencyBucketTotal(overview.leftover)} icon={<CircleDollarSign size={20} />} />
          <MetricCard label={tx(locale, "Fixed pressure")} value={formatPressureRatio(overview)} trend={-overview.pressureRatio} icon={<BarChart3 size={20} />} />
        </div>
      </section>

      <div className="cashflow-mode-switcher grid max-w-[920px] grid-cols-2 gap-1.5 rounded-[22px] border border-line bg-[var(--surface-muted)] p-1.5 sm:grid-cols-5 sm:gap-1 sm:rounded-full sm:p-1">
        {[
          { icon: <LineChartIcon size={17} />, id: "flow", label: financialCopy(locale).tab },
          { icon: <ReceiptText size={17} />, id: "transactions", label: tx(locale, "Income / Expense") },
          { icon: <RefreshCw size={17} />, id: "recurring", label: tx(locale, "Recurring / Subscriptions") },
          { icon: <Activity size={17} />, id: "debts", label: tx(locale, "Loans / Debt") },
          { icon: <BarChart3 size={17} />, id: "budgets", label: tx(locale, "Budgets") },
        ].map((item) => {
          const selected = cashflowMode === item.id;
          return (
            <button
              aria-pressed={selected}
              className={clsx(
                "focus-ring flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] border px-2.5 text-xs font-semibold transition sm:min-h-11 sm:rounded-full sm:border-transparent sm:px-4 sm:text-sm",
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm"
                  : "border-transparent bg-[var(--surface-raised)] text-titanium hover:text-ink sm:bg-transparent",
              )}
              key={item.id}
              onClick={() => setCashflowMode(item.id as typeof cashflowMode)}
              type="button"
            >
              <span className={clsx("shrink-0", selected ? "text-[var(--accent)]" : "text-titanium")}>{item.icon}</span>
              <span className="min-w-0 leading-4">{item.label}</span>
            </button>
          );
        })}
      </div>

      {cashflowMode === "flow" && <CashflowFlow transactions={transactions} debts={debts} assetValue={assetValue} cashValue={cashValue} locale={locale} />}

      {cashflowMode === "transactions" && (
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[440px_minmax(0,1fr)] 2xl:grid-cols-[470px_minmax(0,1fr)]">
        <section className="glass-panel apple-card self-start p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{editingId ? (tx(locale, "Edit record")) : (tx(locale, "Add income / expense"))}</h3>
            <p className="mt-1 text-sm text-titanium">{tx(locale, "Manual cashflow entry first; automation can come later.")}</p>
          </div>
          {editingId && (
            <button className="focus-ring rounded-full border border-line px-3 py-2 text-xs text-titanium hover:text-ink" onClick={onReset} type="button">
              {tx(locale, "Cancel edit")}
            </button>
          )}
        </div>

        <form className="space-y-4" onSubmit={onSave}>
          <div className="pill-panel grid grid-cols-2 p-1">
            <button
              className={clsx("focus-ring min-h-11 rounded-full text-sm font-medium", form.transaction_type === "expense" ? "primary-button" : "text-titanium hover:text-ink")}
              onClick={() => onUpdateForm("transaction_type", "expense")}
              type="button"
            >
              {tx(locale, "Expense")}
            </button>
            <button
              className={clsx("focus-ring min-h-11 rounded-full text-sm font-medium", form.transaction_type === "income" ? "primary-button" : "text-titanium hover:text-ink")}
              onClick={() => onUpdateForm("transaction_type", "income")}
              type="button"
            >
              {tx(locale, "Income")}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tx(locale, "Date")}>
              <input className="input-control focus-ring w-full px-3 text-ink" type="date" value={form.transaction_date} onChange={(event) => onUpdateForm("transaction_date", event.target.value)} required />
            </Field>
            <Field label={tx(locale, "Currency")}>
              <select className="input-control focus-ring w-full px-3 text-ink" value={form.currency} onChange={(event) => onUpdateForm("currency", event.target.value as Currency)}>
                {supportedCurrencies.map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={tx(locale, "Amount")}>
            <input
              className="input-control focus-ring w-full px-3 text-ink"
              inputMode="decimal"
              placeholder="0.00"
              type="text"
              value={form.amount}
              onBlur={() => {
                if (form.amount === "") onUpdateForm("amount", "0");
              }}
              onChange={(event) => {
                const next = sanitizeNumericInput(event.target.value, true);
                if (next !== null) onUpdateForm("amount", next);
              }}
              required
            />
          </Field>

          <Field label={tx(locale, "Category")}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
              {categoryOptions.map((category) => {
                const CategoryIcon = cashflowCategoryIcons[category.id as keyof typeof cashflowCategoryIcons] ?? Ellipsis;
                const active = form.category === category.id;
                return (
                  <button
                    aria-pressed={active}
                    className={clsx(
                      "focus-ring flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-xs font-medium transition duration-200 xl:min-h-[82px]",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink shadow-sm"
                        : "border-line bg-[var(--surface-muted)] text-titanium hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-panel hover:text-ink",
                    )}
                    key={category.id}
                    onClick={() => onUpdateForm("category", category.id)}
                    type="button"
                  >
                    <CategoryIcon className={active ? "text-[var(--accent)]" : ""} size={19} />
                    <span>{zh ? category.zh : category.en}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          {form.transaction_type === "expense" && <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tx(locale, "Description")}>
              <input
                className="input-control focus-ring w-full px-3 text-ink"
                placeholder={tx(locale, "e.g. Lunch, paycheck, Uber")}
                value={form.description}
                onChange={(event) => onUpdateForm("description", event.target.value)}
              />
            </Field>

            <Field label={tx(locale, "Payment method")}>
              <select
                className="input-control focus-ring w-full px-3 text-ink"
                value={form.payment_method}
                onChange={(event) => onUpdateForm("payment_method", event.target.value)}
              >
                <option value="">{tx(locale, "Select payment method")}</option>
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{zh ? method.zh : method.en}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={tx(locale, "Notes")}>
            <textarea
              className="input-control focus-ring min-h-24 w-full resize-none px-3 py-3 text-ink"
              placeholder={tx(locale, "Optional")}
              value={form.notes}
              onChange={(event) => onUpdateForm("notes", event.target.value)}
            />
          </Field>

          </>}

          <button className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium" type="submit">
            <Plus size={17} />
            {editingId ? (tx(locale, "Update record")) : (tx(locale, "Save record"))}
          </button>
        </form>
        </section>

        <section className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            actionLabel={tx(locale, "View all monthly transactions")}
            icon={<CircleDollarSign size={20} />}
            label={tx(locale, "Monthly net")}
            onClick={() => openTransactionHistory("all")}
            value={netTotal}
          />
          <MetricCard
            actionLabel={tx(locale, "View today's expense details")}
            icon={<Activity size={20} />}
            label={tx(locale, "Spent today")}
            onClick={() => openTransactionHistory("today")}
            trend={todayExpenses.length ? -1 : undefined}
            value={todayTotal}
          />
        </div>

        <CashflowCalendar
          events={calendarEvents}
          locale={locale}
          selectedDate={selectedCalendarDate}
          onSelectDate={setSelectedCalendarDate}
        />

        <section className="glass-panel apple-card self-start p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-ink">{tx(locale, "Monthly records")}</h3>
              <p className="mt-1 text-sm text-titanium">{zh ? `${selectedMonthLabel} 的收入與支出。` : `Income and expenses for ${selectedMonthLabel}.`}</p>
            </div>
            <button
              aria-label={tx(locale, "Expand monthly records")}
              className="focus-ring rounded-full border border-line p-2 text-titanium transition hover:bg-white/10 hover:text-ink"
              onClick={() => {
                setTransactionHistoryFilter("all");
                setExpandedList("transactions");
              }}
              type="button"
            >
              <Maximize2 size={17} />
            </button>
          </div>

          {!selectedMonthTransactions.length ? (
            <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
              {tx(locale, "There are no income or expense records for this month.")}
            </div>
          ) : (
            <div className="max-h-[430px] overflow-auto rounded-[18px] border border-line">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-[0.08em] text-titanium">
                  <tr>
                    <th className="px-4 py-3">{tx(locale, "Date")}</th>
                    <th className="px-4 py-3">{tx(locale, "Description")}</th>
                    <th className="px-4 py-3">{tx(locale, "Category")}</th>
                    <th className="px-4 py-3">{tx(locale, "Method")}</th>
                    <th className="px-4 py-3 text-right">{tx(locale, "Amount")}</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMonthTransactions.map((transaction) => (
                    <tr className="border-t border-line transition hover:bg-white/5" key={transaction.id}>
                      <td className="whitespace-nowrap px-4 py-4 text-titanium">{formatDateOnly(transaction.transaction_date, locale)}</td>
                      <td className="px-4 py-4">
                        <button className="text-left" onClick={() => onEdit(transaction)} type="button">
                          <span className="block font-semibold text-ink">{transaction.description}</span>
                          {transaction.notes && <span className="block max-w-[260px] truncate text-xs text-titanium">{transaction.notes}</span>}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-titanium">{getCategoryLabel(transaction.category, locale)}</td>
                      <td className="px-4 py-4 text-titanium">{getPaymentMethodLabel(transaction.payment_method, locale)}</td>
                      <td className={clsx("whitespace-nowrap px-4 py-4 text-right font-semibold", transaction.transaction_type === "income" ? "text-mint" : "text-rose")}>
                        {transaction.transaction_type === "income" ? "+" : "-"}{money.fmtAmountFull(transaction.amount, transaction.currency)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          aria-label={zh ? `刪除 ${transaction.description}` : `Delete ${transaction.description}`}
                          className="focus-ring rounded-xl border border-line p-2 text-titanium transition hover:bg-rose/10 hover:text-rose"
                          onClick={() => onDelete(transaction.id)}
                          type="button"
                        >
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </section>
      </div>
      )}

      {cashflowMode === "recurring" && (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <section className="glass-panel apple-card self-start p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{recurringEditingId ? (tx(locale, "Edit recurring expense")) : (tx(locale, "Add recurring expense / subscription"))}</h3>
              <p className="mt-1 text-sm text-titanium">{tx(locale, "For Netflix, phone bills, insurance, rent, and subscriptions. Manual first; automation later.")}</p>
            </div>
            {recurringEditingId && (
              <button className="focus-ring rounded-full border border-line px-3 py-2 text-xs text-titanium hover:text-ink" onClick={onResetRecurring} type="button">
                {tx(locale, "Cancel edit")}
              </button>
            )}
          </div>

          <form className="space-y-4" onSubmit={onSaveRecurring}>
            <Field label={tx(locale, "Name")}>
              <input
                className="input-control focus-ring w-full px-3 text-ink"
                placeholder={tx(locale, "e.g. Netflix, rent, insurance")}
                value={recurringForm.name}
                onChange={(event) => onUpdateRecurringForm("name", event.target.value)}
                required
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tx(locale, "Amount")}>
                <input
                  className="input-control focus-ring w-full px-3 text-ink"
                  inputMode="decimal"
                  placeholder="0.00"
                  type="text"
                  value={recurringForm.amount}
                  onBlur={() => {
                    if (recurringForm.amount === "") onUpdateRecurringForm("amount", "0");
                  }}
                  onChange={(event) => {
                    const next = sanitizeNumericInput(event.target.value, true);
                    if (next !== null) onUpdateRecurringForm("amount", next);
                  }}
                  required
                />
              </Field>
              <Field label={tx(locale, "Currency")}>
                <select className="input-control focus-ring w-full px-3 text-ink" value={recurringForm.currency} onChange={(event) => onUpdateRecurringForm("currency", event.target.value as Currency)}>
                  {supportedCurrencies.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tx(locale, "Frequency")}>
                <select className="input-control focus-ring w-full px-3 text-ink" value={recurringForm.frequency} onChange={(event) => onUpdateRecurringForm("frequency", event.target.value as RecurringExpenseInput["frequency"])}>
                  <option value="monthly">{tx(locale, "Monthly")}</option>
                  <option value="yearly">{tx(locale, "Yearly")}</option>
                </select>
              </Field>
              <Field label={tx(locale, "Next due date")}>
                <input className="input-control focus-ring w-full px-3 text-ink" type="date" value={recurringForm.next_due_date} onChange={(event) => onUpdateRecurringForm("next_due_date", event.target.value)} required />
              </Field>
            </div>

            <Field label={tx(locale, "Category")}>
              <select className="input-control focus-ring w-full px-3 text-ink" value={recurringForm.category} onChange={(event) => onUpdateRecurringForm("category", event.target.value)}>
                {recurringCategories.map((category) => (
                  <option key={category.id} value={category.id}>{zh ? category.zh : category.en}</option>
                ))}
              </select>
            </Field>

            <Field label={tx(locale, "Payment method")}>
              <select
                className="input-control focus-ring w-full px-3 text-ink"
                value={recurringForm.payment_method}
                onChange={(event) => onUpdateRecurringForm("payment_method", event.target.value)}
              >
                <option value="">{tx(locale, "Select payment method")}</option>
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{zh ? method.zh : method.en}</option>
                ))}
              </select>
            </Field>

            <label className="input-control flex items-center gap-3 px-3 text-sm text-ink">
              <input checked={recurringForm.is_active} onChange={(event) => onUpdateRecurringForm("is_active", event.target.checked)} type="checkbox" />
              {tx(locale, "Active / still billing")}
            </label>

            <label className="input-control flex items-center gap-3 px-3 text-sm text-ink">
              <input checked={recurringForm.is_subscription} onChange={(event) => onUpdateRecurringForm("is_subscription", event.target.checked)} type="checkbox" />
              {tx(locale, "This is a subscription")}
            </label>

            {recurringForm.is_subscription && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={tx(locale, "Usage status")}>
                  <select className="input-control focus-ring w-full px-3 text-ink" value={recurringForm.usage_status} onChange={(event) => onUpdateRecurringForm("usage_status", event.target.value as RecurringExpenseInput["usage_status"])}>
                    {subscriptionUsageStatuses.map((status) => (
                      <option key={status.id} value={status.id}>{zh ? status.zh : status.en}</option>
                    ))}
                  </select>
                </Field>
                <Field label={tx(locale, "Reminder days before charge")}>
                  <input
                    className="input-control focus-ring w-full px-3 text-ink"
                    inputMode="numeric"
                    placeholder="3"
                    type="text"
                    value={recurringForm.reminder_days}
                    onBlur={() => {
                      if (recurringForm.reminder_days === "") onUpdateRecurringForm("reminder_days", "0");
                    }}
                    onChange={(event) => {
                      const next = sanitizeNumericInput(event.target.value, false);
                      if (next !== null) onUpdateRecurringForm("reminder_days", next);
                    }}
                  />
                </Field>
              </div>
            )}

            <Field label={tx(locale, "Notes")}>
              <textarea
                className="input-control focus-ring min-h-24 w-full resize-none px-3 py-3 text-ink"
                placeholder={tx(locale, "Optional")}
                value={recurringForm.notes}
                onChange={(event) => onUpdateRecurringForm("notes", event.target.value)}
              />
            </Field>

            <button className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium" type="submit">
              <Plus size={17} />
              {recurringEditingId ? (tx(locale, "Update recurring expense")) : (tx(locale, "Save recurring expense"))}
            </button>
          </form>
        </section>

        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label={tx(locale, "Monthly recurring")} value={recurringMonthlyTotal} trend={activeRecurringExpenses.length ? -1 : undefined} icon={<ReceiptText size={20} />} />
            <MetricCard label={tx(locale, "Subscription annual cost")} value={subscriptionAnnualTotal} trend={activeSubscriptions.length ? -1 : undefined} icon={<ReceiptText size={20} />} />
            <MetricCard label={tx(locale, "Review candidates")} value={String(subscriptionsToReview.length)} trend={subscriptionsToReview.length ? -1 : undefined} icon={<ListChecks size={20} />} />
          </div>

          <section className="glass-panel apple-card p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">{tx(locale, "Recurring expenses and subscriptions")}</h3>
                <p className="mt-1 text-sm text-titanium">{tx(locale, "Sorted by next due date. Inactive items are kept but excluded from summaries.")}</p>
              </div>
              <button
                aria-label={tx(locale, "Expand recurring expenses and subscriptions")}
                className="focus-ring rounded-full border border-line p-2 text-titanium transition hover:bg-white/10 hover:text-ink"
                onClick={() => setExpandedList("recurring")}
                type="button"
              >
                <Maximize2 size={17} />
              </button>
            </div>

            {!recurringExpenses.length ? (
              <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
                {tx(locale, "Add your first recurring expense to track subscriptions and fixed bills.")}
              </div>
            ) : (
              <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-1">
                {recurringExpenses.map((expense) => (
                  <article className={clsx("subtle-panel apple-card-sm p-4", !expense.is_active && "opacity-60")} key={expense.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button className="flex min-w-0 items-start gap-3 text-left" onClick={() => onEditRecurring(expense)} type="button">
                        <BrandIcon name={expense.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink">{expense.name}</span>
                          <span className="mt-1 block text-xs text-titanium">
                            {getRecurringCategoryLabel(expense.category, locale)} · {expense.frequency === "monthly" ? (tx(locale, "Monthly")) : (tx(locale, "Yearly"))}
                          </span>
                          {expense.is_subscription && (
                            <span className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-xs text-titanium">
                              {getSubscriptionUsageLabel(expense.usage_status ?? "active", locale)}
                            </span>
                          )}
                        </span>
                      </button>
                      <div className="text-right">
                        <p className="font-semibold text-ink">{money.fmtAmountFull(expense.amount, expense.currency)}</p>
                        {expense.is_subscription && <p className="mt-1 text-xs text-titanium">{tx(locale, "Annual")}: {formatRecurringAnnualizedAmount(expense, money)}</p>}
                        <p className="mt-1 text-xs text-titanium">{tx(locale, "Next")}: {formatDateOnly(expense.next_due_date, locale)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-titanium">{getPaymentMethodLabel(expense.payment_method, locale)}</p>
                      <div className="flex items-center gap-2">
                        {expense.is_subscription && daysUntil(expense.next_due_date) <= (expense.reminder_days ?? 3) && (
                          <span className="rounded-full bg-amber/10 px-2.5 py-1 text-xs text-amber">{tx(locale, "Due soon")}</span>
                        )}
                        {!expense.is_active && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-titanium">{tx(locale, "Inactive")}</span>}
                        <button
                          aria-label={zh ? `刪除 ${expense.name}` : `Delete ${expense.name}`}
                          className="focus-ring rounded-xl border border-line p-2 text-titanium transition hover:bg-rose/10 hover:text-rose"
                          onClick={() => onDeleteRecurring(expense.id)}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {subscriptionsToReview.length > 0 && (
            <section className="glass-panel apple-card p-5">
              <h3 className="mb-4 text-xl font-semibold text-ink">{tx(locale, "Review or cancel candidates")}</h3>
              <div className="space-y-3">
                {subscriptionsToReview.map((expense) => (
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber/20 bg-amber/5 p-3 text-sm" key={expense.id}>
                    <div>
                      <p className="font-medium text-ink">{expense.name}</p>
                      <p className="text-xs text-titanium">{getSubscriptionUsageLabel(expense.usage_status ?? "active", locale)} · {formatRecurringAnnualizedAmount(expense, money)} / {tx(locale, "year")}</p>
                    </div>
                    <button className="focus-ring rounded-full border border-line px-3 py-2 text-xs text-titanium hover:text-ink" onClick={() => onEditRecurring(expense)} type="button">
                      {tx(locale, "Review")}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {upcomingSubscriptionAlerts.length > 0 && (
            <section className="glass-panel apple-card p-5">
              <h3 className="mb-4 text-xl font-semibold text-ink">{tx(locale, "Subscription charge reminders")}</h3>
              <div className="space-y-3">
                {upcomingSubscriptionAlerts.map((expense) => (
                  <div className="flex items-center justify-between gap-4 text-sm" key={expense.id}>
                    <div>
                      <p className="font-medium text-ink">{expense.name}</p>
                      <p className="text-xs text-titanium">{tx(locale, "In")} {Math.max(0, daysUntil(expense.next_due_date))} {tx(locale, "days")}</p>
                    </div>
                    <p className="font-semibold text-ink">{money.fmtAmountFull(expense.amount, expense.currency)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {upcomingRecurringExpenses.length > 0 && (
            <section className="glass-panel apple-card p-5">
              <h3 className="mb-4 text-xl font-semibold text-ink">{tx(locale, "Upcoming charges")}</h3>
              <div className="space-y-3">
                {upcomingRecurringExpenses.map((expense) => (
                  <div className="flex items-center justify-between gap-4 text-sm" key={expense.id}>
                    <div>
                      <p className="font-medium text-ink">{expense.name}</p>
                      <p className="text-xs text-titanium">{formatDateOnly(expense.next_due_date, locale)}</p>
                    </div>
                    <p className="font-semibold text-ink">{money.fmtAmountFull(expense.amount, expense.currency)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
      )}

      {cashflowMode === "debts" && (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <section className="glass-panel apple-card self-start p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{debtEditingId ? (tx(locale, "Edit loan / debt")) : (tx(locale, "Add loan / debt"))}</h3>
              <p className="mt-1 text-sm text-titanium">{tx(locale, "Manually track mortgages, car loans, student loans, credit cards, and other debts.")}</p>
            </div>
            {debtEditingId && (
              <button className="focus-ring rounded-full border border-line px-3 py-2 text-xs text-titanium hover:text-ink" onClick={onResetDebt} type="button">
                {tx(locale, "Cancel edit")}
              </button>
            )}
          </div>

          <form className="space-y-4" onSubmit={onSaveDebt}>
            <Field label={tx(locale, "Name")}>
              <input
                className="input-control focus-ring w-full px-3 text-ink"
                placeholder={tx(locale, "e.g. Mortgage, car loan, card installment")}
                value={debtForm.name}
                onChange={(event) => onUpdateDebtForm("name", event.target.value)}
                required
              />
            </Field>

            <Field label={tx(locale, "Type")}>
              <select className="input-control focus-ring w-full px-3 text-ink" value={debtForm.debt_type} onChange={(event) => onUpdateDebtForm("debt_type", event.target.value as DebtType)}>
                {debtTypes.map((type) => (
                  <option key={type.id} value={type.id}>{zh ? type.zh : type.en}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tx(locale, "Original principal")}>
                <NumericInput value={debtForm.original_principal} onChange={(value) => onUpdateDebtForm("original_principal", value)} />
              </Field>
              <Field label={tx(locale, "Remaining principal")}>
                <NumericInput value={debtForm.remaining_principal} onChange={(value) => onUpdateDebtForm("remaining_principal", value)} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tx(locale, "Currency")}>
                <select className="input-control focus-ring w-full px-3 text-ink" value={debtForm.currency} onChange={(event) => onUpdateDebtForm("currency", event.target.value as Currency)}>
                  {supportedCurrencies.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </Field>
              <Field label={tx(locale, "APR %")}>
                <NumericInput value={debtForm.interest_rate} onChange={(value) => onUpdateDebtForm("interest_rate", value)} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tx(locale, "Monthly payment")}>
                <NumericInput value={debtForm.minimum_payment} onChange={(value) => onUpdateDebtForm("minimum_payment", value)} />
              </Field>
              <Field label={tx(locale, "Next payment date")}>
                <input className="input-control focus-ring w-full px-3 text-ink" type="date" value={debtForm.next_payment_date} onChange={(event) => onUpdateDebtForm("next_payment_date", event.target.value)} required />
              </Field>
            </div>

            <Field label={tx(locale, "Lender")}>
              <input
                className="input-control focus-ring w-full px-3 text-ink"
                placeholder={tx(locale, "Bank, card issuer, private lender")}
                value={debtForm.lender}
                onChange={(event) => onUpdateDebtForm("lender", event.target.value)}
              />
            </Field>

            <label className="input-control flex items-center gap-3 px-3 text-sm text-ink">
              <input checked={debtForm.is_active} onChange={(event) => onUpdateDebtForm("is_active", event.target.checked)} type="checkbox" />
              {tx(locale, "Active / still owed")}
            </label>

            <Field label={tx(locale, "Notes")}>
              <textarea
                className="input-control focus-ring min-h-24 w-full resize-none px-3 py-3 text-ink"
                placeholder={tx(locale, "Optional")}
                value={debtForm.notes}
                onChange={(event) => onUpdateDebtForm("notes", event.target.value)}
              />
            </Field>

            <button className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium" type="submit">
              <Plus size={17} />
              {debtEditingId ? (tx(locale, "Update debt")) : (tx(locale, "Save debt"))}
            </button>
          </form>
        </section>

        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label={tx(locale, "Remaining debt")} value={totalDebtPrincipal} trend={activeDebts.length ? -1 : undefined} icon={<ReceiptText size={20} />} />
            <MetricCard label={tx(locale, "Monthly minimums")} value={totalDebtMonthlyPayment} trend={activeDebts.length ? -1 : undefined} icon={<ReceiptText size={20} />} />
            <MetricCard label={tx(locale, "Highest APR")} value={highestInterestDebt ? `${highestInterestDebt.interest_rate.toFixed(2)}%` : "0.00%"} trend={highestInterestDebt?.interest_rate ? -1 : undefined} icon={<Activity size={20} />} />
          </div>

          <section className="glass-panel apple-card p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">{tx(locale, "Loans and debts")}</h3>
                <p className="mt-1 text-sm text-titanium">{tx(locale, "Sorted by next payment date. Inactive debts are kept but excluded from summaries.")}</p>
              </div>
              <button
                aria-label={tx(locale, "Expand loans and debts")}
                className="focus-ring rounded-full border border-line p-2 text-titanium transition hover:bg-white/10 hover:text-ink"
                onClick={() => setExpandedList("debts")}
                type="button"
              >
                <Maximize2 size={17} />
              </button>
            </div>

            {!debts.length ? (
              <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
                {tx(locale, "Add your first debt to track principal and payment details.")}
              </div>
            ) : (
              <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-1">
                {debts.map((debt) => (
                  <article className={clsx("subtle-panel apple-card-sm p-4", !debt.is_active && "opacity-60")} key={debt.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button className="text-left" onClick={() => onEditDebt(debt)} type="button">
                        <span className="block font-semibold text-ink">{debt.name}</span>
                        <span className="mt-1 block text-xs text-titanium">{getDebtTypeLabel(debt.debt_type, locale)} · {debt.lender || (tx(locale, "No lender"))}</span>
                      </button>
                      <div className="text-right">
                        <p className="font-semibold text-ink">{money.fmtAmountFull(debt.remaining_principal, debt.currency)}</p>
                        <p className="mt-1 text-xs text-titanium">{tx(locale, "APR")}: {debt.interest_rate.toFixed(2)}%</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-titanium">{tx(locale, "Next payment")}: {formatDateOnly(debt.next_payment_date, locale)} · {money.fmtAmountFull(debt.minimum_payment, debt.currency)}</p>
                      <div className="flex items-center gap-2">
                        {!debt.is_active && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-titanium">{tx(locale, "Inactive")}</span>}
                        <button
                          aria-label={zh ? `刪除 ${debt.name}` : `Delete ${debt.name}`}
                          className="focus-ring rounded-xl border border-line p-2 text-titanium transition hover:bg-rose/10 hover:text-rose"
                          onClick={() => onDeleteDebt(debt.id)}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {upcomingDebtPayments.length > 0 && (
            <section className="glass-panel apple-card p-5">
              <h3 className="mb-4 text-xl font-semibold text-ink">{tx(locale, "Upcoming debt payments")}</h3>
              <div className="space-y-3">
                {upcomingDebtPayments.map((debt) => (
                  <div className="flex items-center justify-between gap-4 text-sm" key={debt.id}>
                    <div>
                      <p className="font-medium text-ink">{debt.name}</p>
                      <p className="text-xs text-titanium">{formatDateOnly(debt.next_payment_date, locale)}</p>
                    </div>
                    <p className="font-semibold text-ink">{money.fmtAmountFull(debt.minimum_payment, debt.currency)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
      )}

      {cashflowMode === "budgets" && (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <section className="glass-panel apple-card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">
                {budgetEditingId
                  ? tx(locale, budgetForm.category === totalBudgetCategory ? "Edit total budget" : "Edit category budget")
                  : tx(locale, budgetForm.category === totalBudgetCategory ? "Add total budget" : "Add category budget")}
              </h3>
              <p className="mt-1 text-sm text-titanium">
                {tx(locale, budgetForm.category === totalBudgetCategory
                  ? "Set one total budget and compare it with this month's expenses."
                  : "Set a limit for one spending category.")}
              </p>
            </div>
            {budgetEditingId && (
              <button className="focus-ring rounded-full border border-line px-3 py-2 text-xs text-titanium hover:text-ink" onClick={onResetBudget} type="button">
                {tx(locale, "Cancel edit")}
              </button>
            )}
          </div>

          <form className="space-y-4" onSubmit={onSaveBudget}>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-[var(--surface-muted)] p-1.5" role="group" aria-label={tx(locale, "Budget mode")}>
              <button
                className={clsx(
                  "focus-ring min-h-11 rounded-xl px-3 text-sm font-semibold transition",
                  budgetForm.category === totalBudgetCategory ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm" : "text-titanium hover:bg-panel hover:text-ink",
                )}
                onClick={() => onUpdateBudgetForm("category", totalBudgetCategory)}
                type="button"
              >
                {tx(locale, "Total budget")}
              </button>
              <button
                className={clsx(
                  "focus-ring min-h-11 rounded-xl px-3 text-sm font-semibold transition",
                  budgetForm.category !== totalBudgetCategory ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm" : "text-titanium hover:bg-panel hover:text-ink",
                )}
                onClick={() => onUpdateBudgetForm("category", cashflowCategories.expense[0].id)}
                type="button"
              >
                {tx(locale, "Category budget")}
              </button>
            </div>

            <Field label={tx(locale, "Month")}>
              <input className="input-control focus-ring w-full px-3 text-ink" type="month" value={budgetForm.month} onChange={(event) => onUpdateBudgetForm("month", event.target.value)} required />
            </Field>

            {budgetForm.category !== totalBudgetCategory && (
              <Field label={tx(locale, "Category")}>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
                  {cashflowCategories.expense.map((category) => {
                    const CategoryIcon = cashflowCategoryIcons[category.id as keyof typeof cashflowCategoryIcons] ?? Ellipsis;
                    const active = budgetForm.category === category.id;
                    return (
                      <button
                        aria-pressed={active}
                        className={clsx(
                          "focus-ring flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-xs font-medium transition duration-200 xl:min-h-[82px]",
                          active
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink shadow-sm"
                            : "border-line bg-[var(--surface-muted)] text-titanium hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-panel hover:text-ink",
                        )}
                        key={category.id}
                        onClick={() => onUpdateBudgetForm("category", category.id)}
                        type="button"
                      >
                        <CategoryIcon className={active ? "text-[var(--accent)]" : ""} size={19} />
                        <span>{getCategoryLabel(category.id, locale)}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tx(locale, "Budget amount")}>
                <NumericInput value={budgetForm.amount} onChange={(value) => onUpdateBudgetForm("amount", value)} />
              </Field>
              <Field label={tx(locale, "Currency")}>
                <select className="input-control focus-ring w-full px-3 text-ink" value={budgetForm.currency} onChange={(event) => onUpdateBudgetForm("currency", event.target.value as Currency)}>
                  {supportedCurrencies.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label={tx(locale, "Notes")}>
              <textarea
                className="input-control focus-ring min-h-24 w-full resize-none px-3 py-3 text-ink"
                placeholder={tx(locale, "Optional")}
                value={budgetForm.notes}
                onChange={(event) => onUpdateBudgetForm("notes", event.target.value)}
              />
            </Field>

            <button className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium" type="submit">
              <Plus size={17} />
              {budgetEditingId
                ? tx(locale, budgetForm.category === totalBudgetCategory ? "Update total budget" : "Update category budget")
                : tx(locale, budgetForm.category === totalBudgetCategory ? "Save total budget" : "Save category budget")}
            </button>
          </form>
        </section>

        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label={tx(locale, "Monthly budget")} value={formatBudgetLimitTotal(summaryBudgetRows, money)} icon={<ReceiptText size={20} />} />
            <MetricCard label={tx(locale, "Spent")} value={formatBudgetSpentTotal(summaryBudgetRows, money)} trend={summaryBudgetRows.length ? -1 : undefined} icon={<Activity size={20} />} />
            <MetricCard label={tx(locale, "Over budget")} value={String(overBudgetRows.length)} trend={overBudgetRows.length ? -1 : undefined} icon={<ListChecks size={20} />} />
          </div>

          <section className="glass-panel apple-card p-5">
            <div className="mb-5">
              <h3 className="text-xl font-semibold text-ink">{tx(locale, "Total budget")}</h3>
              <p className="mt-1 text-sm text-titanium">{tx(locale, "Showing this month's total budget. Click the item to edit.")}</p>
            </div>

            {!totalBudgetRows.length ? (
              <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
                {tx(locale, "Add a total budget to see spending, remaining amount, and over-budget status.")}
              </div>
            ) : (
              <BudgetRowsList rows={totalBudgetRows} locale={locale} money={money} onDelete={onDeleteBudget} onEdit={onEditBudget} type="total" />
            )}
          </section>

          <section className="glass-panel apple-card p-5">
            <div className="mb-5">
              <h3 className="text-xl font-semibold text-ink">{tx(locale, "Category budgets")}</h3>
              <p className="mt-1 text-sm text-titanium">{tx(locale, "Showing this month's category budgets. Click an item to edit.")}</p>
            </div>

            {!categoryBudgetRows.length ? (
              <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
                {tx(locale, "Add a category budget to track category spending.")}
              </div>
            ) : (
              <BudgetRowsList rows={categoryBudgetRows} locale={locale} money={money} onDelete={onDeleteBudget} onEdit={onEditBudget} type="category" />
            )}
          </section>
        </section>
      </div>
      )}

      {expandedList === "transactions" && (
        <ExpandedListModal
          title={transactionHistoryTitle}
          subtitle={zh ? `${transactionHistoryPeriod}，共 ${filteredSelectedMonthTransactions.length} 筆` : `${transactionHistoryPeriod}, ${filteredSelectedMonthTransactions.length} records`}
          onClose={() => setExpandedList(null)}
        >
          {transactionHistoryFilter !== "today" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <button className="focus-ring rounded-full border border-line px-3 py-2 text-sm text-titanium hover:text-ink" onClick={() => changeSelectedHistoryMonth(-1)} type="button">
                {tx(locale, "Prev month")}
              </button>
              <p className="font-semibold text-ink">{selectedMonthLabel}</p>
              <button className="focus-ring rounded-full border border-line px-3 py-2 text-sm text-titanium hover:text-ink" onClick={() => changeSelectedHistoryMonth(1)} type="button">
                {tx(locale, "Next month")}
              </button>
            </div>
          )}
          {!filteredSelectedMonthTransactions.length ? (
            <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
              {tx(locale, "There are no matching records.")}
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredSelectedMonthTransactions.map((transaction) => (
                <article className="subtle-panel apple-card-sm p-4" key={transaction.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button className="text-left" onClick={() => onEdit(transaction)} type="button">
                      <span className="block font-semibold text-ink">{transaction.description}</span>
                      <span className="mt-1 block text-xs text-titanium">{formatDateOnly(transaction.transaction_date, locale)} · {getCategoryLabel(transaction.category, locale)} · {getPaymentMethodLabel(transaction.payment_method, locale)}</span>
                      {transaction.notes && <span className="mt-1 block text-xs text-titanium">{transaction.notes}</span>}
                    </button>
                    <span className={clsx("font-semibold", transaction.transaction_type === "income" ? "text-mint" : "text-rose")}>
                      {transaction.transaction_type === "income" ? "+" : "-"}{money.fmtAmountFull(transaction.amount, transaction.currency)}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      aria-label={zh ? `刪除 ${transaction.description}` : `Delete ${transaction.description}`}
                      className="focus-ring rounded-xl border border-line p-2 text-titanium transition hover:bg-rose/10 hover:text-rose"
                      onClick={() => onDelete(transaction.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </ExpandedListModal>
      )}

      {expandedList === "recurring" && (
        <ExpandedListModal
          title={tx(locale, "All Recurring Expenses and Subscriptions")}
          subtitle={zh ? `共 ${recurringExpenses.length} 筆，未啟用項目不計入摘要。` : `${recurringExpenses.length} items. Inactive items are excluded from summaries.`}
          onClose={() => setExpandedList(null)}
        >
          {!recurringExpenses.length ? (
            <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
              {tx(locale, "No recurring expenses yet.")}
            </div>
          ) : (
            <div className="grid gap-3">
              {recurringExpenses.map((expense) => (
                <article className={clsx("subtle-panel apple-card-sm p-4", !expense.is_active && "opacity-60")} key={expense.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button className="flex min-w-0 items-start gap-3 text-left" onClick={() => onEditRecurring(expense)} type="button">
                      <BrandIcon name={expense.name} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">{expense.name}</span>
                        <span className="mt-1 block text-xs text-titanium">
                          {getRecurringCategoryLabel(expense.category, locale)} · {expense.frequency === "monthly" ? (tx(locale, "Monthly")) : (tx(locale, "Yearly"))} · {tx(locale, "Next")} {formatDateOnly(expense.next_due_date, locale)}
                        </span>
                        {expense.is_subscription && (
                          <span className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-xs text-titanium">
                            {getSubscriptionUsageLabel(expense.usage_status ?? "active", locale)}
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="text-right">
                      <p className="font-semibold text-ink">{money.fmtAmountFull(expense.amount, expense.currency)}</p>
                      {expense.is_subscription && <p className="mt-1 text-xs text-titanium">{tx(locale, "Annual")}: {formatRecurringAnnualizedAmount(expense, money)}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-titanium">{getPaymentMethodLabel(expense.payment_method, locale)}</p>
                    <button
                      aria-label={zh ? `刪除 ${expense.name}` : `Delete ${expense.name}`}
                      className="focus-ring rounded-xl border border-line p-2 text-titanium transition hover:bg-rose/10 hover:text-rose"
                      onClick={() => onDeleteRecurring(expense.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </ExpandedListModal>
      )}

      {expandedList === "debts" && (
        <ExpandedListModal
          title={tx(locale, "All Loans and Debts")}
          subtitle={zh ? `共 ${debts.length} 筆，未啟用項目不計入摘要。` : `${debts.length} items. Inactive debts are excluded from summaries.`}
          onClose={() => setExpandedList(null)}
        >
          {!debts.length ? (
            <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
              {tx(locale, "No loans or debts yet.")}
            </div>
          ) : (
            <div className="grid gap-3">
              {debts.map((debt) => (
                <article className={clsx("subtle-panel apple-card-sm p-4", !debt.is_active && "opacity-60")} key={debt.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button className="text-left" onClick={() => onEditDebt(debt)} type="button">
                      <span className="block font-semibold text-ink">{debt.name}</span>
                      <span className="mt-1 block text-xs text-titanium">{getDebtTypeLabel(debt.debt_type, locale)} · {debt.lender || (tx(locale, "No lender"))}</span>
                    </button>
                    <div className="text-right">
                      <p className="font-semibold text-ink">{money.fmtAmountFull(debt.remaining_principal, debt.currency)}</p>
                      <p className="mt-1 text-xs text-titanium">{tx(locale, "APR")}: {debt.interest_rate.toFixed(2)}%</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-titanium">{tx(locale, "Next payment")}: {formatDateOnly(debt.next_payment_date, locale)} · {money.fmtAmountFull(debt.minimum_payment, debt.currency)}</p>
                    <button
                      aria-label={zh ? `刪除 ${debt.name}` : `Delete ${debt.name}`}
                      className="focus-ring rounded-xl border border-line p-2 text-titanium transition hover:bg-rose/10 hover:text-rose"
                      onClick={() => onDeleteDebt(debt.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </ExpandedListModal>
      )}
    </div>
  );
}

function HoldingsView({
  cashOnly = false,
  demo,
  editingId,
  editingWalletCost,
  enriched,
  form,
  investmentTransactions,
  locale,
  t,
  userId,
  onClearAll,
  onDelete,
  onEdit,
  onSell,
  onReset,
  onSave,
  onUpdateForm,
  onHoldingsChanged,
}: {
  cashOnly?: boolean;
  demo: boolean;
  editingId: string | null;
  editingWalletCost: boolean;
  enriched: EnrichedHolding[];
  form: HoldingInput;
  investmentTransactions?: InvestmentTransaction[];
  locale: Locale;
  t: ReturnType<typeof getDictionary>;
  userId: string;
  onClearAll: () => void;
  onDelete: (id: string) => void;
  onEdit: (holding: Holding) => void;
  onSell?: (holding: EnrichedHolding) => void;
  onReset: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdateForm: <K extends keyof HoldingInput>(key: K, value: HoldingInput[K]) => void;
  onHoldingsChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"manual" | "wallet">("manual");
  const [manualTab, setManualTab] = useState<"form" | "import">("form");
  const [holdingsView, setHoldingsView] = useState<"bubbles" | "list">(() => {
    if (typeof window === "undefined" || cashOnly) return "list";
    return window.localStorage.getItem("holdingsView") === "list" ? "list" : "bubbles";
  });
  const [selectedBubble, setSelectedBubble] = useState<EnrichedHolding | null>(null);
  const money = useMoney();
  const visibleHoldings = enriched.filter((holding) => cashOnly ? holding.asset_type === "cash" : holding.asset_type !== "cash");

  function selectHoldingsView(next: "bubbles" | "list") {
    setHoldingsView(next);
    setSelectedBubble(null);
    window.localStorage.setItem("holdingsView", next);
  }
  const editingWalletHolding = editingWalletCost
    ? enriched.find((holding) => holding.id === editingId) ?? null
    : null;

  useEffect(() => {
    if (editingId) setManualTab("form");
  }, [editingId]);

  return (
    <div className="space-y-6">
      {!cashOnly && <div className="pill-panel inline-flex p-1">
        <button className={clsx("focus-ring rounded-full px-4 py-2 text-sm", mode === "manual" ? "primary-button" : "text-titanium")} onClick={() => setMode("manual")} type="button">{tx(locale, "Manual")}</button>
        <button className={clsx("focus-ring rounded-full px-4 py-2 text-sm", mode === "wallet" ? "primary-button" : "text-titanium")} onClick={() => setMode("wallet")} type="button">{tx(locale, "Address tracking")}</button>
      </div>}
      {!cashOnly && mode === "wallet" ? (
        <WalletTracker demo={demo} locale={locale} userId={userId} onHoldingsChanged={onHoldingsChanged} />
      ) : (
        <div className="space-y-5">
          <section className="glass-panel apple-card p-5">
            {editingId ? (
              <div className="mb-5 flex items-center gap-2">
                <Plus size={20} className="text-mint" />
                <h3 className="text-xl font-semibold text-ink">
                  {editingWalletCost ? (tx(locale, "Edit cost")) : cashOnly ? tx(locale, "Edit cash account") : t.editHolding}
                </h3>
              </div>
            ) : (
              <div className="pill-panel mb-5 inline-flex p-1">
                {!cashOnly && <>
                  <button className={clsx("focus-ring rounded-full px-4 py-2 text-sm", manualTab === "form" ? "primary-button" : "text-titanium")} onClick={() => setManualTab("form")} type="button">{tx(locale, "Add holding")}</button>
                  <button className={clsx("focus-ring rounded-full px-4 py-2 text-sm", manualTab === "import" ? "primary-button" : "text-titanium")} onClick={() => setManualTab("import")} type="button">{tx(locale, "Import Excel")}</button>
                </>}
                {cashOnly && <span className="px-3 py-2 text-sm font-semibold text-ink">{tx(locale, "Cash accounts")}</span>}
              </div>
            )}
            {editingId || cashOnly || manualTab === "form" ? (
            <>
            {editingWalletHolding && (
              <div className="subtle-panel apple-card-sm mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-ink">{editingWalletHolding.symbol}</p>
                  <p className="mt-1 text-sm text-titanium">{editingWalletHolding.name}</p>
                </div>
                <div className="text-right text-sm text-titanium">
                  <p>{editingWalletHolding.source_label}</p>
                  <p className="mt-1">{editingWalletHolding.quantity.toLocaleString("en-US", { maximumFractionDigits: 8 })}</p>
                </div>
              </div>
            )}
            <form
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
              onSubmit={onSave}
            >
              {!editingWalletCost && !cashOnly && <Field label={t.type}>
                <select
                  className="input-control focus-ring w-full px-3 text-ink"
                  value={form.asset_type === "crypto" ? "crypto" : "stock"}
                  onChange={(event) => {
                    const nextType = event.target.value === "crypto" ? "crypto" : "stock";
                    onUpdateForm("asset_type", nextType);
                    onUpdateForm("symbol", "");
                    onUpdateForm("name", "");
                    onUpdateForm("market_data_id", null);
                    onUpdateForm("market_code", null);
                    onUpdateForm("exchange_code", null);
                    onUpdateForm("quote_currency", nextType === "crypto" ? "USD" : null);
                    onUpdateForm("lot_size", 1);
                    onUpdateForm("break_even_price", "");
                    onUpdateForm("gain_calculation_mode", "estimated");
                    onUpdateForm("average_cost", "");
                    onUpdateForm("cost_currency", "USD");
                  }}
                >
                  <option value="crypto">{t.crypto}</option>
                  <option value="stock">{t.stock}</option>
                </select>
              </Field>}
              {!editingWalletCost && !cashOnly && <Field label={t.symbol}>
                {form.asset_type === "crypto" ? (
                  <CryptoSearch value={form.symbol} locale={locale} onChange={(value) => onUpdateForm("symbol", value)} onSelect={(coin) => {
                    onUpdateForm("symbol", coin.symbol);
                    onUpdateForm("name", coin.name);
                    onUpdateForm("market_data_id", coin.id);
                  }} />
                ) : (
                  <StockSymbolSearch value={form.symbol} locale={locale} onChange={(value) => {
                    onUpdateForm("symbol", value);
                    onUpdateForm("market_data_id", null);
                    onUpdateForm("market_code", null);
                    onUpdateForm("exchange_code", null);
                    onUpdateForm("quote_currency", null);
                    onUpdateForm("lot_size", 1);
                  }} onSelect={(result) => {
                    onUpdateForm("asset_type", result.assetType);
                    onUpdateForm("symbol", result.symbol);
                    if (result.description) onUpdateForm("name", result.description);
                    onUpdateForm("market_data_id", null);
                    onUpdateForm("market_code", result.market);
                    onUpdateForm("exchange_code", result.exchange);
                    onUpdateForm("quote_currency", result.currency);
                    onUpdateForm("lot_size", result.lotSize);
                    onUpdateForm("cost_currency", result.currency);
                  }} />
                )}
              </Field>}
              {!editingWalletCost && <Field label={cashOnly ? tx(locale, "Bank name") : t.name}>
                <input
                  className="input-control focus-ring w-full px-3 text-ink"
                  value={form.name}
                  onChange={(event) => onUpdateForm("name", event.target.value)}
                  required={cashOnly}
                />
              </Field>}
              {!editingWalletCost && <Field label={form.asset_type === "tw_stock" ? t.quantityLots : form.asset_type === "cash" ? tx(locale, "Cash balance") : t.quantity}>
                <input
                  className="input-control focus-ring w-full px-3 text-ink"
                  inputMode={form.asset_type === "tw_stock" ? "numeric" : "decimal"}
                  type="text"
                  value={form.quantity}
                  onChange={(event) => {
                    const nextValue = sanitizeNumericInput(event.target.value, form.asset_type !== "tw_stock");
                    if (nextValue !== null) onUpdateForm("quantity", nextValue);
                  }}
                  onBlur={() => {
                    if (form.quantity === "") onUpdateForm("quantity", "0");
                  }}
                />
              </Field>}
              {form.asset_type !== "cash" && <Field label={t.averageCost}>
                <input
                  className="input-control focus-ring w-full px-3 text-ink"
                  inputMode="decimal"
                  type="text"
                  value={form.average_cost}
                  onChange={(event) => {
                    const nextValue = sanitizeNumericInput(event.target.value, true);
                    if (nextValue !== null) onUpdateForm("average_cost", nextValue);
                  }}
                  onBlur={() => {
                    if (form.average_cost === "") onUpdateForm("average_cost", "0");
                  }}
                />
              </Field>}
              {form.asset_type !== "cash" && <label className="input-control mt-7 flex h-12 items-center gap-3 px-3 text-sm text-ink">
                <input className="h-4 w-4" checked={form.cost_known !== false} onChange={(event) => onUpdateForm("cost_known", event.target.checked)} type="checkbox" />
                {t.costKnown}
              </label>}
              {form.asset_type !== "cash" && form.gain_calculation_mode === "break_even" && (
                <div>
                  <Field label={t.breakEvenPrice}>
                    <input
                      aria-describedby="break-even-help"
                      className="input-control focus-ring w-full px-3 text-ink"
                      inputMode="decimal"
                      type="text"
                      value={form.break_even_price}
                      onChange={(event) => {
                        const nextValue = sanitizeNumericInput(event.target.value, true);
                        if (nextValue !== null) onUpdateForm("break_even_price", nextValue);
                      }}
                    />
                  </Field>
                  <p id="break-even-help" className="mt-1.5 text-xs leading-5 text-titanium">
                    {t.breakEvenHelp}
                  </p>
                </div>
              )}
              <Field label={t.currency}>
                <select
                  className="input-control focus-ring w-full px-3 text-ink"
                  value={form.cost_currency}
                  onChange={(event) => {
                    const currency = event.target.value as Currency;
                    onUpdateForm("cost_currency", currency);
                    if (form.asset_type === "cash") {
                      onUpdateForm("average_cost", "1");
                      onUpdateForm("gain_calculation_mode", "average_cost");
                      onUpdateForm("cost_known", true);
                    }
                  }}
                >
                  {supportedCurrencies.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </Field>
              {form.asset_type !== "cash" && (
                <div className="md:col-span-2 xl:col-span-4">
                  <GainCalculationModeSelector
                    locale={locale}
                    value={form.gain_calculation_mode}
                    onChange={(nextMode) => {
                      onUpdateForm("gain_calculation_mode", nextMode);
                      if (nextMode !== "break_even") {
                        onUpdateForm("break_even_price", "");
                      }
                    }}
                  />
                  {form.asset_type === "tw_stock" && (
                    <p className="mt-2 rounded-2xl border border-amber/25 bg-amber/10 px-3.5 py-2.5 text-xs leading-5 text-titanium">
                      {t.twStockBreakEvenSuggestion}
                    </p>
                  )}
                </div>
              )}
              {cashOnly && (
                <p className="-mt-2 text-xs leading-5 text-titanium md:col-span-2 xl:col-span-4">
                  {tx(locale, "Cash balances use the selected currency and are converted using live FX rates.")}
                </p>
              )}
              <div className="flex gap-3 md:col-span-2 xl:col-span-4">
                <button className="primary-button focus-ring flex-1 rounded-full px-4 py-3 font-medium" type="submit">
                  {t.save}
                </button>
                {editingId && (
                  <button className="interactive-muted focus-ring rounded-full border border-line px-4 py-3 text-ink" type="button" onClick={onReset}>
                    {t.cancel}
                  </button>
                )}
              </div>
            </form>
            </>
            ) : (
              <HoldingsImport
                demo={demo}
                embedded
                existingHoldings={enriched}
                locale={locale}
                userId={userId}
                onHoldingsChanged={onHoldingsChanged}
              />
            )}
          </section>

          <section className="glass-panel apple-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold text-ink">{cashOnly ? tx(locale, "Cash accounts") : t.holdings}</h3>
                {!cashOnly && (
                  <div className="pill-panel inline-flex p-1">
                    {([
                      { id: "bubbles", label: tx(locale, "Bubbles") },
                      { id: "list", label: tx(locale, "List") },
                    ] as const).map((option) => (
                      <button
                        aria-pressed={holdingsView === option.id}
                        className={clsx("focus-ring rounded-full px-4 py-1.5 text-sm", holdingsView === option.id ? "primary-button" : "text-titanium")}
                        key={option.id}
                        onClick={() => selectHoldingsView(option.id)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!cashOnly && visibleHoldings.length > 0 && (
                <button
                  className="focus-ring inline-flex items-center gap-2 rounded-full border border-rose/30 px-4 py-2 text-sm font-medium text-rose transition hover:bg-rose/10"
                  onClick={onClearAll}
                  type="button"
                >
                  <Trash2 size={15} />
                  {tx(locale, "Clear all holdings")}
                </button>
              )}
            </div>
            {!cashOnly && holdingsView === "bubbles" ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:items-start">
                <div>
                  <div className="mx-auto max-w-[640px]">
                    <HoldingBubbles
                      holdings={visibleHoldings}
                      locale={locale}
                      selectedId={selectedBubble?.id ?? null}
                      onSelect={(holding) => setSelectedBubble((current) => current?.id === holding.id ? null : holding)}
                    />
                  </div>
                  <p className="mt-3 text-center text-xs text-titanium">
                    {tx(locale, "Bubble size shows weight, color shows today's move. Tap a bubble for details.")}
                  </p>
                </div>
                {selectedBubble && (() => {
                  const holding = visibleHoldings.find((item) => item.id === selectedBubble.id) ?? selectedBubble;
                  const dayPercent = holding.asset_type === "cash" ? undefined : holding.quote?.dayChangePercent;
                  return (
                    <div className="subtle-panel apple-card-sm p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-ink">{holding.symbol}</p>
                          <p className="mt-0.5 truncate text-xs text-titanium">{holding.name}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-ink">{money.fmtUsd(holding.valueUsd)}</p>
                          <div className="mt-0.5 flex items-center justify-end gap-0.5">
                            <p className={clsx("text-xs", !holding.gainKnown ? "text-titanium" : holding.gainUsd >= 0 ? "text-mint" : "text-rose")}>
                              {!holding.gainKnown ? "N/A" : formatPercent(holding.gainPercent)}
                            </p>
                            {holding.gainEstimated && (
                              <GainCoverageWarning compact label={t.gainEstimateWarning} text={t.gainEstimateWarning} />
                            )}
                          </div>
                          {typeof dayPercent === "number" && (
                            <span className={clsx("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", dayPercent >= 0 ? "bg-mint/10 text-mint" : "bg-rose/10 text-rose")}>
                              {dayPercent >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                              {formatPercent(dayPercent)} {tx(locale, "1D")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface-muted)] p-3 text-xs">
                        <div><p className="text-[10px] text-titanium">{tx(locale, "Quantity")}</p><p className="mt-1 font-semibold text-ink">{holding.quantity}</p></div>
                        <div><p className="text-[10px] text-titanium">{tx(locale, "Avg. cost")}</p><p className="mt-1 font-semibold text-ink">{holding.cost_known === false ? "N/A" : money.fmtAmount(holding.average_cost, holding.cost_currency)}</p></div>
                      </div>
                      {!demo && (
                        <div className={clsx("mt-4 grid gap-2", holding.source_kind === "wallet" || !onSell ? "grid-cols-2" : "grid-cols-3")}>
                          {holding.source_kind !== "wallet" && onSell && (
                            <button
                              className="focus-ring flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-rose/30 bg-rose/10 text-sm font-semibold text-rose transition hover:bg-rose/20"
                              onClick={() => onSell(holding)}
                              type="button"
                            >
                              <TrendingDown size={14} />
                              {getRecordSaleLabel(locale)}
                            </button>
                          )}
                          <button
                            className="focus-ring flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-line bg-[var(--surface-muted)] text-sm font-semibold text-ink transition hover:bg-white/10"
                            onClick={() => onEdit(holding)}
                            type="button"
                          >
                            <Pencil size={14} />
                            {tx(locale, "Edit")}
                          </button>
                          {holding.source_kind !== "wallet" && (
                            <button
                              className="focus-ring flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-rose/30 bg-rose/10 text-sm font-semibold text-rose transition hover:bg-rose/20"
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
                  );
                })()}
              </div>
            ) : (
              <HoldingsTable
                cashOnly={cashOnly}
                enriched={visibleHoldings}
                locale={locale}
                t={t}
                onDelete={onDelete}
                onEdit={onEdit}
                onSell={onSell}
              />
            )}
          </section>
          {!cashOnly && investmentTransactions && (
            <InvestmentHistoryPanel locale={locale} transactions={investmentTransactions} />
          )}
        </div>
      )}
    </div>
  );
}

function BudgetRowsList({
  rows,
  locale,
  money,
  onDelete,
  onEdit,
  type,
}: {
  rows: BudgetRow[];
  locale: Locale;
  money: MoneyFmt;
  onDelete: (id: string) => void;
  onEdit: (budget: MonthlyBudget) => void;
  type: "total" | "category";
}) {
  const deleteLabel = type === "total" ? tx(locale, "Delete total budget") : tx(locale, "Delete category budget");

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <article className="subtle-panel apple-card-sm p-4" key={row.budget.id}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <button className="text-left" onClick={() => onEdit(row.budget)} type="button">
              <span className="block font-semibold text-ink">
                {type === "total" ? tx(locale, "Total budget") : getCategoryLabel(row.budget.category, locale)}
              </span>
              <span className="mt-1 block text-xs text-titanium">{formatDateOnly(row.budget.month, locale)} · {row.budget.currency}</span>
            </button>
            <div className="text-right">
              <p className={clsx("font-semibold", row.remaining < 0 ? "text-rose" : "text-ink")}>{money.fmtAmountFull(row.remaining, row.budget.currency)}</p>
              <p className="mt-1 text-xs text-titanium">{tx(locale, "Remaining")}</p>
            </div>
          </div>
          <div className="mb-3 h-2 rounded-full bg-white/10">
            <div
              className={clsx("h-2 rounded-full", row.percentUsed > 100 ? "bg-rose" : "bg-mint")}
              style={{ width: `${Math.min(100, row.percentUsed)}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-titanium">
            <span>{tx(locale, "Spent")} {money.fmtAmountFull(row.spent, row.budget.currency)} / {money.fmtAmountFull(row.budget.amount, row.budget.currency)}</span>
            <div className="flex items-center gap-2">
              {row.remaining < 0 && <span className="rounded-full bg-rose/10 px-2.5 py-1 text-rose">{tx(locale, "Over budget")}</span>}
              <button
                aria-label={deleteLabel}
                className="focus-ring rounded-xl border border-line p-2 text-titanium transition hover:bg-rose/10 hover:text-rose"
                onClick={() => onDelete(row.budget.id)}
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function HoldingQuantitySummary({
  enriched,
  locale,
  t,
}: {
  enriched: EnrichedHolding[];
  locale: Locale;
  t: ReturnType<typeof getDictionary>;
}) {
  const zh = locale === "zh";
  const labels = {
    zh: { total: "持有資產", unit: "種", otherStocks: "其他市場股票", help: "同類別、同代號的持倉合計為一種資產；不是持有股數。" },
    en: { total: "Assets held", unit: "distinct assets", otherStocks: "Other stock markets", help: "Positions with the same type and symbol count as one asset, not the number of shares." },
    ja: { total: "保有資産", unit: "種類", otherStocks: "その他市場の株式", help: "同じ種類・銘柄の保有分を1種類として集計します。株数ではありません。" },
    ko: { total: "보유 자산", unit: "종류", otherStocks: "기타 시장 주식", help: "동일 유형과 종목의 보유분은 한 종류로 계산합니다. 주식 수량이 아닙니다." },
    es: { total: "Activos en cartera", unit: "activos distintos", otherStocks: "Otros mercados bursátiles", help: "Las posiciones del mismo tipo y símbolo cuentan como un activo, no como número de acciones." },
  }[locale];
  const summary = useMemo(() => {
    const groups = enriched.reduce<Map<string, { assetType: AssetType; name: string; quantity: number; symbol: string }>>((acc, holding) => {
      const symbol = holding.symbol.toUpperCase();
      const key = `${holding.asset_type}:${symbol}`;
      const current = acc.get(key);
      acc.set(key, {
        assetType: holding.asset_type,
        name: current?.name ?? holding.name,
        quantity: (current?.quantity ?? 0) + holding.quantity,
        symbol,
      });
      return acc;
    }, new Map());

    return [...groups.values()].sort((a, b) => {
      const typeOrder = ["stock", "tw_stock", "us_stock", "crypto", "cash"];
      const typeDiff = typeOrder.indexOf(a.assetType) - typeOrder.indexOf(b.assetType);
      if (typeDiff !== 0) return typeDiff;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [enriched]);

  const typeOrder: AssetType[] = ["stock", "tw_stock", "us_stock", "crypto", "cash"];
  const typeIcons: Record<AssetType, React.ReactNode> = {
    cash: <CircleDollarSign aria-hidden="true" size={19} />,
    crypto: <WalletCards aria-hidden="true" size={19} />,
    stock: <LineChartIcon aria-hidden="true" size={19} />,
    tw_stock: <BarChart3 aria-hidden="true" size={19} />,
    us_stock: <LineChartIcon aria-hidden="true" size={19} />,
  };
  const typeTone: Record<AssetType, string> = {
    cash: "text-titanium",
    crypto: "text-mint",
    stock: "text-blue",
    tw_stock: "text-amber",
    us_stock: "text-blue",
  };
  const groupedSummary = typeOrder.map((assetType) => ({
    assetType,
    items: summary.filter((item) => item.assetType === assetType),
  })).filter((group) => group.items.length);

  if (!summary.length) {
    return (
      <section className="glass-panel apple-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-titanium">
          <ListChecks aria-hidden="true" size={22} />
        </div>
        <h3 className="mt-4 text-xl font-semibold text-ink">{tx(locale, "No quantities yet")}</h3>
        <p className="mt-2 text-sm text-titanium">
          {tx(locale, "Add a holding or sync a wallet to see asset quantities here.")}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="glass-panel apple-card relative overflow-hidden p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[var(--accent)] opacity-[0.06] blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-titanium">
              <ListChecks aria-hidden="true" className="text-[var(--accent)]" size={14} />
              {tx(locale, "Position inventory")}
            </div>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-ink">
              {tx(locale, "Quantities")}
            </h3>
          </div>
          <div className="subtle-panel apple-card-sm min-w-[150px] p-4 text-right">
            <p className="text-xs font-medium text-titanium">{labels.total}</p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-ink">{summary.length}</p>
            <p className="mt-1 text-xs text-titanium">{labels.unit}</p>
          </div>
        </div>

        <p className="relative mt-4 text-xs leading-5 text-titanium">{labels.help}</p>
        <div className="relative mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {groupedSummary.map(({ assetType, items }) => {
            const count = items.length;
            return (
              <div className="subtle-panel apple-card-sm flex items-center gap-3 px-4 py-3" key={assetType}>
                <span className={clsx("flex h-9 w-9 items-center justify-center rounded-xl bg-white/10", typeTone[assetType])}>
                  {typeIcons[assetType]}
                </span>
                <div>
                  <p className="text-xs text-titanium">{assetType === "stock" ? labels.otherStocks : t[assetType]}</p>
                  <p className="mt-0.5 text-lg font-semibold text-ink">{count}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {groupedSummary.map((group) => (
          <section className="glass-panel apple-card p-5 sm:p-6" key={group.assetType}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={clsx("flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10", typeTone[group.assetType])}>
                {typeIcons[group.assetType]}
              </span>
              <div>
                <h4 className="text-xl font-semibold text-ink">{group.assetType === "stock" ? labels.otherStocks : t[group.assetType]}</h4>
                <p className="mt-0.5 text-xs text-titanium">
                  {zh ? `${group.items.length} 種資產` : `${group.items.length} ${group.items.length === 1 ? "asset" : "assets"}`}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-titanium">
              {tx(locale, "Symbols aggregated")}
            </span>
          </div>

          <div className={clsx("grid gap-3", group.items.length > 1 && "sm:grid-cols-2")}>
            {group.items.map((item) => (
              <article
                className="subtle-panel apple-card-sm group relative overflow-hidden p-5 transition-transform duration-200 hover:-translate-y-0.5"
                key={`${item.assetType}:${item.symbol}`}
              >
                <div
                  aria-hidden="true"
                  className={clsx(
                    "absolute inset-x-0 top-0 h-1",
                    item.assetType === "tw_stock" && "bg-amber",
                    item.assetType === "us_stock" && "bg-blue",
                    item.assetType === "crypto" && "bg-mint",
                    item.assetType === "cash" && "bg-titanium",
                  )}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tracking-[-0.02em] text-ink">{item.symbol}</p>
                    <p className="mt-0.5 truncate text-xs text-titanium">{item.name}</p>
                  </div>
                  <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10", typeTone[item.assetType])}>
                    {typeIcons[item.assetType]}
                  </span>
                </div>

                <div className="my-5 h-px bg-line" />

                <p className="text-xs font-medium uppercase tracking-[0.12em] text-titanium">
                  {tx(locale, "Current quantity")}
                </p>
                <p className="mt-2 break-words text-2xl font-semibold tracking-[-0.04em] text-ink">
                  {formatHoldingQuantity(item.quantity, item.assetType, locale)}
                </p>

                {item.assetType === "tw_stock" && (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2">
                    <span className="text-xs text-titanium">{tx(locale, "Share equivalent")}</span>
                    <span className="text-xs font-semibold text-ink">{formatTaiwanShares(item.quantity, locale)}</span>
                  </div>
                )}
              </article>
            ))}
          </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CryptoSearch({ value, locale, onChange, onSelect }: { value: string; locale: Locale; onChange: (value: string) => void; onSelect: (coin: CryptoSearchResult) => void }) {
  const [results, setResults] = useState<CryptoSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value.trim().length < 2 || !open) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/market/crypto-search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        const data = (await response.json()) as { results?: CryptoSearchResult[] };
        setResults(data.results ?? []);
      } catch (searchError) {
        if (!(searchError instanceof DOMException && searchError.name === "AbortError")) setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, value]);

  return (
    <div className="relative">
      <input className="input-control focus-ring w-full px-3 text-ink" placeholder={tx(locale, "Search coin name or symbol")} value={value} onFocus={() => setOpen(true)} onChange={(event) => { onChange(event.target.value); setOpen(true); }} required />
      {open && value.length >= 2 && (
        <div className="glass-panel apple-card-sm absolute z-20 mt-2 max-h-72 w-full overflow-y-auto p-1">
          {loading && <p className="px-3 py-3 text-sm text-titanium">{tx(locale, "Searching...")}</p>}
          {!loading && results.map((coin) => (
            <button key={coin.id} className="focus-ring flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-white/10" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(coin); setOpen(false); }} type="button">
              <span><span className="font-medium text-ink">{coin.name}</span><span className="ml-2 text-xs text-titanium">{coin.symbol}</span></span>
              <span className="text-xs text-titanium">{coin.marketCapRank ? `#${coin.marketCapRank}` : ""}</span>
            </button>
          ))}
          {!loading && !results.length && <p className="px-3 py-3 text-sm text-titanium">{tx(locale, "No coins found")}</p>}
        </div>
      )}
    </div>
  );
}

function AnalysisView({
  assetMix,
  currencyMix,
  enriched,
  locale,
  t,
}: {
  assetMix: Array<{ name: string; value: number }>;
  currencyMix: Array<{ name: string; value: number }>;
  enriched: EnrichedHolding[];
  locale: Locale;
  t: ReturnType<typeof getDictionary>;
}) {
  const money = useMoney();
  const zh = locale === "zh";
  const portfolioHoldings = aggregateHoldingsForOverview(enriched);
  const topHoldings = portfolioHoldings.slice(0, 6);
  const totalValue = portfolioHoldings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const largestHolding = portfolioHoldings[0] ?? null;
  const topThreeWeight = portfolioHoldings.slice(0, 3).reduce((sum, holding) => sum + holding.allocationPercent, 0);
  const concentrationIndex = portfolioHoldings.reduce(
    (sum, holding) => sum + Math.pow(holding.allocationPercent / 100, 2),
    0,
  );
  const effectiveHoldings = concentrationIndex ? 1 / concentrationIndex : 0;
  const investmentHoldings = portfolioHoldings.filter((holding) => holding.asset_type !== "cash");
  const investmentValue = investmentHoldings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const knownCostValue = investmentHoldings
    .filter((holding) => holding.gainConfirmed)
    .reduce((sum, holding) => sum + holding.valueUsd, 0);
  const pricedValue = portfolioHoldings
    .filter((holding) => holding.asset_type === "cash" || Boolean(holding.quote))
    .reduce((sum, holding) => sum + holding.valueUsd, 0);
  const costCoverage = investmentValue ? (knownCostValue / investmentValue) * 100 : 0;
  const priceCoverage = totalValue ? (pricedValue / totalValue) * 100 : 0;
  const cryptoWeight = portfolioHoldings
    .filter((holding) => holding.asset_type === "crypto")
    .reduce((sum, holding) => sum + holding.allocationPercent, 0);
  const cashWeight = portfolioHoldings
    .filter((holding) => holding.asset_type === "cash")
    .reduce((sum, holding) => sum + holding.allocationPercent, 0);
  const knownCostHoldings = investmentHoldings.filter(
    (holding) => holding.gainConfirmed && holding.costBasisUsd > 0,
  );
  const gainContributors = [...knownCostHoldings]
    .sort((a, b) => Math.abs(b.gainUsd) - Math.abs(a.gainUsd))
    .slice(0, 5);
  const dayContributors = [...portfolioHoldings]
    .filter((holding) => holding.quote)
    .sort((a, b) => Math.abs(b.dayChangeUsd) - Math.abs(a.dayChangeUsd))
    .slice(0, 5);
  const maxGainContribution = Math.max(...gainContributors.map((holding) => Math.abs(holding.gainUsd)), 1);
  const maxDayContribution = Math.max(...dayContributors.map((holding) => Math.abs(holding.dayChangeUsd)), 1);
  const concentrationHigh = (largestHolding?.allocationPercent ?? 0) > 30;
  const scenarios = [
    {
      name: tx(locale, "Broad risk-off"),
      detail: tx(locale, "Stocks -10%, crypto -20%"),
      shocks: { cash: 0, crypto: -0.2, stock: -0.1, tw_stock: -0.1, us_stock: -0.1 } satisfies Record<AssetType, number>,
    },
    {
      name: tx(locale, "Equity correction"),
      detail: tx(locale, "US and Taiwan stocks fall 15%"),
      shocks: { cash: 0, crypto: 0, stock: -0.15, tw_stock: -0.15, us_stock: -0.15 } satisfies Record<AssetType, number>,
    },
    {
      name: tx(locale, "Crypto drawdown"),
      detail: tx(locale, "Crypto assets fall 30%"),
      shocks: { cash: 0, crypto: -0.3, stock: 0, tw_stock: 0, us_stock: 0 } satisfies Record<AssetType, number>,
    },
  ].map((scenario) => {
    const impact = portfolioHoldings.reduce(
      (sum, holding) => sum + holding.valueUsd * scenario.shocks[holding.asset_type],
      0,
    );
    return {
      ...scenario,
      impact,
      impactPercent: totalValue ? (impact / totalValue) * 100 : 0,
      remainingValue: totalValue + impact,
    };
  });
  const riskFlags = [
    {
      detail: concentrationHigh
        ? (tx(locale, "One asset exceeds 30%, increasing single-name risk."))
        : (tx(locale, "No single asset exceeds 30%.")),
      title: tx(locale, "Single-asset concentration"),
      value: largestHolding ? `${largestHolding.symbol} ${largestHolding.allocationPercent.toFixed(1)}%` : "N/A",
      warning: concentrationHigh,
    },
    {
      detail: topThreeWeight > 65
        ? (tx(locale, "The top three exceed 65%, limiting diversification."))
        : (tx(locale, "Top-three concentration remains moderate.")),
      title: tx(locale, "Top-three concentration"),
      value: `${topThreeWeight.toFixed(1)}%`,
      warning: topThreeWeight > 65,
    },
    {
      detail: cryptoWeight > 35
        ? (tx(locale, "High crypto exposure may amplify portfolio volatility."))
        : (tx(locale, "Crypto exposure is below 35%.")),
      title: tx(locale, "Crypto exposure"),
      value: `${cryptoWeight.toFixed(1)}%`,
      warning: cryptoWeight > 35,
    },
    {
      detail: priceCoverage < 95
        ? (tx(locale, "Missing prices may make valuation and allocation incomplete."))
        : (tx(locale, "Market prices cover most portfolio value.")),
      title: tx(locale, "Price coverage"),
      value: `${priceCoverage.toFixed(1)}%`,
      warning: priceCoverage < 95,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="glass-panel apple-card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">{tx(locale, "Portfolio diagnostics")}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink sm:text-3xl">
              {tx(locale, "Risk and quality snapshot")}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-titanium">
              {zh
                ? "以目前持倉、市值、成本與單日價格變化衡量集中度、資料完整性及主要績效來源。"
                : "Measures concentration, data quality, and key performance drivers using current positions, costs, and daily price changes."}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-titanium">
            {zh ? `${portfolioHoldings.length} 種合併資產` : `${portfolioHoldings.length} aggregated assets`}
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AnalysisMetric
            detail={largestHolding?.symbol ?? "N/A"}
            label={tx(locale, "Largest position")}
            tone={concentrationHigh ? "warning" : "positive"}
            value={`${(largestHolding?.allocationPercent ?? 0).toFixed(1)}%`}
          />
          <AnalysisMetric
            detail={tx(locale, "Adjusted for position weights")}
            label={tx(locale, "Effective holdings")}
            tone={effectiveHoldings >= 5 ? "positive" : "warning"}
            value={effectiveHoldings.toFixed(1)}
          />
          <AnalysisMetric
            detail={t.breakEvenPrice}
            label={t.gainCoverage}
            tone={costCoverage >= 90 ? "positive" : "warning"}
            value={`${costCoverage.toFixed(1)}%`}
          />
          <AnalysisMetric
            detail={zh ? `現金配置 ${cashWeight.toFixed(1)}%` : `Cash allocation ${cashWeight.toFixed(1)}%`}
            label={tx(locale, "Top-three weight")}
            tone={topThreeWeight > 65 ? "warning" : "positive"}
            value={`${topThreeWeight.toFixed(1)}%`}
          />
        </div>
      </section>

      <BacktestCard holdings={enriched} locale={locale} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="glass-panel apple-card p-5">
          <h3 className="mb-5 text-xl font-semibold text-ink">{t.assetMix}</h3>
          <ChartPanel data={assetMix.map((item) => ({ ...item, name: t[item.name as AssetType] }))} />
        </section>
        <section className="glass-panel apple-card p-5">
          <h3 className="mb-5 text-xl font-semibold text-ink">{t.currencyMix}</h3>
          <ChartPanel data={currencyMix} />
        </section>
        <section className="glass-panel apple-card p-5">
          <h3 className="mb-5 text-xl font-semibold text-ink">{t.topHoldings}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topHoldings.map((holding) => ({ name: holding.symbol, value: holding.valueUsd }))}>
                <XAxis dataKey="name" stroke="rgb(var(--titanium))" />
                <YAxis stroke="rgb(var(--titanium))" tickFormatter={(value) => `$${Number(value / 1000).toFixed(0)}k`} />
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
        <section className="glass-panel apple-card p-5">
          <h3 className="mb-5 text-xl font-semibold text-ink">{t.concentration}</h3>
          <div className="subtle-panel apple-card-sm p-5">
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

      <section className="glass-panel apple-card p-5 sm:p-6">
        <div>
          <h3 className="text-xl font-semibold text-ink">{tx(locale, "Risk monitor")}</h3>
          <p className="mt-1 text-sm text-titanium">
            {tx(locale, "Threshold-based checks for portfolio allocation and data quality.")}
          </p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {riskFlags.map((flag) => (
            <div key={flag.title} className="subtle-panel apple-card-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-titanium">{flag.title}</p>
                <span className={clsx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", flag.warning ? "bg-amber" : "bg-mint")} />
              </div>
              <p className={clsx("mt-3 text-2xl font-semibold tracking-[-0.04em]", flag.warning ? "text-amber" : "text-ink")}>
                {flag.value}
              </p>
              <p className="mt-2 text-xs leading-5 text-titanium">{flag.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ContributionPanel
          emptyLabel={tx(locale, "Known costs are required for gain contribution analysis.")}
          holdings={gainContributors}
          locale={locale}
          maxAbs={maxGainContribution}
          mode="gain"
          subtitle={tx(locale, "Assets contributing most to cumulative unrealized gain or loss.")}
          title={tx(locale, "Gain/loss contribution")}
        />
        <ContributionPanel
          emptyLabel={tx(locale, "Not enough daily price data is available.")}
          holdings={dayContributors}
          locale={locale}
          maxAbs={maxDayContribution}
          mode="day"
          subtitle={tx(locale, "Ranked by dollar impact, not percentage movement alone.")}
          title={tx(locale, "Daily risk contribution")}
        />
      </div>

      <section className="glass-panel apple-card p-5 sm:p-6">
        <div>
          <h3 className="text-xl font-semibold text-ink">{tx(locale, "Stress scenarios")}</h3>
          <p className="mt-1 text-sm leading-6 text-titanium">
            {zh
              ? "將固定跌幅套用到目前市值，估算一次性衝擊；這不是預測，也未納入資產相關性。"
              : "Applies fixed shocks to current market values. These are estimates, not forecasts, and exclude correlations."}
          </p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {scenarios.map((scenario) => (
            <div key={scenario.name} className="subtle-panel apple-card-sm p-5">
              <p className="text-sm font-semibold text-ink">{scenario.name}</p>
              <p className="mt-1 text-xs leading-5 text-titanium">{scenario.detail}</p>
              <p className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-rose">
                {money.fmtUsd(scenario.impact)}
              </p>
              <p className="mt-1 text-sm font-medium text-rose">{formatPercent(scenario.impactPercent)}</p>
              <div className="mt-4 border-t border-line pt-3 text-xs text-titanium">
                {tx(locale, "Estimated value after shock")}{" "}
                <span className="font-semibold text-ink">{money.fmtUsd(scenario.remainingValue)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="px-1 text-xs leading-5 text-titanium">
        {zh
          ? "分析限制：目前沒有完整歷史價格序列，因此不顯示 Beta、Sharpe ratio、波動率或最大回撤，避免產生失真的專業指標。"
          : "Analysis limitation: beta, Sharpe ratio, volatility, and maximum drawdown are omitted because complete historical price series are not yet available."}
      </p>
    </div>
  );
}

function AnalysisMetric({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: "positive" | "warning";
  value: string;
}) {
  return (
    <div className="subtle-panel apple-card-sm p-4">
      <p className="text-xs font-medium text-titanium">{label}</p>
      <p className={clsx("mt-2 text-2xl font-semibold tracking-[-0.045em]", tone === "positive" ? "text-ink" : "text-amber")}>
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-titanium">{detail}</p>
    </div>
  );
}

function ContributionPanel({
  emptyLabel,
  holdings,
  locale,
  maxAbs,
  mode,
  subtitle,
  title,
}: {
  emptyLabel: string;
  holdings: EnrichedHolding[];
  locale: Locale;
  maxAbs: number;
  mode: "gain" | "day";
  subtitle: string;
  title: string;
}) {
  const money = useMoney();
  return (
    <section className="glass-panel apple-card p-5 sm:p-6">
      <h3 className="text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-titanium">{subtitle}</p>
      {holdings.length ? (
        <div className="mt-5 space-y-4">
          {holdings.map((holding) => {
            const value = mode === "gain" ? holding.gainUsd : holding.dayChangeUsd;
            const percent = mode === "gain" ? holding.gainPercent : (holding.quote?.dayChangePercent ?? 0);
            return (
              <div key={holding.id}>
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{holding.symbol}</p>
                    <p className="truncate text-xs text-titanium">{holding.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={clsx("text-sm font-semibold", value >= 0 ? "text-mint" : "text-rose")}>
                      {money.fmtUsd(value)}
                    </p>
                    <p className={clsx("text-xs", percent >= 0 ? "text-mint" : "text-rose")}>
                      {formatPercent(percent)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={clsx("h-full rounded-full", value >= 0 ? "bg-mint" : "bg-rose")}
                    style={{ width: `${Math.max(3, (Math.abs(value) / maxAbs) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="subtle-panel apple-card-sm mt-5 p-5 text-sm text-titanium">{emptyLabel}</div>
      )}
      <p className="mt-4 text-[11px] text-titanium">
        {tx(locale, "Same-asset positions across sources are aggregated first.")}
      </p>
    </section>
  );
}

function SettingsView({
  biometricAvailable,
  biometricLock,
  demo,
  displayCurrency,
  locale,
  market,
  nativePlatform,
  paymentReminders,
  t,
  onBiometricLockChange,
  onDeleteAccount,
  onDisplayCurrencyChange,
  onLocaleChange,
  onPaymentRemindersChange,
}: {
  biometricAvailable: boolean;
  biometricLock: boolean;
  demo: boolean;
  displayCurrency: Currency;
  locale: Locale;
  market: MarketResponse | null;
  nativePlatform: boolean;
  paymentReminders: boolean;
  t: ReturnType<typeof getDictionary>;
  onBiometricLockChange: (next: boolean) => void;
  onDeleteAccount: () => Promise<void>;
  onDisplayCurrencyChange: (currency: Currency) => void;
  onLocaleChange: (locale: Locale) => void;
  onPaymentRemindersChange: (next: boolean) => void;
}) {
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const usdRate = market
    ? displayCurrency === "USD"
      ? null
      : market.fx.usdRates[displayCurrency] ?? null
    : null;
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <section className="glass-panel apple-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <CircleDollarSign size={20} style={{ color: "var(--accent)" }} />
          <h3 className="text-xl font-semibold text-ink">{tx(locale, "Appearance")}</h3>
        </div>
        <p className="mb-4 text-sm leading-6 text-titanium">{tx(locale, "Choose light, dark, or follow your device setting.")}</p>
        <ThemeToggle locale={locale} />
      </section>
      <section className="glass-panel apple-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <Languages size={20} style={{ color: "var(--accent)" }} />
          <h3 className="text-xl font-semibold text-ink">{t.language}</h3>
        </div>
        <label className="block text-sm font-medium text-titanium" htmlFor="settings-language">
          {t.language}
        </label>
        <div className="relative mt-2">
          <select
            aria-label={t.language}
            className="input-control focus-ring min-h-12 w-full appearance-none px-4 pr-11 text-base font-semibold text-ink"
            id="settings-language"
            value={locale}
            onChange={(event) => onLocaleChange(event.target.value as Locale)}
          >
            {localeOrder.map((item) => (
              <option key={item} value={item}>{localeNames[item]}</option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-titanium" size={18} />
        </div>
      </section>
      <section className="glass-panel apple-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <Globe2 size={20} className="text-mint" />
          <h3 className="text-xl font-semibold text-ink">{t.baseCurrency}</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {supportedCurrencies.map((item) => (
            <button
              className={clsx(
                "focus-ring rounded-2xl border border-line px-3 py-4 text-center",
                displayCurrency === item ? "primary-button" : "interactive-muted text-ink",
              )}
              key={item}
              onClick={() => onDisplayCurrencyChange(item)}
              type="button"
            >
              <span className="block text-base font-semibold">{item}</span>
              <span className="block text-xs opacity-80">{currencySymbols[item]}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-titanium">{t.baseCurrencyHelp}</p>
        {usdRate !== null && usdRate !== undefined && (
          <p className="mt-2 text-sm text-titanium">1 USD = {usdRate.toFixed(2)} {displayCurrency}</p>
        )}
      </section>
      <section className="glass-panel apple-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck size={20} className="text-amber" />
          <h3 className="text-xl font-semibold text-ink">{t.security}</h3>
        </div>
        <p className="text-sm leading-6 text-titanium">{tx(locale, "Your account is protected by email sign-in and row-level security.")}</p>
        {biometricAvailable && (
          <label className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{tx(locale, "Face ID / Touch ID unlock")}</span>
              <span className="mt-0.5 block text-xs text-titanium">{tx(locale, "Require biometric authentication to open the app.")}</span>
            </span>
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
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{tx(locale, "Payment reminders")}</span>
              <span className="mt-0.5 block text-xs text-titanium">{tx(locale, "Get notified before subscriptions and loan payments are due.")}</span>
            </span>
            <input
              checked={paymentReminders}
              className="h-5 w-5 shrink-0"
              onChange={(event) => onPaymentRemindersChange(event.target.checked)}
              type="checkbox"
            />
          </label>
        )}
      </section>
      {!demo && (
        <section className="glass-panel apple-card border-rose/25 p-5 xl:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Trash2 size={20} className="text-rose" />
            <h3 className="text-xl font-semibold text-ink">{tx(locale, "Delete account")}</h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-titanium">
            {tx(locale, "This permanently deletes your account and all associated portfolio, wallet, cashflow, budget, subscription, and debt data. This cannot be undone.")}
          </p>
          <label className="mt-5 block max-w-md">
            <span className="text-sm font-medium text-ink">{tx(locale, "Type DELETE to confirm.")}</span>
            <input
              className="input-control focus-ring mt-2 w-full px-4 text-ink"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder="DELETE"
            />
          </label>
          {deleteError && <p className="mt-3 text-sm text-rose" role="alert">{deleteError}</p>}
          <button
            className="focus-ring mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose/30 bg-rose/10 px-4 text-sm font-semibold text-rose transition hover:bg-rose/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={deleteConfirmation !== "DELETE" || deleting}
            onClick={async () => {
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
            {tx(locale, deleting ? "Deleting account..." : "Delete account permanently")}
          </button>
        </section>
      )}
    </div>
  );
}

function HoldingsTable({
  allowEdit = true,
  cashOnly = false,
  compact = false,
  enriched,
  locale,
  sourceMap,
  t,
  onDelete,
  onEdit,
  onSell,
}: {
  allowEdit?: boolean;
  cashOnly?: boolean;
  compact?: boolean;
  enriched: EnrichedHolding[];
  locale: Locale;
  sourceMap?: Map<string, EnrichedHolding[]>;
  t: ReturnType<typeof getDictionary>;
  onDelete: (id: string) => void;
  onEdit: (holding: Holding) => void;
  onSell?: (holding: EnrichedHolding) => void;
}) {
  const money = useMoney();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  if (!enriched.length) {
    const emptyLabel = cashOnly ? t.noCashAccounts : t.noInvestmentHoldings;
    return <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">{emptyLabel}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-[18px] border border-line">
      <table className={clsx("w-full border-collapse text-left text-sm", cashOnly ? (compact ? "min-w-[680px]" : "min-w-[760px]") : compact ? "min-w-[810px]" : "min-w-[930px]")}>
        <thead className="bg-white/5 text-xs uppercase tracking-[0.08em] text-titanium">
          <tr>
            <th className="w-[230px] px-4 py-3">{cashOnly ? t.bank : t.symbol}</th>
            <th className="w-[120px] px-4 py-3">{cashOnly ? t.currency : t.type}</th>
            {cashOnly ? (
              <>
                <th className="w-[160px] px-4 py-3 text-right">{t.originalBalance}</th>
                <th className="w-[150px] px-4 py-3 text-right">{t.convertedAmount}</th>
              </>
            ) : (
              <>
                <th className="w-[140px] px-4 py-3 text-right">{t.averageCost}</th>
                {compact ? (
                  <>
                    <th className="w-[145px] px-4 py-3 text-right">{t.netGain}</th>
                    <th className="w-[130px] px-4 py-3 text-right">{t.currentPrice}</th>
                  </>
                ) : (
                  <>
                    <th className="w-[130px] px-4 py-3 text-right">{t.currentPrice}</th>
                    <th className="w-[145px] px-4 py-3 text-right">{t.netGain}</th>
                  </>
                )}
              </>
            )}
            {!compact && <th className="w-[110px] px-4 py-3 text-right"></th>}
          </tr>
        </thead>
        <tbody>
          {enriched.map((holding) => {
            const sourceKey = holdingSourceKey(holding);
            const sources = sourceMap?.get(sourceKey) ?? [];
            const hasSources = sources.length > 1;
            const isExpanded = expanded.has(sourceKey);
            const currentPriceCell = (
              <td className="whitespace-nowrap px-4 py-4 text-right text-ink" key="current-price">
                <CurrentPriceValue holding={holding} unavailableLabel={t.priceUnavailable} />
              </td>
            );
            const netGainCell = (
              <td
                className={clsx("whitespace-nowrap px-4 py-4 text-right", !holding.gainKnown ? "text-titanium" : holding.gainUsd >= 0 ? "text-mint" : "text-rose")}
                key="net-gain"
              >
                {!holding.gainKnown ? <UnknownCostLabel label="N/A" /> : (
                  <div className="flex items-start justify-end gap-1">
                    <span>
                      <span className="block">{money.fmtUsd(holding.gainUsd)}</span>
                      <span className="block text-xs">{formatPercent(holding.gainPercent)}</span>
                    </span>
                    {holding.gainEstimated && (
                      <GainCoverageWarning compact label={t.gainEstimateWarning} text={t.gainEstimateWarning} />
                    )}
                  </div>
                )}
              </td>
            );

            return (
            <Fragment key={holding.id}>
            <tr key={holding.id} className="border-t border-line transition hover:bg-white/5">
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  {hasSources && (
                    <button
                      aria-label={isExpanded ? "Collapse sources" : "Expand sources"}
                      className="focus-ring rounded-full p-1 text-titanium transition hover:bg-white/10 hover:text-ink"
                      onClick={() => setExpanded((current) => toggleExpanded(current, sourceKey))}
                      type="button"
                    >
                      <ChevronDown className={clsx("transition", isExpanded && "rotate-180")} size={15} />
                    </button>
                  )}
                  {cashOnly && <BankMark fallback={holding.symbol} name={`${holding.name} ${holding.symbol}`} />}
                  <div className="text-left">
                    <span className="block font-semibold text-ink">{cashOnly ? holding.name : holding.symbol}</span>
                    <span className="block text-xs text-titanium">{cashOnly ? holding.symbol : holding.name}</span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                {cashOnly ? <span className="text-ink">{holding.cost_currency}</span> : (
                  <span className="inline-flex whitespace-nowrap rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-titanium">
                    {t[holding.asset_type]}
                  </span>
                )}
              </td>
              {cashOnly ? (
                <>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-ink">{money.fmtAmountFull(holding.quantity, holding.cost_currency)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-ink">{money.fmtUsd(holding.valueUsd)}</td>
                </>
              ) : (
                <>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-ink">
                    <AverageCostValue
                      editLabel={t.averageCost}
                      holding={holding}
                      unknownLabel={t.costUnknown}
                    />
                  </td>
                  {compact ? (
                    <>{netGainCell}{currentPriceCell}</>
                  ) : (
                    <>{currentPriceCell}{netGainCell}</>
                  )}
                </>
              )}
              {!compact && <td className="px-4 py-4 text-right">
                <div className="ml-auto inline-flex overflow-hidden rounded-xl border border-line bg-[var(--surface-muted)] shadow-sm">
                    {onSell && !cashOnly && holding.source_kind !== "wallet" && (
                      <button
                        aria-label={`${getRecordSaleLabel(locale)} ${holding.symbol}`}
                        className="focus-ring grid h-9 w-9 place-items-center text-rose transition hover:bg-rose/10"
                        onClick={() => onSell(holding)}
                        title={getRecordSaleLabel(locale)}
                        type="button"
                      >
                        <TrendingDown size={14} />
                      </button>
                    )}
                    {allowEdit && (
                      <button
                        aria-label={`${tx(locale, "Edit")} ${cashOnly ? holding.name : holding.symbol}`}
                        className={clsx("focus-ring grid h-9 w-9 place-items-center text-titanium transition hover:bg-white/10 hover:text-ink", onSell && !cashOnly && holding.source_kind !== "wallet" && "border-l border-line")}
                        onClick={() => onEdit(holding)}
                        title={tx(locale, "Edit")}
                        type="button"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button
                      aria-label={`${t.delete} ${holding.symbol}`}
                      className={clsx(
                        "focus-ring grid h-9 w-9 place-items-center text-titanium transition hover:bg-rose/10 hover:text-rose",
                        allowEdit && "border-l border-line",
                      )}
                      onClick={() => onDelete(holding.id)}
                      title={t.delete}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                </div>
              </td>}
            </tr>
            {hasSources && isExpanded && (
              <tr className="border-t border-line bg-white/5">
                <td colSpan={cashOnly ? (compact ? 4 : 5) : (compact ? 5 : 6)} className="px-4 py-4">
                  <SourceBreakdown sources={sources} t={t} />
                </td>
              </tr>
            )}
            </Fragment>
          );})}
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
      aria-current={active ? "page" : undefined}
      className={clsx(
        "focus-ring group flex w-full items-center gap-2 rounded-2xl border border-transparent px-2.5 py-2.5 text-left text-sm transition-all duration-200 ease-out hover:translate-x-0.5 hover:border-line hover:bg-[var(--surface-muted)] hover:text-ink active:translate-x-0 motion-reduce:transform-none motion-reduce:transition-none",
        active ? "nav-active shadow-sm" : "text-titanium",
      )}
      onClick={onClick}
      type="button"
    >
      <span
        className={clsx(
          "nav-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition duration-200 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none",
          active ? "nav-icon-active text-[var(--accent)] group-hover:text-[var(--accent)]" : "bg-transparent group-hover:text-ink",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <ChevronRight
        aria-hidden="true"
        className={clsx(
          "-translate-x-1 text-titanium opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-65 motion-reduce:transform-none motion-reduce:transition-none",
          active && "translate-x-0 opacity-50",
        )}
        size={14}
      />
    </button>
  );
}

function NavSection({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="block">
      <div className="mb-1.5 mt-0.5 flex items-center gap-3 px-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-titanium/80">{label}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="block space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function MetricCard({
  footer,
  actionLabel,
  detail,
  icon,
  info,
  label,
  onClick,
  primary = false,
  trend,
  value,
  warning,
}: {
  footer?: React.ReactNode;
  actionLabel?: string;
  detail?: string;
  icon: React.ReactNode;
  info?: string;
  label: string;
  onClick?: () => void;
  primary?: boolean;
  trend?: number;
  value: string;
  warning?: string;
}) {
  const className = clsx(
    "glass-panel apple-card min-w-0 p-5 text-left [container-type:inline-size]",
    primary && "sm:col-span-2 xl:col-span-1",
    onClick && "focus-ring group transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]",
  );
  const content = (
    <>
      <div className="flex items-center justify-between text-titanium">
        <span className="text-sm">{label}</span>
        <span className="flex items-center gap-1.5">
          {icon}
          {info && <InfoTip text={info} />}
          {warning && <GainCoverageWarning label={warning} text={warning} />}
          {onClick && <ChevronRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" size={15} />}
        </span>
      </div>
      {/* Shrink long amounts (e.g. -NT$1,273.38) to fit the card width instead of wrapping. */}
      <p
        className={clsx("mt-5 whitespace-nowrap font-semibold leading-tight tracking-[-0.045em]", trend === undefined ? "text-ink" : trend >= 0 ? "text-mint" : "text-rose")}
        style={{ fontSize: `min(${primary ? 2.25 : 1.875}rem, ${Math.round(160 / Math.max(value.length, 1))}cqi)` }}
      >
        {value}
      </p>
      {detail && <p className="mt-2 text-sm text-titanium">{detail}</p>}
      {footer}
    </>
  );

  if (onClick) {
    return (
      <button aria-label={actionLabel ?? label} className={className} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
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
  const money = useMoney();
  return (
    <section className="glass-panel apple-card p-5">
      <h3 className="mb-4 text-xl font-semibold text-ink">{title}</h3>
      <div className="space-y-3">
        {holdings.map((holding) => (
          <div key={holding.id} className="subtle-panel apple-card-sm flex items-center justify-between p-4">
            <div>
              <p className="font-semibold text-ink">{holding.symbol}</p>
              <p className="text-xs text-titanium">{t[holding.asset_type]}</p>
            </div>
            <div className={holding.gainPercent >= 0 ? "text-right text-mint" : "text-right text-rose"}>
              <p className="font-semibold">{formatPercent(holding.gainPercent)}</p>
              <p className="text-xs">{money.fmtUsd(holding.gainUsd)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChartPanel({ data }: { data: Array<{ name: string; value: number }> }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const chartLabel = data
    .map((entry) => `${entry.name} ${total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0"}%`)
    .join(", ");

  return (
    <div
      aria-label={chartLabel}
      className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5"
      role="img"
    >
      <div className="h-60 w-full max-w-[280px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            cornerRadius={5}
            data={data}
            dataKey="value"
            innerRadius={68}
            isAnimationActive={false}
            label={renderDonutPercentLabel}
            labelLine={false}
            outerRadius={101}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid w-full max-w-sm flex-1 basis-64 gap-2">
        {data.map((entry, index) => (
          <div
            className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-[var(--surface-muted)] px-3.5 py-3 text-sm"
            key={entry.name}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white/5"
                style={{ backgroundColor: chartColors[index % chartColors.length] }}
              />
              <span className="truncate font-medium text-titanium">{entry.name}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0"}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderDonutPercentLabel({ cx, cy, midAngle, middleRadius, outerRadius, percent }: PieLabelRenderProps) {
  const share = (percent ?? 0) * 100;
  if (share < 0.1) return null;

  const label = `${share < 10 ? share.toFixed(1) : share.toFixed(0)}%`;
  const angle = -(Number(midAngle) * Math.PI) / 180;
  const compact = share >= 4;
  const radius = compact ? Number(middleRadius) : Number(outerRadius) + 16;
  const x = Number(cx) + radius * Math.cos(angle);
  const y = Number(cy) + radius * Math.sin(angle);
  const labelWidth = Math.max(36, label.length * 7 + 12);

  return (
    <g pointerEvents="none">
      {!compact && (
        <line
          stroke="rgba(160, 167, 180, 0.8)"
          strokeWidth={1}
          x1={Number(cx) + (Number(outerRadius) + 2) * Math.cos(angle)}
          x2={x}
          y1={Number(cy) + (Number(outerRadius) + 2) * Math.sin(angle)}
          y2={y}
        />
      )}
      <rect
        fill="rgba(15, 23, 42, 0.76)"
        height={24}
        rx={8}
        width={labelWidth}
        x={x - labelWidth / 2}
        y={y - 12}
      />
      <text
        dominantBaseline="central"
        fill="#fff"
        fontSize={11}
        fontWeight={700}
        textAnchor="middle"
        x={x}
        y={y}
      >
        {label}
      </text>
    </g>
  );
}

function ChartLegend({ data }: { data: Array<{ name: string; value: number }> }) {
  const money = useMoney();
  return (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {data.slice(0, 8).map((entry, index) => (
        <div key={entry.name} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-titanium">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
            <span className="truncate">{entry.name}</span>
          </span>
          <span className="shrink-0 font-medium text-ink">{money.fmtUsd(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function MoneyTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ color?: string; dataKey?: string; name?: string; value?: number }>;
}) {
  const money = useMoney();
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="glass-panel apple-card-sm px-3 py-2 text-sm">
      {label && <p className="mb-1 font-medium text-ink">{label}</p>}
      <div className="space-y-1">
        {payload.map((item) => (
          <p className="flex items-center justify-between gap-4 text-titanium" key={`${item.name ?? item.dataKey}-${item.value}`}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? "var(--accent)" }} />
              {item.name ?? item.dataKey}
            </span>
            <span className="font-medium text-ink">{money.fmtUsd(Number(item.value ?? 0))}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  const money = useMoney();
  if (!active || !payload?.length) {
    return null;
  }
  const item = payload[0];
  return (
    <div className="glass-panel apple-card-sm px-3 py-2 text-sm">
      <p className="text-ink">{item.name}</p>
      <p className="text-titanium">{money.fmtUsd(item.value)}</p>
    </div>
  );
}

function AverageCostValue({
  holding,
  editLabel,
  onEdit,
  unknownLabel,
}: {
  editLabel: string;
  holding: EnrichedHolding;
  onEdit?: (holding: Holding) => void;
  unknownLabel: string;
}) {
  const money = useMoney();
  const content = holding.cost_known === false
    ? <UnknownCostLabel label={unknownLabel} />
    : formatAverageCost(holding, money);

  if (holding.source_kind !== "wallet" || !onEdit) return content;

  return (
    <button
      className="focus-ring rounded-full ring-1 ring-transparent transition hover:bg-white/10 hover:ring-line"
      onClick={() => onEdit(holding)}
      title={editLabel}
      type="button"
    >
      {content}
    </button>
  );
}

function formatAverageCost(holding: EnrichedHolding, money: MoneyFmt) {
  return money.fmtAmountFull(holding.average_cost, holding.cost_currency);
}

function CurrentPriceValue({
  holding,
  unavailableLabel,
}: {
  holding: EnrichedHolding;
  unavailableLabel: string;
}) {
  const money = useMoney();

  if (holding.asset_type === "cash") {
    return <span className="text-titanium">—</span>;
  }

  const price = formatCurrentPrice(holding.quote, money);
  return price ?? <UnknownCostLabel label={unavailableLabel} />;
}

function SourceBreakdown({
  sources,
  t,
}: {
  sources: EnrichedHolding[];
  t: ReturnType<typeof getDictionary>;
}) {
  return (
    <div className="grid gap-2">
      {sources.map((source) => (
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-panel/70 p-3 text-sm md:grid-cols-[1.2fr_1fr_1fr_1fr]" key={source.id}>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{source.source_label ?? t.manual}</p>
            <p className="mt-1 truncate text-xs text-titanium">{source.source_kind === "wallet" ? source.source_asset_id : t.manual}</p>
          </div>
          <div>
            <p className="text-xs text-titanium">{t.quantity}</p>
            <p className="mt-1 text-ink">{source.quantity.toLocaleString("en-US", { maximumFractionDigits: 8 })}</p>
          </div>
          <div>
            <p className="text-xs text-titanium">{t.currentPrice}</p>
            <div className="mt-1 text-ink">
              <CurrentPriceValue holding={source} unavailableLabel={t.priceUnavailable} />
            </div>
          </div>
          <div>
            <p className="text-xs text-titanium">{t.averageCost}</p>
            <div className="mt-1 text-ink">
              <AverageCostValue editLabel={t.averageCost} holding={source} unknownLabel={t.costUnknown} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function buildSourceMap(holdings: EnrichedHolding[]) {
  return holdings.reduce<Map<string, EnrichedHolding[]>>((acc, holding) => {
    const key = holdingSourceKey(holding);
    acc.set(key, [...(acc.get(key) ?? []), holding]);
    return acc;
  }, new Map());
}

function getCategoryLabel(categoryId: string, locale: Locale) {
  if (categoryId === totalBudgetCategory) return tx(locale, "Total budget");
  const allCategories = [...cashflowCategories.income, ...cashflowCategories.expense];
  const category = allCategories.find((item) => item.id === categoryId);
  if (!category) return categoryId;
  return tx(locale, category.en);
}

function getRecurringCategoryLabel(categoryId: string, locale: Locale) {
  const category = recurringCategories.find((item) => item.id === categoryId);
  if (!category) return categoryId;
  return locale === "zh" ? category.zh : category.en;
}

function getSubscriptionUsageLabel(statusId: RecurringExpense["usage_status"], locale: Locale) {
  const status = subscriptionUsageStatuses.find((item) => item.id === statusId);
  if (!status) return statusId ?? "";
  return locale === "zh" ? status.zh : status.en;
}

function getDebtTypeLabel(typeId: DebtType, locale: Locale) {
  const type = debtTypes.find((item) => item.id === typeId);
  if (!type) return typeId;
  return locale === "zh" ? type.zh : type.en;
}

function isToday(dateValue: string) {
  const date = parseDateOnly(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}


function formatDateOnly(dateValue: string, locale: Locale) {
  return parseDateOnly(dateValue).toLocaleDateString(locale === "zh" ? "zh-TW" : "en-US");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getCalendarDays(selectedDate: string) {
  const selected = parseDateOnly(selectedDate);
  const firstOfMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getCalendarYearOptions(currentYear: number) {
  return Array.from({ length: 11 }, (_, index) => currentYear - 5 + index);
}

function getCashflowCalendarEvents(
  transactions: CashflowTransaction[],
  recurringExpenses: RecurringExpense[],
  debts: Debt[],
  locale: Locale,
  money: MoneyFmt,
): CashflowCalendarEvent[] {
  const visibleMonthKeys = new Set(getRecentMonthKeys(12).concat(getFutureMonthKeys(12)));
  const events: CashflowCalendarEvent[] = [];

  transactions.forEach((transaction) => {
    events.push({
      amount: `${transaction.transaction_type === "income" ? "+" : "-"}${money.fmtAmount(transaction.amount, transaction.currency)}`,
      date: transaction.transaction_date,
      kind: transaction.transaction_type,
      label: getCategoryLabel(transaction.category, locale),
      title: transaction.description,
    });
  });

  recurringExpenses
    .filter((expense) => expense.is_active)
    .forEach((expense) => {
      const dueDate = parseDateOnly(expense.next_due_date);
      if (expense.frequency === "monthly") {
        visibleMonthKeys.forEach((monthKey) => {
          const [year, month] = monthKey.split("-").map(Number);
          const lastDay = new Date(year, month, 0).getDate();
          const day = Math.min(dueDate.getDate(), lastDay);
          events.push({
            amount: money.fmtAmount(expense.amount, expense.currency),
            date: `${monthKey}-${String(day).padStart(2, "0")}`,
            kind: "recurring",
            label: expense.is_subscription ? (tx(locale, "Subscription")) : getRecurringCategoryLabel(expense.category, locale),
            title: expense.name,
          });
        });
        return;
      }

      events.push({
        amount: money.fmtAmount(expense.amount, expense.currency),
        date: expense.next_due_date,
        kind: "recurring",
        label: expense.is_subscription ? (tx(locale, "Subscription")) : getRecurringCategoryLabel(expense.category, locale),
        title: expense.name,
      });
    });

  debts
    .filter((debt) => debt.is_active)
    .forEach((debt) => {
      events.push({
        amount: money.fmtAmount(debt.minimum_payment, debt.currency),
        date: debt.next_payment_date,
        kind: "debt",
        label: getDebtTypeLabel(debt.debt_type, locale),
        title: debt.name,
      });
    });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function calendarEventDotClass(kind: CashflowCalendarEvent["kind"]) {
  if (kind === "income") return "bg-mint";
  if (kind === "expense") return "bg-rose";
  if (kind === "recurring") return "bg-[var(--accent)]";
  return "bg-titanium";
}

function calendarEventTextClass(kind: CashflowCalendarEvent["kind"]) {
  if (kind === "income") return "text-mint";
  if (kind === "expense") return "text-rose";
  if (kind === "recurring") return "text-ink";
  return "text-titanium";
}

function formatCashflowTotals(transactions: CashflowTransaction[], type: CashflowType, money: MoneyFmt) {
  return formatCurrencyBuckets(money,
    transactions
      .filter((transaction) => transaction.transaction_type === type)
      .reduce<Record<Currency, number>>((acc, transaction) => {
        acc[transaction.currency] = (acc[transaction.currency] ?? 0) + transaction.amount;
        return acc;
      }, emptyCurrencyBuckets()),
  );
}

function formatNetCashflow(transactions: CashflowTransaction[], money: MoneyFmt) {
  return formatCurrencyBuckets(money,
    transactions.reduce<Record<Currency, number>>((acc, transaction) => {
      const sign = transaction.transaction_type === "income" ? 1 : -1;
      acc[transaction.currency] = (acc[transaction.currency] ?? 0) + transaction.amount * sign;
      return acc;
    }, emptyCurrencyBuckets()),
  );
}

function formatRecurringMonthlyTotal(expenses: RecurringExpense[], money: MoneyFmt) {
  return formatCurrencyBuckets(money,
    expenses.reduce<Record<Currency, number>>((acc, expense) => {
      const monthlyAmount = expense.frequency === "monthly" ? expense.amount : expense.amount / 12;
      acc[expense.currency] = (acc[expense.currency] ?? 0) + monthlyAmount;
      return acc;
    }, emptyCurrencyBuckets()),
  );
}

function formatRecurringAnnualTotal(expenses: RecurringExpense[], money: MoneyFmt) {
  return formatCurrencyBuckets(money,
    expenses.reduce<Record<Currency, number>>((acc, expense) => {
      const annualAmount = expense.frequency === "monthly" ? expense.amount * 12 : expense.amount;
      acc[expense.currency] = (acc[expense.currency] ?? 0) + annualAmount;
      return acc;
    }, emptyCurrencyBuckets()),
  );
}

function formatDebtPrincipalTotal(debts: Debt[], money: MoneyFmt) {
  return formatCurrencyBuckets(money,
    debts.reduce<Record<Currency, number>>((acc, debt) => {
      acc[debt.currency] = (acc[debt.currency] ?? 0) + debt.remaining_principal;
      return acc;
    }, emptyCurrencyBuckets()),
  );
}

function formatDebtMonthlyPaymentTotal(debts: Debt[], money: MoneyFmt) {
  return formatCurrencyBuckets(money,
    debts.reduce<Record<Currency, number>>((acc, debt) => {
      acc[debt.currency] = (acc[debt.currency] ?? 0) + debt.minimum_payment;
      return acc;
    }, emptyCurrencyBuckets()),
  );
}

type BudgetRow = {
  budget: MonthlyBudget;
  spent: number;
  remaining: number;
  percentUsed: number;
};

type CashflowCalendarEvent = {
  amount: string;
  date: string;
  kind: "income" | "expense" | "recurring" | "debt";
  label: string;
  title: string;
};

function getBudgetRows(budgets: MonthlyBudget[], transactions: CashflowTransaction[], locale: Locale): BudgetRow[] {
  return budgets
    .map((budget) => {
      const spent = transactions
        .filter((transaction) => transaction.transaction_type === "expense")
        .filter((transaction) => transaction.currency === budget.currency)
        .filter((transaction) => budget.category === totalBudgetCategory || transaction.category === budget.category)
        .filter((transaction) => transaction.transaction_date.slice(0, 7) === budget.month.slice(0, 7))
        .reduce((sum, transaction) => sum + transaction.amount, 0);

      return {
        budget,
        spent,
        remaining: budget.amount - spent,
        percentUsed: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
      };
    })
    .sort((a, b) => {
      if (a.remaining < 0 && b.remaining >= 0) return -1;
      if (a.remaining >= 0 && b.remaining < 0) return 1;
      return getCategoryLabel(a.budget.category, locale).localeCompare(getCategoryLabel(b.budget.category, locale));
    });
}

function formatBudgetLimitTotal(rows: BudgetRow[], money: MoneyFmt) {
  return formatCurrencyBuckets(money,
    rows.reduce<Record<Currency, number>>((acc, row) => {
      acc[row.budget.currency] = (acc[row.budget.currency] ?? 0) + row.budget.amount;
      return acc;
    }, emptyCurrencyBuckets()),
  );
}

function formatBudgetSpentTotal(rows: BudgetRow[], money: MoneyFmt) {
  return formatCurrencyBuckets(money,
    rows.reduce<Record<Currency, number>>((acc, row) => {
      acc[row.budget.currency] = (acc[row.budget.currency] ?? 0) + row.spent;
      return acc;
    }, emptyCurrencyBuckets()),
  );
}

function getYearlyCashflowOverview(
  transactions: CashflowTransaction[],
  recurringExpenses: RecurringExpense[],
  debts: Debt[],
): MonthlyCashflowOverview {
  const currentYear = new Date().getFullYear();
  const income = emptyCurrencyBuckets();
  const expenses = emptyCurrencyBuckets();
  const recurring = emptyCurrencyBuckets();
  const debtPayments = emptyCurrencyBuckets();

  transactions
    .filter((transaction) => parseDateOnly(transaction.transaction_date).getFullYear() === currentYear)
    .forEach((transaction) => {
      if (transaction.transaction_type === "income") {
        income[transaction.currency] += transaction.amount;
      } else {
        expenses[transaction.currency] += transaction.amount;
      }
    });

  recurringExpenses.forEach((expense) => {
    const annualAmount = expense.frequency === "monthly" ? expense.amount * 12 : expense.amount;
    recurring[expense.currency] += annualAmount;
  });

  debts.forEach((debt) => {
    debtPayments[debt.currency] += debt.minimum_payment * 12;
  });

  const leftover = emptyCurrencyBuckets();
  (Object.keys(leftover) as Currency[]).forEach((currency) => {
    leftover[currency] = income[currency] - expenses[currency] - recurring[currency] - debtPayments[currency];
  });

  const incomeTotal = currencyBucketTotal(income);
  const fixedTotal = currencyBucketTotal(recurring) + currencyBucketTotal(debtPayments);

  return {
    income,
    expenses,
    recurring,
    debtPayments,
    leftover,
    pressureRatio: incomeTotal > 0 ? (fixedTotal / incomeTotal) * 100 : 0,
  };
}

function hasCurrencyValue(values: CurrencyBuckets) {
  return Object.values(values).some((value) => Math.abs(value) > 0.000001);
}

function formatPressureRatio(overview: MonthlyCashflowOverview) {
  if (!hasCurrencyValue(overview.income)) return "N/A";
  return `${overview.pressureRatio.toFixed(1)}%`;
}

function getDebtPrincipalUsd(debts: Debt[], twdToUsd: CurrencyFxInput) {
  return debts
    .filter((debt) => debt.is_active)
    .reduce((sum, debt) => sum + currencyAmountToUsd(debt.remaining_principal, debt.currency, twdToUsd), 0);
}

function getMonthlyCashflowChartData(transactions: CashflowTransaction[], twdToUsd: CurrencyFxInput, locale: Locale) {
  const monthKeys = getRecentMonthKeys(6);
  const rows = monthKeys.map((monthKey) => ({
    expense: 0,
    income: 0,
    label: formatMonthKey(monthKey, locale),
    monthKey,
  }));

  const rowMap = new Map(rows.map((row) => [row.monthKey, row]));
  transactions.forEach((transaction) => {
    const monthKey = transaction.transaction_date.slice(0, 7);
    const row = rowMap.get(monthKey);
    if (!row) return;
    const value = currencyAmountToUsd(transaction.amount, transaction.currency, twdToUsd);
    if (transaction.transaction_type === "income") row.income += value;
    else row.expense += value;
  });

  return rows;
}

function getExpenseCategoryChartData(transactions: CashflowTransaction[], twdToUsd: CurrencyFxInput, locale: Locale) {
  const totals = transactions
    .filter((transaction) => transaction.transaction_type === "expense")
    .filter((transaction) => isSameMonth(transaction.transaction_date))
    .reduce<Map<string, number>>((acc, transaction) => {
      const current = acc.get(transaction.category) ?? 0;
      acc.set(transaction.category, current + currencyAmountToUsd(transaction.amount, transaction.currency, twdToUsd));
      return acc;
    }, new Map());

  return [...totals.entries()]
    .map(([category, value]) => ({ name: getCategoryLabel(category, locale), value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function getFixedExpenseTrendData(expenses: RecurringExpense[], twdToUsd: CurrencyFxInput, locale: Locale) {
  const monthKeys = getFutureMonthKeys(6);
  return monthKeys.map((monthKey) => {
    const value = expenses
      .filter((expense) => expense.is_active)
      .reduce((sum, expense) => {
        const amountUsd = currencyAmountToUsd(expense.amount, expense.currency, twdToUsd);
        if (expense.frequency === "monthly") return sum + amountUsd;
        return expense.next_due_date.slice(0, 7) === monthKey ? sum + amountUsd : sum;
      }, 0);

    return {
      label: formatMonthKey(monthKey, locale),
      monthKey,
      value,
    };
  });
}

function getSubscriptionAnnualizedData(expenses: RecurringExpense[], twdToUsd: CurrencyFxInput) {
  return expenses
    .filter((expense) => expense.is_active && expense.is_subscription)
    .map((expense) => ({
      name: expense.name,
      value: currencyAmountToUsd(expense.frequency === "monthly" ? expense.amount * 12 : expense.amount, expense.currency, twdToUsd),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function getDebtDeclineData(debts: Debt[], twdToUsd: CurrencyFxInput, locale: Locale) {
  const activeDebts = debts.filter((debt) => debt.is_active);
  const totalPrincipal = activeDebts.reduce((sum, debt) => sum + currencyAmountToUsd(debt.remaining_principal, debt.currency, twdToUsd), 0);
  const monthlyPayment = activeDebts.reduce((sum, debt) => sum + currencyAmountToUsd(debt.minimum_payment, debt.currency, twdToUsd), 0);
  let remaining = totalPrincipal;

  return getFutureMonthKeys(12).map((monthKey, index) => {
    if (index > 0) remaining = Math.max(0, remaining - monthlyPayment);
    return {
      label: formatMonthKey(monthKey, locale),
      monthKey,
      value: remaining,
    };
  });
}

function getNetWorthTrendData(transactions: CashflowTransaction[], currentNetWorthUsd: number, twdToUsd: CurrencyFxInput, locale: Locale) {
  const monthKeys = getRecentMonthKeys(6);
  const monthlyNet = new Map(monthKeys.map((monthKey) => [monthKey, 0]));

  transactions.forEach((transaction) => {
    const monthKey = transaction.transaction_date.slice(0, 7);
    if (!monthlyNet.has(monthKey)) return;
    const sign = transaction.transaction_type === "income" ? 1 : -1;
    monthlyNet.set(monthKey, (monthlyNet.get(monthKey) ?? 0) + currencyAmountToUsd(transaction.amount, transaction.currency, twdToUsd) * sign);
  });

  const totalRecordedNet = [...monthlyNet.values()].reduce((sum, value) => sum + value, 0);
  let runningValue = currentNetWorthUsd - totalRecordedNet;

  return monthKeys.map((monthKey) => {
    runningValue += monthlyNet.get(monthKey) ?? 0;
    return {
      label: formatMonthKey(monthKey, locale),
      monthKey,
      value: runningValue,
    };
  });
}

function getRecentMonthKeys(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return toMonthKey(date);
  });
}

function getFutureMonthKeys(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    return toMonthKey(date);
  });
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(monthKey: string, locale: Locale) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale === "zh" ? "zh-TW" : "en-US", {
    month: "short",
  });
}

function formatMonthYearKey(monthKey: string, locale: Locale) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale === "zh" ? "zh-TW" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

function compactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    compactDisplay: "short",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
    currency: "USD",
  }).format(value);
}


function formatRecurringAnnualizedAmount(expense: RecurringExpense, money: MoneyFmt) {
  const annualAmount = expense.frequency === "monthly" ? expense.amount * 12 : expense.amount;
  return money.fmtAmount(annualAmount, expense.currency);
}

function daysUntil(dateValue: string) {
  const dueDate = parseDateOnly(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
}

function holdingSourceKey(holding: EnrichedHolding) {
  if (holding.asset_type === "cash") {
    return [holding.asset_type, holding.id].join(":");
  }

  const symbol = holding.symbol.toUpperCase();
  return [holding.asset_type, symbol, holding.market_data_id ?? symbol].join(":");
}

function sortDashboardHoldings(holdings: EnrichedHolding[]) {
  const assetOrder: Record<AssetType, number> = {
    stock: 0,
    us_stock: 1,
    tw_stock: 2,
    crypto: 3,
    cash: 4,
  };

  return holdings
    .map((holding, index) => ({ holding, index }))
    .sort((left, right) => assetOrder[left.holding.asset_type] - assetOrder[right.holding.asset_type] || left.index - right.index)
    .map(({ holding }) => holding);
}


function toggleExpanded(current: Set<string>, key: string) {
  const next = new Set(current);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

function UnknownCostLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-titanium">
      {label}
    </span>
  );
}

function formatHoldingQuantity(quantity: number, assetType: AssetType, locale: Locale) {
  if (assetType === "tw_stock") {
    return `${formatQuantityNumber(quantity, 4)} ${locale === "zh" ? "張" : quantity === 1 ? "lot" : "lots"}`;
  }
  if (assetType === "us_stock") {
    return `${formatQuantityNumber(quantity, 8)} ${locale === "zh" ? "股" : quantity === 1 ? "share" : "shares"}`;
  }
  if (assetType === "cash") {
    return formatQuantityNumber(quantity, 2);
  }
  return formatQuantityNumber(quantity, 8);
}

function formatTaiwanShares(lots: number, locale: Locale) {
  const shares = lots * 1000;
  return locale === "zh"
    ? `約 ${formatQuantityNumber(shares, 0)} 股`
    : `Approx. ${formatQuantityNumber(shares, 0)} shares`;
}

function formatQuantityNumber(value: number, maximumFractionDigits: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

function AllocationRow({ holding }: { holding: EnrichedHolding }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-ink">{holding.symbol}</span>
        <span className="text-titanium">{holding.allocationPercent.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full" style={{ width: `${Math.min(100, holding.allocationPercent)}%`, background: "linear-gradient(90deg, var(--gold-light), var(--gold-base))" }} />
      </div>
    </div>
  );
}

function NumericInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className="input-control focus-ring w-full px-3 text-ink"
      inputMode="decimal"
      placeholder="0"
      type="text"
      value={value}
      onBlur={() => {
        if (value === "") onChange("0");
      }}
      onChange={(event) => {
        const next = sanitizeNumericInput(event.target.value, true);
        if (next !== null) onChange(next);
      }}
    />
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
