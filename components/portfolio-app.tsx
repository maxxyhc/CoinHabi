"use client";

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
  ListChecks,
  LogOut,
  Maximize2,
  Music,
  PieChart as PieIcon,
  Plus,
  Play,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
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
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { TradingViewWidget, toTradingViewSymbol } from "@/components/tradingview-widget";
import { WalletTracker } from "@/components/wallet-tracker";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobilePortfolioApp } from "@/components/mobile-portfolio-app";
import {
  aggregateHoldingsForOverview,
  buildFinancialHealthNotes,
  currencyAmountToUsd,
  currencyBucketTotal,
  currencyBucketsToUsd,
  emptyCurrencyBuckets,
  enrichHoldings,
  formatCurrency,
  formatHealthRatio,
  formatPercent,
  getFinancialHealthScore,
  getMonthlyCashflowOverview,
  getPortfolioTotals,
  groupBy,
  isSameMonth,
  parseDateOnly,
  type CurrencyBuckets,
  type MonthlyCashflowOverview,
} from "@/lib/calculations";
import { getDictionary } from "@/lib/i18n";
import type { AssetType, CashflowTransaction, CashflowTransactionInput, CashflowType, CryptoSearchResult, Currency, Debt, DebtInput, DebtType, EnrichedHolding, Holding, HoldingInput, Locale, MarketResponse, MonthlyBudget, MonthlyBudgetInput, RecurringExpense, RecurringExpenseInput, SymbolSearchResult } from "@/lib/types";

type Tab = "dashboard" | "holdings" | "quantities" | "cashflow" | "financialHealth" | "charts" | "analysis" | "settings";

const emptyForm: HoldingInput = {
  asset_type: "us_stock",
  symbol: "",
  name: "",
  quantity: "0",
  average_cost: "0",
  cost_currency: "USD",
  market_data_id: null,
  cost_known: true,
};

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
  category: "food",
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
  if (!method) return locale === "zh" ? "未設定" : "Not set";
  return locale === "zh" ? method.zh : method.en;
}

function createDemoData() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const date = (day: number) => `${currentYear}-${currentMonth}-${String(day).padStart(2, "0")}`;
  const isoNow = new Date().toISOString();

  const holdings: Holding[] = [
    { id: "demo-h-1", user_id: "demo-user", asset_type: "us_stock", symbol: "AAPL", name: "Apple Inc.", quantity: 8, average_cost: 172, cost_currency: "USD", notes: null, market_data_id: "AAPL", source_kind: "manual", source_label: "Manual", source_account_id: null, source_asset_id: null, cost_known: true, created_at: isoNow, updated_at: isoNow },
    { id: "demo-h-2", user_id: "demo-user", asset_type: "tw_stock", symbol: "2330.TW", name: "Taiwan Semiconductor", quantity: 2, average_cost: 880, cost_currency: "TWD", notes: null, market_data_id: "2330.TW", source_kind: "manual", source_label: "Manual", source_account_id: null, source_asset_id: null, cost_known: true, created_at: isoNow, updated_at: isoNow },
    { id: "demo-h-3", user_id: "demo-user", asset_type: "crypto", symbol: "BTC", name: "Bitcoin", quantity: 0.035, average_cost: 42000, cost_currency: "USD", notes: null, market_data_id: "bitcoin", source_kind: "wallet", source_label: "Demo BTC wallet", source_account_id: "demo-wallet-btc", source_asset_id: "demo-btc", cost_known: false, created_at: isoNow, updated_at: isoNow },
    { id: "demo-h-4", user_id: "demo-user", asset_type: "crypto", symbol: "ETH", name: "Ethereum", quantity: 1.4, average_cost: 2400, cost_currency: "USD", notes: null, market_data_id: "ethereum", source_kind: "wallet", source_label: "Demo ETH wallet", source_account_id: "demo-wallet-eth", source_asset_id: "demo-eth", cost_known: false, created_at: isoNow, updated_at: isoNow },
    { id: "demo-h-5", user_id: "demo-user", asset_type: "cash", symbol: "USD", name: "Cash", quantity: 3500, average_cost: 1, cost_currency: "USD", notes: null, market_data_id: null, source_kind: "manual", source_label: "Manual", source_account_id: null, source_asset_id: null, cost_known: true, created_at: isoNow, updated_at: isoNow },
  ];

  const transactions: CashflowTransaction[] = [
    { id: "demo-t-1", user_id: "demo-user", transaction_type: "income", amount: 5200, currency: "USD", category: "salary", description: "Monthly salary", transaction_date: date(5), payment_method: "Bank transfer", notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-t-2", user_id: "demo-user", transaction_type: "expense", amount: 18.5, currency: "USD", category: "food", description: "Lunch", transaction_date: date(8), payment_method: "Credit card", notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-t-3", user_id: "demo-user", transaction_type: "expense", amount: 78, currency: "USD", category: "transport", description: "Gas", transaction_date: date(10), payment_method: "Credit card", notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-t-4", user_id: "demo-user", transaction_type: "expense", amount: 145, currency: "USD", category: "shopping", description: "Household supplies", transaction_date: date(12), payment_method: "Credit card", notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-t-5", user_id: "demo-user", transaction_type: "income", amount: 350, currency: "USD", category: "side_income", description: "Freelance project", transaction_date: date(18), payment_method: "Transfer", notes: null, created_at: isoNow, updated_at: isoNow },
  ];

  const recurringExpenses: RecurringExpense[] = [
    { id: "demo-r-1", user_id: "demo-user", name: "YouTube Premium", amount: 13.99, currency: "USD", category: "subscription", frequency: "monthly", next_due_date: date(20), payment_method: "Credit card", is_active: true, is_subscription: true, usage_status: "active", reminder_days: 3, notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-r-2", user_id: "demo-user", name: "Spotify USA", amount: 12.99, currency: "USD", category: "subscription", frequency: "monthly", next_due_date: date(22), payment_method: "Credit card", is_active: true, is_subscription: true, usage_status: "active", reminder_days: 3, notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-r-3", user_id: "demo-user", name: "Insurance", amount: 960, currency: "USD", category: "insurance", frequency: "yearly", next_due_date: `${currentYear}-11-15`, payment_method: "Bank debit", is_active: true, is_subscription: false, usage_status: "active", reminder_days: 14, notes: null, created_at: isoNow, updated_at: isoNow },
  ];

  const debts: Debt[] = [
    { id: "demo-d-1", user_id: "demo-user", name: "Car loan", debt_type: "car_loan", original_principal: 22000, remaining_principal: 14500, currency: "USD", interest_rate: 5.4, minimum_payment: 420, next_payment_date: date(25), lender: "Demo Bank", is_active: true, notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-d-2", user_id: "demo-user", name: "Credit card plan", debt_type: "credit_card", original_principal: 3200, remaining_principal: 1800, currency: "USD", interest_rate: 18.9, minimum_payment: 160, next_payment_date: date(28), lender: "Demo Card", is_active: true, notes: null, created_at: isoNow, updated_at: isoNow },
  ];

  const budgets: MonthlyBudget[] = [
    { id: "demo-b-1", user_id: "demo-user", month: `${currentYear}-${currentMonth}-01`, category: "food", amount: 650, currency: "USD", notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-b-2", user_id: "demo-user", month: `${currentYear}-${currentMonth}-01`, category: "transport", amount: 300, currency: "USD", notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-b-3", user_id: "demo-user", month: `${currentYear}-${currentMonth}-01`, category: "shopping", amount: 450, currency: "USD", notes: null, created_at: isoNow, updated_at: isoNow },
  ];

  const market: MarketResponse = {
    refreshedAt: isoNow,
    fx: { usdToTwd: 32.2, twdToUsd: 1 / 32.2 },
    quotes: {
      "demo-h-1": { symbol: "AAPL", price: 196.5, currency: "USD", priceUsd: 196.5, dayChangePercent: 0.8, source: "Demo" },
      "demo-h-2": { symbol: "2330.TW", price: 960, currency: "TWD", priceUsd: 960 / 32.2, dayChangePercent: -0.4, source: "Demo" },
      "demo-h-3": { symbol: "BTC", price: 61500, currency: "USD", priceUsd: 61500, dayChangePercent: 1.9, source: "Demo" },
      "demo-h-4": { symbol: "ETH", price: 3350, currency: "USD", priceUsd: 3350, dayChangePercent: -1.1, source: "Demo" },
      "demo-h-5": { symbol: "USD", price: 1, currency: "USD", priceUsd: 1, dayChangePercent: 0, source: "Demo" },
    },
  };

  return { budgets, debts, holdings, market, recurringExpenses, transactions };
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
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudget[]>([]);
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
  const [portfolioName, setPortfolioName] = useState("");
  const priceRequestId = useRef(0);

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
    const storedLocale = window.localStorage.getItem("locale") as Locale | null;
    if (storedLocale === "en" || storedLocale === "zh") {
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
    setHoldings(demoData.holdings);
    setCashflowTransactions(demoData.transactions);
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

    const { data: settingsData, error: settingsError } = await supabase
      .from("user_settings")
      .select("portfolio_name")
      .maybeSingle();

    if (settingsError) {
      if (!settingsError.message.includes("user_settings")) {
        setError(settingsError.message);
      }
    } else {
      setPortfolioName(settingsData?.portfolio_name ?? "");
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
        const response = await fetch("/api/market/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holdings: nextHoldings }),
        });
        if (!response.ok) {
          throw new Error("Price refresh failed");
        }
        const data = (await response.json()) as MarketResponse;
        if (requestId === priceRequestId.current) {
          setMarket((current) => ({
            ...data,
            quotes: { ...(current?.quotes ?? {}), ...data.quotes },
          }));
        }
      } catch (refreshError) {
        if (requestId === priceRequestId.current) {
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
    () => enrichHoldings(holdings, market?.quotes ?? {}, market?.fx.twdToUsd ?? 1 / 32),
    [holdings, market],
  );
  const totals = useMemo(() => getPortfolioTotals(enriched), [enriched]);
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
      cost_currency: holding.cost_currency,
      market_data_id: holding.market_data_id ?? null,
      cost_known: holding.cost_known !== false,
    });
    setActiveTab("holdings");
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

  function resetCashflowForm() {
    setEditingCashflowId(null);
    setCashflowForm({
      ...emptyCashflowForm,
      transaction_date: new Date().toISOString().slice(0, 10),
    });
  }

  function resetRecurringForm() {
    setEditingRecurringId(null);
    setRecurringForm({
      ...emptyRecurringForm,
      next_due_date: new Date().toISOString().slice(0, 10),
    });
  }

  function resetDebtForm() {
    setEditingDebtId(null);
    setDebtForm({
      ...emptyDebtForm,
      next_payment_date: new Date().toISOString().slice(0, 10),
    });
  }

  function resetBudgetForm() {
    setEditingBudgetId(null);
    setBudgetForm({
      ...emptyBudgetForm,
      month: new Date().toISOString().slice(0, 7),
    });
  }

  async function saveHolding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo) {
      setError(locale === "zh" ? "Demo 模式為唯讀，不會儲存變更。" : "Demo mode is read-only. Changes are not saved.");
      return;
    }
    if (!supabase || !userId) {
      setError("Supabase is not ready.");
      return;
    }

    const quantity = Number(form.quantity || 0);
    const averageCost = Number(form.average_cost || 0);
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

    if (editingId && editingWalletCost) {
      const { error: costError } = await supabase
        .from("holdings")
        .update({
          average_cost: averageCost,
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

    const payload = {
      ...form,
      user_id: userId,
      symbol: form.symbol.toUpperCase().trim(),
      name: form.name.trim() || form.symbol.toUpperCase().trim(),
      quantity,
      average_cost: averageCost,
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

  async function saveCashflowTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo) {
      setError(locale === "zh" ? "Demo 模式為唯讀，不會儲存變更。" : "Demo mode is read-only. Changes are not saved.");
      return;
    }
    if (!supabase || !userId) {
      setError("Supabase is not ready.");
      return;
    }

    const amount = Number(cashflowForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(locale === "zh" ? "金額必須大於 0。" : "Amount must be greater than 0.");
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

    const { error: saveError } = await query;
    if (saveError) {
      setError(saveError.message);
      return;
    }

    resetCashflowForm();
    await loadHoldings();
  }

  async function saveRecurringExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo) {
      setError(locale === "zh" ? "Demo 模式為唯讀，不會儲存變更。" : "Demo mode is read-only. Changes are not saved.");
      return;
    }
    if (!supabase || !userId) {
      setError("Supabase is not ready.");
      return;
    }

    const amount = Number(recurringForm.amount || 0);
    const reminderDays = Number(recurringForm.reminder_days || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(locale === "zh" ? "金額必須大於 0。" : "Amount must be greater than 0.");
      return;
    }
    if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 60) {
      setError(locale === "zh" ? "提醒天數必須是 0 到 60 之間的整數。" : "Reminder days must be an integer from 0 to 60.");
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
      setError(locale === "zh" ? "請輸入固定支出名稱。" : "Please enter a recurring expense name.");
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
      setError(locale === "zh" ? "Demo 模式為唯讀，不會儲存變更。" : "Demo mode is read-only. Changes are not saved.");
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
      setError(locale === "zh" ? "請確認本金、利率與付款金額都是有效數字。" : "Principal, interest rate, and payment must be valid numbers.");
      return;
    }
    if (remainingPrincipal < 0 || originalPrincipal < 0 || interestRate < 0 || minimumPayment < 0) {
      setError(locale === "zh" ? "債務金額、利率與付款金額不能小於 0。" : "Debt amounts, interest rate, and payment cannot be negative.");
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
      setError(locale === "zh" ? "請輸入貸款或債務名稱。" : "Please enter a debt name.");
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
      setError(locale === "zh" ? "Demo 模式為唯讀，不會儲存變更。" : "Demo mode is read-only. Changes are not saved.");
      return;
    }
    if (!supabase || !userId) {
      setError("Supabase is not ready.");
      return;
    }

    const amount = Number(budgetForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(locale === "zh" ? "預算金額必須大於 0。" : "Budget amount must be greater than 0.");
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
        ? "Please run supabase/migrations/0009_monthly_budgets.sql in Supabase SQL Editor."
        : saveError.message);
      return;
    }

    resetBudgetForm();
    await loadHoldings();
  }

  async function deleteHolding(id: string) {
    if (demo) {
      setError(locale === "zh" ? "Demo 模式為唯讀，不會刪除資料。" : "Demo mode is read-only. Nothing was deleted.");
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

  async function deleteCashflowTransaction(id: string) {
    if (demo) {
      setError(locale === "zh" ? "Demo 模式為唯讀，不會刪除資料。" : "Demo mode is read-only. Nothing was deleted.");
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
      setError(locale === "zh" ? "Demo 模式為唯讀，不會刪除資料。" : "Demo mode is read-only. Nothing was deleted.");
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
      setError(locale === "zh" ? "Demo 模式為唯讀，不會刪除資料。" : "Demo mode is read-only. Nothing was deleted.");
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
      setError(locale === "zh" ? "Demo 模式為唯讀，不會刪除資料。" : "Demo mode is read-only. Nothing was deleted.");
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="glass-panel apple-card p-8 text-titanium">Loading portfolio...</div>
      </main>
    );
  }

  if (mobileLayout === null) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <div className="glass-panel apple-card p-8 text-titanium">Loading interface...</div>
      </main>
    );
  }

  if (mobileLayout) {
    return (
      <MobilePortfolioApp
        budgets={monthlyBudgets}
        cashflowForm={cashflowForm}
        debtForm={debtForm}
        debts={debts}
        demo={demo}
        editingHolding={Boolean(editingId)}
        enriched={enriched}
        error={error}
        form={form}
        locale={locale}
        portfolioName={portfolioName}
        recurringExpenses={recurringExpenses}
        recurringForm={recurringForm}
        refreshedAt={market?.refreshedAt}
        refreshing={refreshing}
        transactions={cashflowTransactions}
        twdToUsd={market?.fx.twdToUsd ?? 1 / 32}
        userEmail={userEmail}
        userId={userId}
        onDeleteHolding={deleteHolding}
        onHoldingsChanged={loadHoldings}
        onLocaleChange={changeLocale}
        onPortfolioNameChange={changePortfolioName}
        onRefresh={() => refreshPrices()}
        onResetCashflow={resetCashflowForm}
        onResetDebt={resetDebtForm}
        onResetHolding={resetForm}
        onResetRecurring={resetRecurringForm}
        onSaveCashflow={saveCashflowTransaction}
        onSaveDebt={saveDebt}
        onSaveHolding={saveHolding}
        onSaveRecurring={saveRecurringExpense}
        onSignOut={signOut}
        onUpdateCashflow={updateCashflowForm}
        onUpdateDebt={updateDebtForm}
        onUpdateHolding={updateForm}
        onUpdateRecurring={updateRecurringForm}
      />
    );
  }

  return (
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
              <NavSection label={locale === "zh" ? "投資" : "Investing"}>
                <NavButton active={activeTab === "dashboard"} icon={<LayoutDashboard size={18} />} label={t.dashboard} onClick={() => setActiveTab("dashboard")} />
                <NavButton active={activeTab === "holdings"} icon={<WalletCards size={18} />} label={t.holdings} onClick={() => setActiveTab("holdings")} />
                <NavButton active={activeTab === "quantities"} icon={<ListChecks size={18} />} label={t.quantities} onClick={() => setActiveTab("quantities")} />
                <NavButton active={activeTab === "analysis"} icon={<BarChart3 size={18} />} label={t.analysis} onClick={() => setActiveTab("analysis")} />
              </NavSection>
              <NavSection label={locale === "zh" ? "記帳" : "Cashflow"}>
                <NavButton active={activeTab === "cashflow"} icon={<ReceiptText size={18} />} label={t.cashflow} onClick={() => setActiveTab("cashflow")} />
                <NavButton active={activeTab === "financialHealth"} icon={<Activity size={18} />} label={t.financialHealth} onClick={() => setActiveTab("financialHealth")} />
                <NavButton active={activeTab === "charts"} icon={<LineChartIcon size={18} />} label={t.charts} onClick={() => setActiveTab("charts")} />
              </NavSection>
              <NavSection label={locale === "zh" ? "系統" : "System"}>
                <NavButton active={activeTab === "settings"} icon={<Settings size={18} />} label={t.settings} onClick={() => setActiveTab("settings")} />
              </NavSection>
            </nav>

            <div className="mt-5 shrink-0 space-y-2.5 lg:mt-3 lg:border-t lg:border-line lg:px-0.5 lg:pb-1 lg:pt-3">
              <div className="subtle-panel apple-card-sm p-3.5">
                <p className="text-xs uppercase text-titanium">{demo ? "Demo mode" : t.signedIn}</p>
                <p className="mt-1 truncate text-sm text-ink">{demo ? (locale === "zh" ? "範例資料，唯讀展示" : "Sample data, read-only") : userEmail}</p>
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
            locale={locale}
            refreshedAt={market?.refreshedAt}
            refreshing={refreshing}
            t={t}
            onRefresh={() => refreshPrices()}
            onLocaleChange={changeLocale}
          />

          {error && (
            <div className="apple-card-sm border border-rose/30 bg-rose/10 p-4 text-sm text-rose">
              {error}
            </div>
          )}

          {activeTab === "dashboard" && (
            <DashboardView enriched={enriched} assetMix={assetMix} locale={locale} totals={totals} t={t} onEdit={startEdit} />
          )}

          {activeTab === "holdings" && (
            <HoldingsView
              demo={demo}
              editingId={editingId}
              enriched={enriched}
              form={form}
              editingWalletCost={editingWalletCost}
              locale={locale}
              t={t}
              userId={userId}
              onDelete={deleteHolding}
              onEdit={startEdit}
              onReset={resetForm}
              onSave={saveHolding}
              onUpdateForm={updateForm}
              onHoldingsChanged={loadHoldings}
            />
          )}

          {activeTab === "quantities" && (
            <QuantitiesView enriched={aggregateHoldingsForOverview(enriched)} locale={locale} t={t} />
          )}

          {activeTab === "cashflow" && (
            <CashflowView
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
              twdToUsd={market?.fx.twdToUsd ?? 1 / 32}
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
              twdToUsd={market?.fx.twdToUsd ?? 1 / 32}
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
    <header className="glass-panel apple-card flex items-center justify-between gap-3 px-3.5 py-3 sm:flex-wrap sm:gap-4 sm:px-6 sm:py-4">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl font-semibold capitalize tracking-[-0.035em] text-ink sm:text-2xl">{title}</h2>
        <p className="mt-1 truncate text-[11px] text-titanium sm:text-xs">
          {t.lastUpdated}: {refreshedAt ? new Date(refreshedAt).toLocaleString() : "Pending first refresh"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:flex-wrap sm:gap-3">
        <ThemeToggle compact />
        <div className="pill-panel hidden p-1 min-[390px]:flex">
          <button
            className={clsx("focus-ring rounded-full px-2.5 py-2 text-xs sm:px-3 sm:text-sm", locale === "zh" ? "primary-button" : "text-titanium")}
            onClick={() => onLocaleChange("zh")}
            type="button"
          >
            中文
          </button>
          <button
            className={clsx("focus-ring rounded-full px-2.5 py-2 text-xs sm:px-3 sm:text-sm", locale === "en" ? "primary-button" : "text-titanium")}
            onClick={() => onLocaleChange("en")}
            type="button"
          >
            EN
          </button>
        </div>
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
  locale,
  totals,
  t,
  onEdit,
}: {
  enriched: EnrichedHolding[];
  assetMix: Array<{ name: string; value: number }>;
  locale: Locale;
  totals: ReturnType<typeof getPortfolioTotals>;
  t: ReturnType<typeof getDictionary>;
  onEdit: (holding: Holding) => void;
}) {
  const overviewHoldings = useMemo(() => aggregateHoldingsForOverview(enriched), [enriched]);
  const sourceMap = useMemo(() => buildSourceMap(enriched), [enriched]);
  const [chartKey, setChartKey] = useState("");
  const [tradingViewTheme, setTradingViewTheme] = useState<"dark" | "light">("light");
  const selectedChartHolding = overviewHoldings.find((holding) => holdingSourceKey(holding) === chartKey) ?? overviewHoldings[0] ?? null;
  const tradingViewSymbol = selectedChartHolding ? toTradingViewSymbol(selectedChartHolding) : null;
  const leaders = [...overviewHoldings].sort((a, b) => b.gainPercent - a.gainPercent).slice(0, 3);
  const laggards = [...overviewHoldings].sort((a, b) => a.gainPercent - b.gainPercent).slice(0, 3);

  useEffect(() => {
    const updateTheme = () => setTradingViewTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributeFilter: ["data-theme"], attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!overviewHoldings.length) {
      setChartKey("");
      return;
    }
    if (!overviewHoldings.some((holding) => holdingSourceKey(holding) === chartKey)) {
      setChartKey(holdingSourceKey(overviewHoldings[0]));
    }
  }, [chartKey, overviewHoldings]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard primary label={t.totalValue} value={formatCurrency(totals.totalValue)} icon={<CircleDollarSign size={20} />} />
        <MetricCard label={t.totalGain} value={formatCurrency(totals.totalGain)} trend={totals.totalGain} icon={<Activity size={20} />} />
        <MetricCard label={t.dayChange} value={formatCurrency(totals.dayChange)} detail={formatPercent(totals.dayChangePercent)} trend={totals.dayChange} icon={<RefreshCw size={20} />} />
        <MetricCard label={t.returnRate} value={formatPercent(totals.totalReturn)} trend={totals.totalReturn} icon={<BarChart3 size={20} />} />
      </div>

      <section className="glass-panel apple-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-ink">TradingView</h3>
            <p className="mt-1 text-sm text-titanium">
              {locale === "zh" ? "免費嵌入圖表，只作視覺參考，不參與市值或損益計算。" : "Free embedded chart for visual reference only; portfolio pricing still uses Yahoo/CoinGecko."}
            </p>
          </div>
          <select
            className="input-control focus-ring min-w-[180px] px-3 text-sm"
            value={selectedChartHolding ? holdingSourceKey(selectedChartHolding) : ""}
            onChange={(event) => setChartKey(event.target.value)}
          >
            {overviewHoldings.map((holding) => (
              <option key={holdingSourceKey(holding)} value={holdingSourceKey(holding)}>
                {holding.symbol} · {holding.name}
              </option>
            ))}
          </select>
        </div>
        <TradingViewWidget locale={locale} symbol={tradingViewSymbol} theme={tradingViewTheme} />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <section className="glass-panel apple-card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-ink">{t.holdings}</h3>
              <p className="mt-1 text-sm text-titanium">{overviewHoldings.length} assets</p>
            </div>
          </div>
          <HoldingsTable
            allowEdit={false}
            compact
            enriched={overviewHoldings}
            sourceMap={sourceMap}
            t={t}
            onDelete={() => undefined}
            onEdit={onEdit}
          />
        </section>

        <section className="glass-panel apple-card p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <PieIcon size={20} style={{ color: "var(--accent)" }} />
            <h3 className="text-xl font-semibold text-ink">{t.assetMix}</h3>
          </div>
          <ChartPanel data={assetMix.map((item) => ({ ...item, name: t[item.name as AssetType] }))} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <RankPanel title={t.leaders} holdings={leaders} t={t} />
        <RankPanel title={t.laggards} holdings={laggards} t={t} />
      </div>
    </div>
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
  twdToUsd: number;
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
            <p className="text-sm font-medium text-titanium">{zh ? "把記帳、固定支出、負債與投資整理成視覺圖表" : "Visual overview of cashflow, recurring costs, debt, and portfolio data"}</p>
            <h3 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-ink">{zh ? "圖表" : "Charts"}</h3>
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
        <ChartCard title={zh ? "每月收入 vs 支出" : "Monthly income vs expense"} subtitle={zh ? "依交易日期彙整最近 6 個月份。" : "Grouped by transaction date for the last 6 months."} isEmpty={!monthlyCashflow.some((item) => item.income || item.expense)}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyCashflow}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => compactUsd(Number(value))} tickLine={false} axisLine={false} width={54} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="income" name={zh ? "收入" : "Income"} fill="rgb(var(--mint))" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expense" name={zh ? "支出" : "Expense"} fill="rgb(var(--rose))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={zh ? "支出分類圓餅圖" : "Expense category pie"} subtitle={zh ? "顯示本月支出分類占比。" : "Shows this month's expense mix by category."} isEmpty={!expenseCategoryData.length}>
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

        <ChartCard title={zh ? "固定支出趨勢" : "Fixed expense trend"} subtitle={zh ? "依目前啟用的固定支出估算未來 6 個月。" : "Estimated for the next 6 months from active recurring expenses."} isEmpty={!fixedExpenseTrend.some((item) => item.value)}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={fixedExpenseTrend}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => compactUsd(Number(value))} tickLine={false} axisLine={false} width={54} />
              <Tooltip content={<MoneyTooltip />} />
              <Line type="monotone" dataKey="value" name={zh ? "固定支出" : "Fixed expenses"} stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={zh ? "訂閱年化成本" : "Subscription annualized cost"} subtitle={zh ? "把月繳與年繳訂閱都換成年成本。" : "Monthly and yearly subscriptions converted to annual cost."} isEmpty={!subscriptionAnnualized.length}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={subscriptionAnnualized} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => compactUsd(Number(value))} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={110} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="value" name={zh ? "年化成本" : "Annualized cost"} fill="var(--accent)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={zh ? "負債下降曲線" : "Debt decline curve"} subtitle={zh ? "依目前剩餘本金與最低付款粗估 12 個月，不含利息變動。" : "12-month estimate from current principal and minimum payments, excluding interest changes."} isEmpty={!debtDecline.some((item) => item.value)}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={debtDecline}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => compactUsd(Number(value))} tickLine={false} axisLine={false} width={54} />
              <Tooltip content={<MoneyTooltip />} />
              <Line type="monotone" dataKey="value" name={zh ? "剩餘負債" : "Remaining debt"} stroke="rgb(var(--rose))" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={zh ? "淨資產趨勢" : "Net worth trend"} subtitle={zh ? "用目前淨資產與最近 6 個月記帳現金流回推估算。" : "Estimated from current net worth and the last 6 months of recorded cashflow."} isEmpty={!netWorthTrend.some((item) => item.value)}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={netWorthTrend}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => compactUsd(Number(value))} tickLine={false} axisLine={false} width={54} />
              <Tooltip content={<MoneyTooltip />} />
              <Line type="monotone" dataKey="value" name={zh ? "估算淨資產" : "Estimated net worth"} stroke="rgb(var(--mint))" strokeWidth={3} dot={{ r: 4 }} />
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
  twdToUsd: number;
}) {
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
  const healthScore = getFinancialHealthScore({
    dataIssues,
    debtIncomeRatio,
    fixedPressure,
    savingsRate,
  });
  const healthTone = healthScore >= 80 ? "text-mint" : healthScore >= 60 ? "text-amber" : "text-rose";
  const healthLabel = healthScore >= 80
    ? (zh ? "穩健" : "Strong")
    : healthScore >= 60
      ? (zh ? "可改善" : "Needs attention")
      : (zh ? "需優先整理" : "Needs work");
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
      <section className="glass-panel apple-card relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-[var(--accent)] opacity-[0.055] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-[42%] h-px w-1/3 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-40"
        />
        <div className="relative grid grid-cols-1 gap-7 px-6 py-7 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_470px] lg:items-center lg:gap-10">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/10 px-3 py-1.5 text-xs font-semibold text-titanium">
              <Activity aria-hidden="true" className="text-[var(--accent)]" size={14} />
              {zh ? "投資與現金流整合視圖" : "Portfolio and cashflow overview"}
            </div>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-ink sm:text-4xl">
              {zh ? "財務健康" : "Financial health"}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-titanium">
              {zh
                ? "這裡用現有資料估算淨資產、儲蓄率、固定支出壓力與負債收入比。它是管理提醒，不是投資建議。"
                : "This estimates net worth, savings rate, fixed-cost pressure, and debt-to-income from your existing data. It is a planning view, not investment advice."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { icon: <CircleDollarSign aria-hidden="true" size={14} />, label: zh ? "資產" : "Assets" },
                { icon: <BarChart3 aria-hidden="true" size={14} />, label: zh ? "收支" : "Cashflow" },
                { icon: <ReceiptText aria-hidden="true" size={14} />, label: zh ? "負債" : "Debt" },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-titanium"
                >
                  {item.icon}
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <FinancialHealthGauge
            label={healthLabel}
            locale={locale}
            score={healthScore}
            tone={healthTone}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label={zh ? "淨資產" : "Net worth"} value={formatCurrency(netWorthUsd)} trend={netWorthUsd} detail={zh ? "投資市值 - 未償負債" : "Portfolio value minus debt"} icon={<CircleDollarSign size={20} />} />
        <MetricCard label={zh ? "本月儲蓄率" : "Savings rate"} value={formatHealthRatio(savingsRate)} trend={savingsRate ?? undefined} detail={zh ? "預估結餘 / 本月收入" : "Leftover divided by income"} icon={<BarChart3 size={20} />} />
        <MetricCard label={zh ? "固定支出壓力" : "Fixed pressure"} value={formatHealthRatio(fixedPressure)} trend={fixedPressure === null ? undefined : -fixedPressure} detail={zh ? "固定支出 + 債務最低付款" : "Recurring plus debt minimums"} icon={<RefreshCw size={20} />} />
        <MetricCard label={zh ? "負債收入比" : "Debt-to-income"} value={formatHealthRatio(debtIncomeRatio)} trend={debtIncomeRatio === null ? undefined : -debtIncomeRatio} detail={zh ? "債務最低付款 / 本月收入" : "Debt minimums divided by income"} icon={<Activity size={20} />} />
        <MetricCard label={zh ? "總負債" : "Total debt"} value={formatCurrency(debtPrincipalUsd)} trend={debtPrincipalUsd ? -debtPrincipalUsd : undefined} detail={activeDebts.length ? (zh ? `${activeDebts.length} 筆啟用債務` : `${activeDebts.length} active debts`) : (zh ? "尚未記錄債務" : "No active debts")} icon={<ReceiptText size={20} />} />
        <MetricCard label={zh ? "資料完整度" : "Data quality"} value={dataIssues ? `${dataIssues}` : (zh ? "良好" : "Good")} trend={dataIssues ? -dataIssues : 1} detail={zh ? "未知成本或缺價格筆數" : "Unknown cost or missing price count"} icon={<ShieldCheck size={20} />} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel apple-card p-5 sm:p-6">
          <h3 className="text-xl font-semibold text-ink">{zh ? "健康提示" : "Health notes"}</h3>
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
          <h3 className="text-xl font-semibold text-ink">{zh ? "目前組成" : "Current inputs"}</h3>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-panel/70">
            <HealthRow label={zh ? "投資市值" : "Portfolio value"} value={formatCurrency(totals.totalValue)} />
            <HealthRow label={zh ? "未償負債" : "Outstanding debt"} value={formatCurrency(debtPrincipalUsd)} />
            <HealthRow label={zh ? "本月收入" : "Monthly income"} value={formatCurrency(incomeUsd)} />
            <HealthRow label={zh ? "本月預估結餘" : "Estimated leftover"} value={formatCurrency(leftoverUsd)} />
            <HealthRow label={zh ? "預算超支分類" : "Over-budget categories"} value={`${overBudgetRows.length}`} />
            <HealthRow label={zh ? "可檢查訂閱" : "Subscriptions to review"} value={`${subscriptionsToReview.length}`} />
          </div>
        </section>
      </div>
    </div>
  );
}

function FinancialHealthGauge({
  label,
  locale,
  score,
  tone,
}: {
  label: string;
  locale: Locale;
  score: number;
  tone: string;
}) {
  const zh = locale === "zh";
  const clampedScore = Math.max(0, Math.min(100, score));
  const centerX = 110;
  const centerY = 110;
  const radius = 78;
  const startAngle = 135;
  const sweepAngle = 270;
  const nextTarget = clampedScore >= 80 ? 100 : clampedScore >= 60 ? 80 : 60;
  const pointsToTarget = nextTarget - clampedScore;
  const targetLabel = clampedScore >= 80
    ? (zh ? "滿分" : "perfect")
    : clampedScore >= 60
      ? (zh ? "穩健" : "strong")
      : (zh ? "留意區" : "attention");
  const segments = [
    { from: 0, to: 58, color: "rgb(var(--rose))" },
    { from: 60, to: 78, color: "rgb(var(--amber))" },
    { from: 80, to: 100, color: "rgb(var(--mint))" },
  ];
  const pointOnArc = (value: number, arcRadius = radius) => {
    const angle = (startAngle + (value / 100) * sweepAngle) * (Math.PI / 180);
    return {
      x: centerX + Math.cos(angle) * arcRadius,
      y: centerY + Math.sin(angle) * arcRadius,
    };
  };
  const arcPath = (from: number, to: number, arcRadius = radius) => {
    const start = pointOnArc(from, arcRadius);
    const end = pointOnArc(to, arcRadius);
    const arcSweep = ((to - from) / 100) * sweepAngle;
    return `M ${start.x} ${start.y} A ${arcRadius} ${arcRadius} 0 ${arcSweep > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
  };
  const progressEnd = pointOnArc(Math.max(clampedScore, 0.5));

  return (
    <div
      aria-label={`${zh ? "健康分數" : "Health score"} ${clampedScore} / 100, ${label}`}
      className="subtle-panel apple-card-sm relative w-full max-w-[470px] overflow-hidden p-5 sm:p-6"
      role="img"
    >
      <div
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full opacity-[0.08] blur-3xl",
          clampedScore >= 80 ? "bg-mint" : clampedScore >= 60 ? "bg-amber" : "bg-rose",
        )}
      />
      <div className="relative flex items-center gap-5">
        <svg aria-hidden="true" className="h-[174px] w-[174px] shrink-0" viewBox="0 0 220 220">
          <defs>
            <filter id="health-score-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <path
            d={arcPath(0, 100)}
            fill="none"
            opacity="0.13"
            stroke="rgb(var(--titanium))"
            strokeLinecap="round"
            strokeWidth="13"
          />
          {segments.map((segment) => (
            <path
              key={segment.from}
              d={arcPath(segment.from, segment.to, 94)}
              fill="none"
              opacity="0.72"
              stroke={segment.color}
              strokeLinecap="round"
              strokeWidth="5"
            />
          ))}
          <path
            className={tone}
            d={arcPath(0, Math.max(clampedScore, 0.5))}
            fill="none"
            opacity="0.22"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="18"
            filter="url(#health-score-glow)"
          />
          <path
            className={tone}
            d={arcPath(0, Math.max(clampedScore, 0.5))}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="11"
          />
          <circle
            className={tone}
            cx={progressEnd.x}
            cy={progressEnd.y}
            fill="var(--surface-raised)"
            r="6.5"
            stroke="currentColor"
            strokeWidth="4"
          />
          <text
            className={tone}
            fill="currentColor"
            fontSize="52"
            fontWeight="700"
            letterSpacing="-3"
            textAnchor="middle"
            x={centerX}
            y="111"
          >
            {clampedScore}
          </text>
          <text
            fill="rgb(var(--titanium))"
            fontSize="12"
            fontWeight="600"
            letterSpacing="1.2"
            textAnchor="middle"
            x={centerX}
            y="133"
          >
            / 100
          </text>
          <text
            fill="rgb(var(--titanium))"
            fontSize="10"
            fontWeight="600"
            letterSpacing="0.8"
            textAnchor="middle"
            x={centerX}
            y="174"
          >
            {zh ? "健康分數" : "HEALTH SCORE"}
          </text>
        </svg>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={clsx("flex h-8 w-8 items-center justify-center rounded-full bg-white/10", tone)}>
              <ShieldCheck aria-hidden="true" size={17} />
            </span>
            <p className="text-sm font-medium text-titanium">{zh ? "財務狀態" : "Financial status"}</p>
          </div>
          <p className="mt-4 whitespace-nowrap text-2xl font-semibold leading-tight tracking-[-0.04em] text-ink">{label}</p>
          <p className="mt-2 text-sm leading-5 text-titanium">
            {pointsToTarget > 0
              ? (zh ? `再 ${pointsToTarget} 分即可達${targetLabel}` : `${pointsToTarget} points to ${targetLabel}`)
              : (zh ? "目前已達最高評級" : "You are in the top range")}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden="true">
            <span className="h-1.5 rounded-full bg-rose opacity-75" />
            <span className="h-1.5 rounded-full bg-amber opacity-80" />
            <span className="h-1.5 rounded-full bg-mint opacity-80" />
          </div>
          <div className="mt-2 grid grid-cols-3 text-[10px] font-medium text-titanium">
            <span>{zh ? "改善" : "Build"}</span>
            <span className="text-center">{zh ? "留意" : "Attention"}</span>
            <span className="text-right">{zh ? "穩健" : "Strong"}</span>
          </div>
        </div>
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
            <h3 className="text-xl font-semibold text-ink">{zh ? "月曆" : "Calendar"}</h3>
            <p className="mt-1 text-sm text-titanium">{zh ? "查看收入、支出、固定扣款與債務付款日期。" : "Income, expenses, recurring charges, and debt payments."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="focus-ring rounded-full border border-line px-3 py-2 text-sm text-titanium hover:text-ink" onClick={() => changeMonth(-1)} type="button">
            {zh ? "上月" : "Prev"}
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
                  <Field label={zh ? "年份" : "Year"}>
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
                  <Field label={zh ? "月份" : "Month"}>
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
                  {zh ? "完成" : "Done"}
                </button>
              </div>
            )}
          </div>
          <button className="focus-ring rounded-full border border-line px-3 py-2 text-sm text-titanium hover:text-ink" onClick={() => changeMonth(1)} type="button">
            {zh ? "下月" : "Next"}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-full border border-line bg-panel/70 p-1 md:inline-grid md:grid-cols-4">
        {[
          { id: "all", label: zh ? "全部" : "All" },
          { id: "transactions", label: zh ? "收入 / 支出" : "Income / Expense" },
          { id: "recurring", label: zh ? "固定 / 訂閱" : "Recurring" },
          { id: "debt", label: zh ? "貸款 / 債務" : "Debt" },
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
              <p className="rounded-2xl border border-line bg-panel/70 p-4 text-sm text-titanium">{zh ? "這天在目前篩選下沒有紀錄或付款提醒。" : "No records or payment reminders for this day in the current filter."}</p>
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
            <CalendarLegendDot className="bg-mint" label={zh ? "收入" : "Income"} />
            <CalendarLegendDot className="bg-rose" label={zh ? "支出" : "Expense"} />
            <CalendarLegendDot className="bg-[var(--accent)]" label={zh ? "固定" : "Recurring"} />
            <CalendarLegendDot className="bg-titanium" label={zh ? "債務" : "Debt"} />
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
  const zh = locale === "zh";
  const [cashflowMode, setCashflowMode] = useState<"transactions" | "recurring" | "debts" | "budgets">("transactions");
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
  const todayTotal = formatCashflowTotals(todayExpenses, "expense");
  const netTotal = formatNetCashflow(monthTransactions);
  const recurringMonthlyTotal = formatRecurringMonthlyTotal(activeRecurringExpenses);
  const subscriptionAnnualTotal = formatRecurringAnnualTotal(activeSubscriptions);
  const activeDebts = debts.filter((debt) => debt.is_active);
  const totalDebtPrincipal = formatDebtPrincipalTotal(activeDebts);
  const totalDebtMonthlyPayment = formatDebtMonthlyPaymentTotal(activeDebts);
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
    () => getCashflowCalendarEvents(transactions, activeRecurringExpenses, activeDebts, locale),
    [activeDebts, activeRecurringExpenses, locale, transactions],
  );
  const categoryOptions = cashflowCategories[form.transaction_type];
  const transactionHistoryTitle = transactionHistoryFilter === "income"
    ? (zh ? "本月收入明細" : "Monthly income details")
    : transactionHistoryFilter === "expense"
      ? (zh ? "本月支出明細" : "Monthly expense details")
      : transactionHistoryFilter === "today"
        ? (zh ? "今天花費明細" : "Today's expense details")
        : (zh ? "收入 / 支出歷史紀錄" : "Income / Expense History");
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
            <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{overviewMode === "monthly" ? (zh ? "每月現金流總覽" : "Monthly cashflow overview") : (zh ? "年現金流總覽" : "Yearly cashflow overview")}</h3>
            <p className="mt-1 text-sm text-titanium">
              {overviewMode === "monthly"
                ? (zh
                  ? "整合本月收入、支出、固定扣款與債務最低付款。不同幣別會分開顯示。"
                  : "Combines this month's income, expenses, recurring bills, and minimum debt payments. Currencies stay separated.")
                : (zh
                  ? "整合今年收入、支出，並用固定支出與債務最低付款做年化估算。"
                  : "Combines this year's income and expenses with annualized recurring bills and debt minimums.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="focus-ring h-9 rounded-full border border-line bg-panel px-3 pr-8 text-sm text-ink"
              value={overviewMode}
              onChange={(event) => setOverviewMode(event.target.value as "monthly" | "yearly")}
            >
              <option value="monthly">{zh ? "每月現金流總覽" : "Monthly cashflow overview"}</option>
              <option value="yearly">{zh ? "年現金流總覽" : "Yearly cashflow overview"}</option>
            </select>
            <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-titanium">
              {overviewPeriodLabel}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            actionLabel={overviewMode === "monthly" ? (zh ? "查看本月收入明細" : "View monthly income details") : undefined}
            icon={<ReceiptText size={20} />}
            label={overviewMode === "monthly" ? (zh ? "本月收入" : "Monthly income") : (zh ? "今年收入" : "Yearly income")}
            onClick={overviewMode === "monthly" ? () => openTransactionHistory("income") : undefined}
            trend={1}
            value={formatCurrencyBuckets(overview.income)}
          />
          <MetricCard
            actionLabel={overviewMode === "monthly" ? (zh ? "查看本月支出明細" : "View monthly expense details") : undefined}
            icon={<ReceiptText size={20} />}
            label={overviewMode === "monthly" ? (zh ? "本月支出" : "Monthly expenses") : (zh ? "今年支出" : "Yearly expenses")}
            onClick={overviewMode === "monthly" ? () => openTransactionHistory("expense") : undefined}
            trend={-1}
            value={formatCurrencyBuckets(overview.expenses)}
          />
          <MetricCard
            actionLabel={zh ? "查看固定支出與訂閱明細" : "View recurring expense details"}
            icon={<RefreshCw size={20} />}
            label={overviewMode === "monthly" ? (zh ? "固定支出" : "Recurring") : (zh ? "年化固定支出" : "Annualized recurring")}
            onClick={() => setExpandedList("recurring")}
            trend={hasCurrencyValue(overview.recurring) ? -1 : undefined}
            value={formatCurrencyBuckets(overview.recurring)}
          />
          <MetricCard
            actionLabel={zh ? "查看貸款與債務明細" : "View loan and debt details"}
            icon={<Activity size={20} />}
            label={overviewMode === "monthly" ? (zh ? "債務最低付款" : "Debt minimums") : (zh ? "年化債務最低付款" : "Annualized debt minimums")}
            onClick={() => setExpandedList("debts")}
            trend={hasCurrencyValue(overview.debtPayments) ? -1 : undefined}
            value={formatCurrencyBuckets(overview.debtPayments)}
          />
          <MetricCard label={zh ? "預估結餘" : "Estimated leftover"} value={formatCurrencyBuckets(overview.leftover)} trend={currencyBucketTotal(overview.leftover)} icon={<CircleDollarSign size={20} />} />
          <MetricCard label={zh ? "固定壓力" : "Fixed pressure"} value={formatPressureRatio(overview)} trend={-overview.pressureRatio} icon={<BarChart3 size={20} />} />
        </div>
      </section>

      <div className="cashflow-mode-switcher grid max-w-[920px] grid-cols-2 gap-1.5 rounded-[22px] border border-line bg-[var(--surface-muted)] p-1.5 sm:grid-cols-4 sm:gap-1 sm:rounded-full sm:p-1">
        {[
          { icon: <ReceiptText size={17} />, id: "transactions", label: zh ? "收入 / 支出" : "Income / Expense" },
          { icon: <RefreshCw size={17} />, id: "recurring", label: zh ? "固定支出 / 訂閱" : "Recurring / Subscriptions" },
          { icon: <Activity size={17} />, id: "debts", label: zh ? "貸款 / 債務" : "Loans / Debt" },
          { icon: <BarChart3 size={17} />, id: "budgets", label: zh ? "預算" : "Budgets" },
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

      {cashflowMode === "transactions" && (
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[440px_minmax(0,1fr)] 2xl:grid-cols-[470px_minmax(0,1fr)]">
        <section className="glass-panel apple-card self-start p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{editingId ? (zh ? "編輯紀錄" : "Edit record") : (zh ? "新增收入 / 支出" : "Add income / expense")}</h3>
            <p className="mt-1 text-sm text-titanium">{zh ? "先用手動輸入紀錄現金流，之後再接自動同步。" : "Manual cashflow entry first; automation can come later."}</p>
          </div>
          {editingId && (
            <button className="focus-ring rounded-full border border-line px-3 py-2 text-xs text-titanium hover:text-ink" onClick={onReset} type="button">
              {zh ? "取消編輯" : "Cancel edit"}
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
              {zh ? "支出" : "Expense"}
            </button>
            <button
              className={clsx("focus-ring min-h-11 rounded-full text-sm font-medium", form.transaction_type === "income" ? "primary-button" : "text-titanium hover:text-ink")}
              onClick={() => onUpdateForm("transaction_type", "income")}
              type="button"
            >
              {zh ? "收入" : "Income"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={zh ? "日期" : "Date"}>
              <input className="input-control focus-ring w-full px-3 text-ink" type="date" value={form.transaction_date} onChange={(event) => onUpdateForm("transaction_date", event.target.value)} required />
            </Field>
            <Field label={zh ? "幣別" : "Currency"}>
              <select className="input-control focus-ring w-full px-3 text-ink" value={form.currency} onChange={(event) => onUpdateForm("currency", event.target.value as Currency)}>
                <option value="USD">USD</option>
                <option value="TWD">TWD</option>
              </select>
            </Field>
          </div>

          <Field label={zh ? "金額" : "Amount"}>
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

          <Field label={zh ? "分類" : "Category"}>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={zh ? "項目名稱" : "Description"}>
              <input
                className="input-control focus-ring w-full px-3 text-ink"
                placeholder={zh ? "例如：午餐、薪水、Uber" : "e.g. Lunch, paycheck, Uber"}
                value={form.description}
                onChange={(event) => onUpdateForm("description", event.target.value)}
              />
            </Field>

            <Field label={zh ? "付款方式" : "Payment method"}>
              <select
                className="input-control focus-ring w-full px-3 text-ink"
                value={form.payment_method}
                onChange={(event) => onUpdateForm("payment_method", event.target.value)}
              >
                <option value="">{zh ? "選擇付款方式" : "Select payment method"}</option>
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{zh ? method.zh : method.en}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={zh ? "備註" : "Notes"}>
            <textarea
              className="input-control focus-ring min-h-24 w-full resize-none px-3 py-3 text-ink"
              placeholder={zh ? "可選填" : "Optional"}
              value={form.notes}
              onChange={(event) => onUpdateForm("notes", event.target.value)}
            />
          </Field>

          <button className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium" type="submit">
            <Plus size={17} />
            {editingId ? (zh ? "更新紀錄" : "Update record") : (zh ? "儲存紀錄" : "Save record")}
          </button>
        </form>
        </section>

        <section className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            actionLabel={zh ? "查看本月全部收支" : "View all monthly transactions"}
            icon={<CircleDollarSign size={20} />}
            label={zh ? "本月結餘" : "Monthly net"}
            onClick={() => openTransactionHistory("all")}
            value={netTotal}
          />
          <MetricCard
            actionLabel={zh ? "查看今天花費明細" : "View today's expense details"}
            icon={<Activity size={20} />}
            label={zh ? "今天花費" : "Spent today"}
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
              <h3 className="text-xl font-semibold text-ink">{zh ? "月份紀錄" : "Monthly records"}</h3>
              <p className="mt-1 text-sm text-titanium">{zh ? `${selectedMonthLabel} 的收入與支出。` : `Income and expenses for ${selectedMonthLabel}.`}</p>
            </div>
            <button
              aria-label={zh ? "放大檢視月份紀錄" : "Expand monthly records"}
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
              {zh ? "這個月份目前沒有收入或支出紀錄。" : "There are no income or expense records for this month."}
            </div>
          ) : (
            <div className="max-h-[430px] overflow-auto rounded-[18px] border border-line">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-[0.08em] text-titanium">
                  <tr>
                    <th className="px-4 py-3">{zh ? "日期" : "Date"}</th>
                    <th className="px-4 py-3">{zh ? "項目" : "Description"}</th>
                    <th className="px-4 py-3">{zh ? "分類" : "Category"}</th>
                    <th className="px-4 py-3">{zh ? "方式" : "Method"}</th>
                    <th className="px-4 py-3 text-right">{zh ? "金額" : "Amount"}</th>
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
                        {transaction.transaction_type === "income" ? "+" : "-"}{formatCurrency(transaction.amount, transaction.currency)}
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
              <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{recurringEditingId ? (zh ? "編輯固定支出" : "Edit recurring expense") : (zh ? "新增固定支出 / 訂閱" : "Add recurring expense / subscription")}</h3>
              <p className="mt-1 text-sm text-titanium">{zh ? "例如 Netflix、手機費、保險、房租。先手動管理，之後再看哪些可自動串聯。" : "For Netflix, phone bills, insurance, rent, and subscriptions. Manual first; automation later."}</p>
            </div>
            {recurringEditingId && (
              <button className="focus-ring rounded-full border border-line px-3 py-2 text-xs text-titanium hover:text-ink" onClick={onResetRecurring} type="button">
                {zh ? "取消編輯" : "Cancel edit"}
              </button>
            )}
          </div>

          <form className="space-y-4" onSubmit={onSaveRecurring}>
            <Field label={zh ? "名稱" : "Name"}>
              <input
                className="input-control focus-ring w-full px-3 text-ink"
                placeholder={zh ? "例如：Netflix、房租、保險" : "e.g. Netflix, rent, insurance"}
                value={recurringForm.name}
                onChange={(event) => onUpdateRecurringForm("name", event.target.value)}
                required
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={zh ? "金額" : "Amount"}>
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
              <Field label={zh ? "幣別" : "Currency"}>
                <select className="input-control focus-ring w-full px-3 text-ink" value={recurringForm.currency} onChange={(event) => onUpdateRecurringForm("currency", event.target.value as Currency)}>
                  <option value="USD">USD</option>
                  <option value="TWD">TWD</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={zh ? "週期" : "Frequency"}>
                <select className="input-control focus-ring w-full px-3 text-ink" value={recurringForm.frequency} onChange={(event) => onUpdateRecurringForm("frequency", event.target.value as RecurringExpenseInput["frequency"])}>
                  <option value="monthly">{zh ? "每月" : "Monthly"}</option>
                  <option value="yearly">{zh ? "每年" : "Yearly"}</option>
                </select>
              </Field>
              <Field label={zh ? "下次扣款日" : "Next due date"}>
                <input className="input-control focus-ring w-full px-3 text-ink" type="date" value={recurringForm.next_due_date} onChange={(event) => onUpdateRecurringForm("next_due_date", event.target.value)} required />
              </Field>
            </div>

            <Field label={zh ? "分類" : "Category"}>
              <select className="input-control focus-ring w-full px-3 text-ink" value={recurringForm.category} onChange={(event) => onUpdateRecurringForm("category", event.target.value)}>
                {recurringCategories.map((category) => (
                  <option key={category.id} value={category.id}>{zh ? category.zh : category.en}</option>
                ))}
              </select>
            </Field>

            <Field label={zh ? "付款方式" : "Payment method"}>
              <select
                className="input-control focus-ring w-full px-3 text-ink"
                value={recurringForm.payment_method}
                onChange={(event) => onUpdateRecurringForm("payment_method", event.target.value)}
              >
                <option value="">{zh ? "選擇付款方式" : "Select payment method"}</option>
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{zh ? method.zh : method.en}</option>
                ))}
              </select>
            </Field>

            <label className="input-control flex items-center gap-3 px-3 text-sm text-ink">
              <input checked={recurringForm.is_active} onChange={(event) => onUpdateRecurringForm("is_active", event.target.checked)} type="checkbox" />
              {zh ? "仍在使用 / 持續扣款" : "Active / still billing"}
            </label>

            <label className="input-control flex items-center gap-3 px-3 text-sm text-ink">
              <input checked={recurringForm.is_subscription} onChange={(event) => onUpdateRecurringForm("is_subscription", event.target.checked)} type="checkbox" />
              {zh ? "這是一個訂閱服務" : "This is a subscription"}
            </label>

            {recurringForm.is_subscription && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={zh ? "使用狀態" : "Usage status"}>
                  <select className="input-control focus-ring w-full px-3 text-ink" value={recurringForm.usage_status} onChange={(event) => onUpdateRecurringForm("usage_status", event.target.value as RecurringExpenseInput["usage_status"])}>
                    {subscriptionUsageStatuses.map((status) => (
                      <option key={status.id} value={status.id}>{zh ? status.zh : status.en}</option>
                    ))}
                  </select>
                </Field>
                <Field label={zh ? "扣款前提醒天數" : "Reminder days before charge"}>
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

            <Field label={zh ? "備註" : "Notes"}>
              <textarea
                className="input-control focus-ring min-h-24 w-full resize-none px-3 py-3 text-ink"
                placeholder={zh ? "可選填" : "Optional"}
                value={recurringForm.notes}
                onChange={(event) => onUpdateRecurringForm("notes", event.target.value)}
              />
            </Field>

            <button className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium" type="submit">
              <Plus size={17} />
              {recurringEditingId ? (zh ? "更新固定支出" : "Update recurring expense") : (zh ? "儲存固定支出" : "Save recurring expense")}
            </button>
          </form>
        </section>

        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label={zh ? "每月固定支出" : "Monthly recurring"} value={recurringMonthlyTotal} trend={activeRecurringExpenses.length ? -1 : undefined} icon={<ReceiptText size={20} />} />
            <MetricCard label={zh ? "訂閱年化成本" : "Subscription annual cost"} value={subscriptionAnnualTotal} trend={activeSubscriptions.length ? -1 : undefined} icon={<ReceiptText size={20} />} />
            <MetricCard label={zh ? "可檢視項目" : "Review candidates"} value={String(subscriptionsToReview.length)} trend={subscriptionsToReview.length ? -1 : undefined} icon={<ListChecks size={20} />} />
          </div>

          <section className="glass-panel apple-card p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">{zh ? "固定支出與訂閱" : "Recurring expenses and subscriptions"}</h3>
                <p className="mt-1 text-sm text-titanium">{zh ? "依下次扣款日排序，未啟用項目會保留但不計入摘要。" : "Sorted by next due date. Inactive items are kept but excluded from summaries."}</p>
              </div>
              <button
                aria-label={zh ? "放大檢視固定支出與訂閱" : "Expand recurring expenses and subscriptions"}
                className="focus-ring rounded-full border border-line p-2 text-titanium transition hover:bg-white/10 hover:text-ink"
                onClick={() => setExpandedList("recurring")}
                type="button"
              >
                <Maximize2 size={17} />
              </button>
            </div>

            {!recurringExpenses.length ? (
              <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
                {zh ? "新增第一筆固定支出後，這裡會顯示你的訂閱與固定扣款。" : "Add your first recurring expense to track subscriptions and fixed bills."}
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
                            {getRecurringCategoryLabel(expense.category, locale)} · {expense.frequency === "monthly" ? (zh ? "每月" : "Monthly") : (zh ? "每年" : "Yearly")}
                          </span>
                          {expense.is_subscription && (
                            <span className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-xs text-titanium">
                              {getSubscriptionUsageLabel(expense.usage_status ?? "active", locale)}
                            </span>
                          )}
                        </span>
                      </button>
                      <div className="text-right">
                        <p className="font-semibold text-ink">{formatCurrency(expense.amount, expense.currency)}</p>
                        {expense.is_subscription && <p className="mt-1 text-xs text-titanium">{zh ? "年化" : "Annual"}: {formatRecurringAnnualizedAmount(expense)}</p>}
                        <p className="mt-1 text-xs text-titanium">{zh ? "下次" : "Next"}: {formatDateOnly(expense.next_due_date, locale)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-titanium">{getPaymentMethodLabel(expense.payment_method, locale)}</p>
                      <div className="flex items-center gap-2">
                        {expense.is_subscription && daysUntil(expense.next_due_date) <= (expense.reminder_days ?? 3) && (
                          <span className="rounded-full bg-amber/10 px-2.5 py-1 text-xs text-amber">{zh ? "即將扣款" : "Due soon"}</span>
                        )}
                        {!expense.is_active && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-titanium">{zh ? "未啟用" : "Inactive"}</span>}
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
              <h3 className="mb-4 text-xl font-semibold text-ink">{zh ? "可考慮檢視 / 取消" : "Review or cancel candidates"}</h3>
              <div className="space-y-3">
                {subscriptionsToReview.map((expense) => (
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber/20 bg-amber/5 p-3 text-sm" key={expense.id}>
                    <div>
                      <p className="font-medium text-ink">{expense.name}</p>
                      <p className="text-xs text-titanium">{getSubscriptionUsageLabel(expense.usage_status ?? "active", locale)} · {formatRecurringAnnualizedAmount(expense)} / {zh ? "年" : "year"}</p>
                    </div>
                    <button className="focus-ring rounded-full border border-line px-3 py-2 text-xs text-titanium hover:text-ink" onClick={() => onEditRecurring(expense)} type="button">
                      {zh ? "檢視" : "Review"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {upcomingSubscriptionAlerts.length > 0 && (
            <section className="glass-panel apple-card p-5">
              <h3 className="mb-4 text-xl font-semibold text-ink">{zh ? "訂閱扣款提醒" : "Subscription charge reminders"}</h3>
              <div className="space-y-3">
                {upcomingSubscriptionAlerts.map((expense) => (
                  <div className="flex items-center justify-between gap-4 text-sm" key={expense.id}>
                    <div>
                      <p className="font-medium text-ink">{expense.name}</p>
                      <p className="text-xs text-titanium">{zh ? "剩餘" : "In"} {Math.max(0, daysUntil(expense.next_due_date))} {zh ? "天" : "days"}</p>
                    </div>
                    <p className="font-semibold text-ink">{formatCurrency(expense.amount, expense.currency)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {upcomingRecurringExpenses.length > 0 && (
            <section className="glass-panel apple-card p-5">
              <h3 className="mb-4 text-xl font-semibold text-ink">{zh ? "近期扣款" : "Upcoming charges"}</h3>
              <div className="space-y-3">
                {upcomingRecurringExpenses.map((expense) => (
                  <div className="flex items-center justify-between gap-4 text-sm" key={expense.id}>
                    <div>
                      <p className="font-medium text-ink">{expense.name}</p>
                      <p className="text-xs text-titanium">{formatDateOnly(expense.next_due_date, locale)}</p>
                    </div>
                    <p className="font-semibold text-ink">{formatCurrency(expense.amount, expense.currency)}</p>
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
              <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{debtEditingId ? (zh ? "編輯貸款 / 債務" : "Edit loan / debt") : (zh ? "新增貸款 / 債務" : "Add loan / debt")}</h3>
              <p className="mt-1 text-sm text-titanium">{zh ? "手動追蹤房貸、車貸、學貸、信用卡分期與其他債務。" : "Manually track mortgages, car loans, student loans, credit cards, and other debts."}</p>
            </div>
            {debtEditingId && (
              <button className="focus-ring rounded-full border border-line px-3 py-2 text-xs text-titanium hover:text-ink" onClick={onResetDebt} type="button">
                {zh ? "取消編輯" : "Cancel edit"}
              </button>
            )}
          </div>

          <form className="space-y-4" onSubmit={onSaveDebt}>
            <Field label={zh ? "名稱" : "Name"}>
              <input
                className="input-control focus-ring w-full px-3 text-ink"
                placeholder={zh ? "例如：房貸、車貸、信用卡分期" : "e.g. Mortgage, car loan, card installment"}
                value={debtForm.name}
                onChange={(event) => onUpdateDebtForm("name", event.target.value)}
                required
              />
            </Field>

            <Field label={zh ? "類型" : "Type"}>
              <select className="input-control focus-ring w-full px-3 text-ink" value={debtForm.debt_type} onChange={(event) => onUpdateDebtForm("debt_type", event.target.value as DebtType)}>
                {debtTypes.map((type) => (
                  <option key={type.id} value={type.id}>{zh ? type.zh : type.en}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={zh ? "原始本金" : "Original principal"}>
                <NumericInput value={debtForm.original_principal} onChange={(value) => onUpdateDebtForm("original_principal", value)} />
              </Field>
              <Field label={zh ? "剩餘本金" : "Remaining principal"}>
                <NumericInput value={debtForm.remaining_principal} onChange={(value) => onUpdateDebtForm("remaining_principal", value)} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={zh ? "幣別" : "Currency"}>
                <select className="input-control focus-ring w-full px-3 text-ink" value={debtForm.currency} onChange={(event) => onUpdateDebtForm("currency", event.target.value as Currency)}>
                  <option value="USD">USD</option>
                  <option value="TWD">TWD</option>
                </select>
              </Field>
              <Field label={zh ? "年利率 %" : "APR %"}>
                <NumericInput value={debtForm.interest_rate} onChange={(value) => onUpdateDebtForm("interest_rate", value)} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={zh ? "每月最低付款" : "Monthly payment"}>
                <NumericInput value={debtForm.minimum_payment} onChange={(value) => onUpdateDebtForm("minimum_payment", value)} />
              </Field>
              <Field label={zh ? "下次付款日" : "Next payment date"}>
                <input className="input-control focus-ring w-full px-3 text-ink" type="date" value={debtForm.next_payment_date} onChange={(event) => onUpdateDebtForm("next_payment_date", event.target.value)} required />
              </Field>
            </div>

            <Field label={zh ? "貸款機構" : "Lender"}>
              <input
                className="input-control focus-ring w-full px-3 text-ink"
                placeholder={zh ? "銀行、信用卡公司、私人借款" : "Bank, card issuer, private lender"}
                value={debtForm.lender}
                onChange={(event) => onUpdateDebtForm("lender", event.target.value)}
              />
            </Field>

            <label className="input-control flex items-center gap-3 px-3 text-sm text-ink">
              <input checked={debtForm.is_active} onChange={(event) => onUpdateDebtForm("is_active", event.target.checked)} type="checkbox" />
              {zh ? "仍需追蹤 / 尚未還清" : "Active / still owed"}
            </label>

            <Field label={zh ? "備註" : "Notes"}>
              <textarea
                className="input-control focus-ring min-h-24 w-full resize-none px-3 py-3 text-ink"
                placeholder={zh ? "可選填" : "Optional"}
                value={debtForm.notes}
                onChange={(event) => onUpdateDebtForm("notes", event.target.value)}
              />
            </Field>

            <button className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium" type="submit">
              <Plus size={17} />
              {debtEditingId ? (zh ? "更新債務" : "Update debt") : (zh ? "儲存債務" : "Save debt")}
            </button>
          </form>
        </section>

        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label={zh ? "剩餘債務" : "Remaining debt"} value={totalDebtPrincipal} trend={activeDebts.length ? -1 : undefined} icon={<ReceiptText size={20} />} />
            <MetricCard label={zh ? "每月最低付款" : "Monthly minimums"} value={totalDebtMonthlyPayment} trend={activeDebts.length ? -1 : undefined} icon={<ReceiptText size={20} />} />
            <MetricCard label={zh ? "最高利率" : "Highest APR"} value={highestInterestDebt ? `${highestInterestDebt.interest_rate.toFixed(2)}%` : "0.00%"} trend={highestInterestDebt?.interest_rate ? -1 : undefined} icon={<Activity size={20} />} />
          </div>

          <section className="glass-panel apple-card p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">{zh ? "貸款與債務" : "Loans and debts"}</h3>
                <p className="mt-1 text-sm text-titanium">{zh ? "依下次付款日排序，未啟用項目保留但不計入摘要。" : "Sorted by next payment date. Inactive debts are kept but excluded from summaries."}</p>
              </div>
              <button
                aria-label={zh ? "放大檢視貸款與債務" : "Expand loans and debts"}
                className="focus-ring rounded-full border border-line p-2 text-titanium transition hover:bg-white/10 hover:text-ink"
                onClick={() => setExpandedList("debts")}
                type="button"
              >
                <Maximize2 size={17} />
              </button>
            </div>

            {!debts.length ? (
              <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
                {zh ? "新增第一筆債務後，這裡會顯示剩餘本金與付款資訊。" : "Add your first debt to track principal and payment details."}
              </div>
            ) : (
              <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-1">
                {debts.map((debt) => (
                  <article className={clsx("subtle-panel apple-card-sm p-4", !debt.is_active && "opacity-60")} key={debt.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button className="text-left" onClick={() => onEditDebt(debt)} type="button">
                        <span className="block font-semibold text-ink">{debt.name}</span>
                        <span className="mt-1 block text-xs text-titanium">{getDebtTypeLabel(debt.debt_type, locale)} · {debt.lender || (zh ? "未設定機構" : "No lender")}</span>
                      </button>
                      <div className="text-right">
                        <p className="font-semibold text-ink">{formatCurrency(debt.remaining_principal, debt.currency)}</p>
                        <p className="mt-1 text-xs text-titanium">{zh ? "利率" : "APR"}: {debt.interest_rate.toFixed(2)}%</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-titanium">{zh ? "下次付款" : "Next payment"}: {formatDateOnly(debt.next_payment_date, locale)} · {formatCurrency(debt.minimum_payment, debt.currency)}</p>
                      <div className="flex items-center gap-2">
                        {!debt.is_active && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-titanium">{zh ? "未啟用" : "Inactive"}</span>}
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
              <h3 className="mb-4 text-xl font-semibold text-ink">{zh ? "近期債務付款" : "Upcoming debt payments"}</h3>
              <div className="space-y-3">
                {upcomingDebtPayments.map((debt) => (
                  <div className="flex items-center justify-between gap-4 text-sm" key={debt.id}>
                    <div>
                      <p className="font-medium text-ink">{debt.name}</p>
                      <p className="text-xs text-titanium">{formatDateOnly(debt.next_payment_date, locale)}</p>
                    </div>
                    <p className="font-semibold text-ink">{formatCurrency(debt.minimum_payment, debt.currency)}</p>
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
              <h3 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{budgetEditingId ? (zh ? "編輯預算" : "Edit budget") : (zh ? "新增每月預算" : "Add monthly budget")}</h3>
              <p className="mt-1 text-sm text-titanium">{zh ? "設定每月分類預算，系統會用本月支出自動計算剩餘與超支。" : "Set category budgets and compare them with this month's expenses."}</p>
            </div>
            {budgetEditingId && (
              <button className="focus-ring rounded-full border border-line px-3 py-2 text-xs text-titanium hover:text-ink" onClick={onResetBudget} type="button">
                {zh ? "取消編輯" : "Cancel edit"}
              </button>
            )}
          </div>

          <form className="space-y-4" onSubmit={onSaveBudget}>
            <Field label={zh ? "月份" : "Month"}>
              <input className="input-control focus-ring w-full px-3 text-ink" type="month" value={budgetForm.month} onChange={(event) => onUpdateBudgetForm("month", event.target.value)} required />
            </Field>

            <Field label={zh ? "分類" : "Category"}>
              <select className="input-control focus-ring w-full px-3 text-ink" value={budgetForm.category} onChange={(event) => onUpdateBudgetForm("category", event.target.value)}>
                {cashflowCategories.expense.map((category) => (
                  <option key={category.id} value={category.id}>{zh ? category.zh : category.en}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={zh ? "預算金額" : "Budget amount"}>
                <NumericInput value={budgetForm.amount} onChange={(value) => onUpdateBudgetForm("amount", value)} />
              </Field>
              <Field label={zh ? "幣別" : "Currency"}>
                <select className="input-control focus-ring w-full px-3 text-ink" value={budgetForm.currency} onChange={(event) => onUpdateBudgetForm("currency", event.target.value as Currency)}>
                  <option value="USD">USD</option>
                  <option value="TWD">TWD</option>
                </select>
              </Field>
            </div>

            <Field label={zh ? "備註" : "Notes"}>
              <textarea
                className="input-control focus-ring min-h-24 w-full resize-none px-3 py-3 text-ink"
                placeholder={zh ? "可選填" : "Optional"}
                value={budgetForm.notes}
                onChange={(event) => onUpdateBudgetForm("notes", event.target.value)}
              />
            </Field>

            <button className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium" type="submit">
              <Plus size={17} />
              {budgetEditingId ? (zh ? "更新預算" : "Update budget") : (zh ? "儲存預算" : "Save budget")}
            </button>
          </form>
        </section>

        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label={zh ? "本月預算" : "Monthly budget"} value={formatBudgetLimitTotal(budgetRows)} icon={<ReceiptText size={20} />} />
            <MetricCard label={zh ? "已花費" : "Spent"} value={formatBudgetSpentTotal(budgetRows)} trend={budgetRows.length ? -1 : undefined} icon={<Activity size={20} />} />
            <MetricCard label={zh ? "超支分類" : "Over budget"} value={String(overBudgetRows.length)} trend={overBudgetRows.length ? -1 : undefined} icon={<ListChecks size={20} />} />
          </div>

          <section className="glass-panel apple-card p-5">
            <div className="mb-5">
              <h3 className="text-xl font-semibold text-ink">{zh ? "分類預算" : "Category budgets"}</h3>
              <p className="mt-1 text-sm text-titanium">{zh ? "目前顯示本月預算；點擊項目可編輯。" : "Showing this month's budgets. Click an item to edit."}</p>
            </div>

            {!budgetRows.length ? (
              <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
                {zh ? "新增第一筆預算後，這裡會顯示已花、剩餘與超支狀態。" : "Add your first budget to see spending, remaining amount, and over-budget status."}
              </div>
            ) : (
              <div className="grid gap-3">
                {budgetRows.map((row) => (
                  <article className="subtle-panel apple-card-sm p-4" key={row.budget.id}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <button className="text-left" onClick={() => onEditBudget(row.budget)} type="button">
                        <span className="block font-semibold text-ink">{getCategoryLabel(row.budget.category, locale)}</span>
                        <span className="mt-1 block text-xs text-titanium">{formatDateOnly(row.budget.month, locale)} · {row.budget.currency}</span>
                      </button>
                      <div className="text-right">
                        <p className={clsx("font-semibold", row.remaining < 0 ? "text-rose" : "text-ink")}>{formatCurrency(row.remaining, row.budget.currency)}</p>
                        <p className="mt-1 text-xs text-titanium">{zh ? "剩餘" : "Remaining"}</p>
                      </div>
                    </div>
                    <div className="mb-3 h-2 rounded-full bg-white/10">
                      <div
                        className={clsx("h-2 rounded-full", row.percentUsed > 100 ? "bg-rose" : "bg-mint")}
                        style={{ width: `${Math.min(100, row.percentUsed)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-titanium">
                      <span>{zh ? "已花" : "Spent"} {formatCurrency(row.spent, row.budget.currency)} / {formatCurrency(row.budget.amount, row.budget.currency)}</span>
                      <div className="flex items-center gap-2">
                        {row.remaining < 0 && <span className="rounded-full bg-rose/10 px-2.5 py-1 text-rose">{zh ? "超支" : "Over budget"}</span>}
                        <button
                          aria-label={zh ? `刪除 ${getCategoryLabel(row.budget.category, locale)} 預算` : `Delete ${getCategoryLabel(row.budget.category, locale)} budget`}
                          className="focus-ring rounded-xl border border-line p-2 text-titanium transition hover:bg-rose/10 hover:text-rose"
                          onClick={() => onDeleteBudget(row.budget.id)}
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
                {zh ? "上月" : "Prev month"}
              </button>
              <p className="font-semibold text-ink">{selectedMonthLabel}</p>
              <button className="focus-ring rounded-full border border-line px-3 py-2 text-sm text-titanium hover:text-ink" onClick={() => changeSelectedHistoryMonth(1)} type="button">
                {zh ? "下月" : "Next month"}
              </button>
            </div>
          )}
          {!filteredSelectedMonthTransactions.length ? (
            <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
              {zh ? "目前沒有符合條件的紀錄。" : "There are no matching records."}
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
                      {transaction.transaction_type === "income" ? "+" : "-"}{formatCurrency(transaction.amount, transaction.currency)}
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
          title={zh ? "固定支出與訂閱完整清單" : "All Recurring Expenses and Subscriptions"}
          subtitle={zh ? `共 ${recurringExpenses.length} 筆，未啟用項目不計入摘要。` : `${recurringExpenses.length} items. Inactive items are excluded from summaries.`}
          onClose={() => setExpandedList(null)}
        >
          {!recurringExpenses.length ? (
            <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
              {zh ? "尚未新增固定支出。" : "No recurring expenses yet."}
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
                          {getRecurringCategoryLabel(expense.category, locale)} · {expense.frequency === "monthly" ? (zh ? "每月" : "Monthly") : (zh ? "每年" : "Yearly")} · {zh ? "下次" : "Next"} {formatDateOnly(expense.next_due_date, locale)}
                        </span>
                        {expense.is_subscription && (
                          <span className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-xs text-titanium">
                            {getSubscriptionUsageLabel(expense.usage_status ?? "active", locale)}
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="text-right">
                      <p className="font-semibold text-ink">{formatCurrency(expense.amount, expense.currency)}</p>
                      {expense.is_subscription && <p className="mt-1 text-xs text-titanium">{zh ? "年化" : "Annual"}: {formatRecurringAnnualizedAmount(expense)}</p>}
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
          title={zh ? "貸款與債務完整清單" : "All Loans and Debts"}
          subtitle={zh ? `共 ${debts.length} 筆，未啟用項目不計入摘要。` : `${debts.length} items. Inactive debts are excluded from summaries.`}
          onClose={() => setExpandedList(null)}
        >
          {!debts.length ? (
            <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">
              {zh ? "尚未新增貸款或債務。" : "No loans or debts yet."}
            </div>
          ) : (
            <div className="grid gap-3">
              {debts.map((debt) => (
                <article className={clsx("subtle-panel apple-card-sm p-4", !debt.is_active && "opacity-60")} key={debt.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button className="text-left" onClick={() => onEditDebt(debt)} type="button">
                      <span className="block font-semibold text-ink">{debt.name}</span>
                      <span className="mt-1 block text-xs text-titanium">{getDebtTypeLabel(debt.debt_type, locale)} · {debt.lender || (zh ? "未設定機構" : "No lender")}</span>
                    </button>
                    <div className="text-right">
                      <p className="font-semibold text-ink">{formatCurrency(debt.remaining_principal, debt.currency)}</p>
                      <p className="mt-1 text-xs text-titanium">{zh ? "利率" : "APR"}: {debt.interest_rate.toFixed(2)}%</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-titanium">{zh ? "下次付款" : "Next payment"}: {formatDateOnly(debt.next_payment_date, locale)} · {formatCurrency(debt.minimum_payment, debt.currency)}</p>
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
  demo,
  editingId,
  editingWalletCost,
  enriched,
  form,
  locale,
  t,
  userId,
  onDelete,
  onEdit,
  onReset,
  onSave,
  onUpdateForm,
  onHoldingsChanged,
}: {
  demo: boolean;
  editingId: string | null;
  editingWalletCost: boolean;
  enriched: EnrichedHolding[];
  form: HoldingInput;
  locale: Locale;
  t: ReturnType<typeof getDictionary>;
  userId: string;
  onDelete: (id: string) => void;
  onEdit: (holding: Holding) => void;
  onReset: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdateForm: <K extends keyof HoldingInput>(key: K, value: HoldingInput[K]) => void;
  onHoldingsChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"manual" | "wallet">("manual");
  const editingWalletHolding = editingWalletCost
    ? enriched.find((holding) => holding.id === editingId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <div className="pill-panel inline-flex p-1">
        <button className={clsx("focus-ring rounded-full px-4 py-2 text-sm", mode === "manual" ? "primary-button" : "text-titanium")} onClick={() => setMode("manual")} type="button">{locale === "zh" ? "手動新增" : "Manual"}</button>
        <button className={clsx("focus-ring rounded-full px-4 py-2 text-sm", mode === "wallet" ? "primary-button" : "text-titanium")} onClick={() => setMode("wallet")} type="button">{locale === "zh" ? "地址追蹤" : "Address tracking"}</button>
      </div>
      {mode === "wallet" ? (
        <WalletTracker demo={demo} locale={locale} userId={userId} onHoldingsChanged={onHoldingsChanged} />
      ) : (
        <div className="space-y-5">
          <section className="glass-panel apple-card p-5">
            <div className="mb-5 flex items-center gap-2">
              <Plus size={20} className="text-mint" />
              <h3 className="text-xl font-semibold text-ink">
                {editingWalletCost ? (locale === "zh" ? "編輯成本" : "Edit cost") : editingId ? t.editHolding : t.addHolding}
              </h3>
            </div>
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
              className={clsx("grid gap-4 md:grid-cols-2", editingWalletCost ? "xl:grid-cols-3" : "xl:grid-cols-4")}
              onSubmit={onSave}
            >
              {!editingWalletCost && <Field label={t.type}>
                <select
                  className="input-control focus-ring w-full px-3 text-ink"
                  value={form.asset_type}
                  onChange={(event) => {
                    const nextType = event.target.value as AssetType;
                    onUpdateForm("asset_type", nextType);
                    if (nextType === "tw_stock") onUpdateForm("cost_currency", "TWD");
                    if (nextType === "us_stock" || nextType === "crypto") onUpdateForm("cost_currency", "USD");
                    if (nextType === "tw_stock" && form.quantity.includes(".")) {
                      onUpdateForm("quantity", form.quantity.split(".")[0] || "0");
                    }
                  }}
                >
                  <option value="crypto">{t.crypto}</option>
                  <option value="us_stock">{t.us_stock}</option>
                  <option value="tw_stock">{t.tw_stock}</option>
                  <option value="cash">{t.cash}</option>
                </select>
              </Field>}
              {!editingWalletCost && <Field label={t.symbol}>
                {form.asset_type === "crypto" ? (
                  <CryptoSearch value={form.symbol} locale={locale} onChange={(value) => onUpdateForm("symbol", value)} onSelect={(coin) => {
                    onUpdateForm("symbol", coin.symbol);
                    onUpdateForm("name", coin.name);
                    onUpdateForm("market_data_id", coin.id);
                  }} />
                ) : form.asset_type === "us_stock" || form.asset_type === "tw_stock" ? (
                  <SymbolSearch value={form.symbol} locale={locale} onChange={(value) => {
                    onUpdateForm("symbol", value);
                    onUpdateForm("market_data_id", null);
                  }} onSelect={(result) => {
                    onUpdateForm("symbol", result.symbol);
                    if (result.description) onUpdateForm("name", result.description);
                    onUpdateForm("market_data_id", null);
                  }} />
                ) : (
                  <input className="input-control focus-ring w-full px-3 text-ink" placeholder="USD, TWD" value={form.symbol} onChange={(event) => onUpdateForm("symbol", event.target.value)} required />
                )}
              </Field>}
              {!editingWalletCost && <Field label={t.name}>
                <input
                  className="input-control focus-ring w-full px-3 text-ink"
                  value={form.name}
                  onChange={(event) => onUpdateForm("name", event.target.value)}
                />
              </Field>}
              {!editingWalletCost && <Field label={form.asset_type === "tw_stock" ? t.quantityLots : t.quantity}>
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
              <Field label={t.averageCost}>
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
              </Field>
              <label className="input-control flex items-center gap-3 px-3 text-sm text-ink">
                <input className="h-4 w-4" checked={form.cost_known !== false} onChange={(event) => onUpdateForm("cost_known", event.target.checked)} type="checkbox" />
                {t.costKnown}
              </label>
              <Field label={t.currency}>
                <select
                  className="input-control focus-ring w-full px-3 text-ink"
                  value={form.cost_currency}
                  onChange={(event) => onUpdateForm("cost_currency", event.target.value as Currency)}
                >
                  <option value="USD">USD</option>
                  <option value="TWD">TWD</option>
                </select>
              </Field>
              <div className={clsx("flex gap-3 md:col-span-2", editingWalletCost ? "xl:col-span-3" : "xl:col-span-4")}>
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
          </section>

          <section className="glass-panel apple-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">{t.holdings}</h3>
                <p className="mt-1 text-sm text-titanium">
                  {locale === "zh" ? "手動持倉與錢包來源分開顯示。" : "Manual holdings and wallet sources are shown separately."}
                </p>
              </div>
            </div>
            <HoldingsTable
              enriched={enriched}
              t={t}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </section>
        </div>
      )}
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
      const typeOrder = ["tw_stock", "us_stock", "crypto", "cash"];
      const typeDiff = typeOrder.indexOf(a.assetType) - typeOrder.indexOf(b.assetType);
      if (typeDiff !== 0) return typeDiff;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [enriched]);

  const typeOrder: AssetType[] = ["tw_stock", "us_stock", "crypto", "cash"];
  const typeIcons: Record<AssetType, React.ReactNode> = {
    cash: <CircleDollarSign aria-hidden="true" size={19} />,
    crypto: <WalletCards aria-hidden="true" size={19} />,
    tw_stock: <BarChart3 aria-hidden="true" size={19} />,
    us_stock: <LineChartIcon aria-hidden="true" size={19} />,
  };
  const typeTone: Record<AssetType, string> = {
    cash: "text-titanium",
    crypto: "text-mint",
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
        <h3 className="mt-4 text-xl font-semibold text-ink">{zh ? "尚無持有數量" : "No quantities yet"}</h3>
        <p className="mt-2 text-sm text-titanium">
          {zh ? "新增持倉或同步錢包後，資產數量會顯示在這裡。" : "Add a holding or sync a wallet to see asset quantities here."}
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
              {zh ? "資產庫存視圖" : "Position inventory"}
            </div>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-ink">
              {zh ? "持有數量" : "Quantities"}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-titanium">
              {zh
                ? "同代號會先合併，再依資產類型顯示張數、股數或代幣數量。不同資產不會相加成沒有意義的總數。"
                : "Same symbols are aggregated first, then shown as lots, shares, or token balances. Unlike units are never combined into a misleading total."}
            </p>
          </div>
          <div className="subtle-panel apple-card-sm min-w-[150px] p-4 text-right">
            <p className="text-xs font-medium text-titanium">{zh ? "合併後資產" : "Aggregated assets"}</p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-ink">{summary.length}</p>
            <p className="mt-1 text-xs text-titanium">{zh ? "種代號" : "symbols"}</p>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {typeOrder.map((assetType) => {
            const count = summary.filter((item) => item.assetType === assetType).length;
            return (
              <div className="subtle-panel apple-card-sm flex items-center gap-3 px-4 py-3" key={assetType}>
                <span className={clsx("flex h-9 w-9 items-center justify-center rounded-xl bg-white/10", typeTone[assetType])}>
                  {typeIcons[assetType]}
                </span>
                <div>
                  <p className="text-xs text-titanium">{t[assetType]}</p>
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
                <h4 className="text-xl font-semibold text-ink">{t[group.assetType]}</h4>
                <p className="mt-0.5 text-xs text-titanium">
                  {zh ? `${group.items.length} 種資產` : `${group.items.length} ${group.items.length === 1 ? "asset" : "assets"}`}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-titanium">
              {zh ? "同代號已合併" : "Symbols aggregated"}
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
                  {zh ? "目前持有" : "Current quantity"}
                </p>
                <p className="mt-2 break-words text-2xl font-semibold tracking-[-0.04em] text-ink">
                  {formatHoldingQuantity(item.quantity, item.assetType, locale)}
                </p>

                {item.assetType === "tw_stock" && (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2">
                    <span className="text-xs text-titanium">{zh ? "約當股數" : "Share equivalent"}</span>
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
      <input className="input-control focus-ring w-full px-3 text-ink" placeholder={locale === "zh" ? "搜尋幣種名稱或代號" : "Search coin name or symbol"} value={value} onFocus={() => setOpen(true)} onChange={(event) => { onChange(event.target.value); setOpen(true); }} required />
      {open && value.length >= 2 && (
        <div className="glass-panel apple-card-sm absolute z-20 mt-2 max-h-72 w-full overflow-y-auto p-1">
          {loading && <p className="px-3 py-3 text-sm text-titanium">{locale === "zh" ? "搜尋中..." : "Searching..."}</p>}
          {!loading && results.map((coin) => (
            <button key={coin.id} className="focus-ring flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-white/10" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(coin); setOpen(false); }} type="button">
              <span><span className="font-medium text-ink">{coin.name}</span><span className="ml-2 text-xs text-titanium">{coin.symbol}</span></span>
              <span className="text-xs text-titanium">{coin.marketCapRank ? `#${coin.marketCapRank}` : ""}</span>
            </button>
          ))}
          {!loading && !results.length && <p className="px-3 py-3 text-sm text-titanium">{locale === "zh" ? "找不到幣種" : "No coins found"}</p>}
        </div>
      )}
    </div>
  );
}

function SymbolSearch({
  value,
  locale,
  onChange,
  onSelect,
}: {
  value: string;
  locale: Locale;
  onChange: (value: string) => void;
  onSelect: (result: SymbolSearchResult) => void;
}) {
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const query = value.trim();
    if (!query || !open) {
      setResults([]);
      setSearchError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const response = await fetch(`/api/symbol-search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { results?: SymbolSearchResult[]; error?: string };
        setResults(data.results ?? []);
        if (!response.ok) setSearchError(data.error ?? (locale === "zh" ? "代號搜尋暫時無法使用" : "Symbol search is unavailable"));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
          setSearchError(locale === "zh" ? "代號搜尋暫時無法使用" : "Symbol search is unavailable");
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locale, open, value]);

  return (
    <div className="relative">
      <input
        autoComplete="off"
        className="input-control focus-ring w-full px-3 text-ink"
        placeholder="AAPL, TSLA, 2330"
        required
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && value.trim() && (
        <div className="glass-panel apple-card-sm absolute z-20 mt-2 max-h-72 w-full overflow-y-auto p-1">
          {loading && <p className="px-3 py-3 text-sm text-titanium">{locale === "zh" ? "搜尋中..." : "Searching..."}</p>}
          {!loading && searchError && <p className="px-3 py-3 text-sm text-rose">{searchError}</p>}
          {!loading && !searchError && results.map((result) => (
            <button
              key={`${result.symbol}-${result.description}`}
              className="focus-ring flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/10"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(result);
                setOpen(false);
              }}
              type="button"
            >
              <span className="min-w-0">
                <span className="block font-medium text-ink">{result.displaySymbol || result.symbol}</span>
                <span className="block truncate text-xs text-titanium">{result.description}</span>
              </span>
              {result.type && <span className="shrink-0 text-xs text-titanium">{result.type}</span>}
            </button>
          ))}
          {!loading && !searchError && !results.length && (
            <p className="px-3 py-3 text-sm text-titanium">{locale === "zh" ? "找不到符合的代號" : "No matching symbols"}</p>
          )}
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
  const knownCostValue = portfolioHoldings
    .filter((holding) => holding.cost_known !== false)
    .reduce((sum, holding) => sum + holding.valueUsd, 0);
  const pricedValue = portfolioHoldings
    .filter((holding) => holding.asset_type === "cash" || Boolean(holding.quote))
    .reduce((sum, holding) => sum + holding.valueUsd, 0);
  const costCoverage = totalValue ? (knownCostValue / totalValue) * 100 : 0;
  const priceCoverage = totalValue ? (pricedValue / totalValue) * 100 : 0;
  const cryptoWeight = portfolioHoldings
    .filter((holding) => holding.asset_type === "crypto")
    .reduce((sum, holding) => sum + holding.allocationPercent, 0);
  const cashWeight = portfolioHoldings
    .filter((holding) => holding.asset_type === "cash")
    .reduce((sum, holding) => sum + holding.allocationPercent, 0);
  const knownCostHoldings = portfolioHoldings.filter(
    (holding) => holding.cost_known !== false && holding.costBasisUsd > 0,
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
      name: zh ? "全面避險" : "Broad risk-off",
      detail: zh ? "股票 -10%，加密貨幣 -20%" : "Stocks -10%, crypto -20%",
      shocks: { cash: 0, crypto: -0.2, tw_stock: -0.1, us_stock: -0.1 } satisfies Record<AssetType, number>,
    },
    {
      name: zh ? "股票修正" : "Equity correction",
      detail: zh ? "美股與台股同步下跌 15%" : "US and Taiwan stocks fall 15%",
      shocks: { cash: 0, crypto: 0, tw_stock: -0.15, us_stock: -0.15 } satisfies Record<AssetType, number>,
    },
    {
      name: zh ? "加密貨幣回撤" : "Crypto drawdown",
      detail: zh ? "加密貨幣資產下跌 30%" : "Crypto assets fall 30%",
      shocks: { cash: 0, crypto: -0.3, tw_stock: 0, us_stock: 0 } satisfies Record<AssetType, number>,
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
        ? (zh ? "單一資產超過 30%，個別事件會明顯影響整體績效。" : "One asset exceeds 30%, increasing single-name risk.")
        : (zh ? "目前沒有單一資產超過 30%。" : "No single asset exceeds 30%."),
      title: zh ? "單一資產集中度" : "Single-asset concentration",
      value: largestHolding ? `${largestHolding.symbol} ${largestHolding.allocationPercent.toFixed(1)}%` : "N/A",
      warning: concentrationHigh,
    },
    {
      detail: topThreeWeight > 65
        ? (zh ? "前三大資產合計超過 65%，分散效果有限。" : "The top three exceed 65%, limiting diversification.")
        : (zh ? "前三大資產集中度仍在可控範圍。" : "Top-three concentration remains moderate."),
      title: zh ? "前三大集中度" : "Top-three concentration",
      value: `${topThreeWeight.toFixed(1)}%`,
      warning: topThreeWeight > 65,
    },
    {
      detail: cryptoWeight > 35
        ? (zh ? "加密貨幣比重較高，投資組合波動可能放大。" : "High crypto exposure may amplify portfolio volatility.")
        : (zh ? "加密貨幣比重未超過 35%。" : "Crypto exposure is below 35%."),
      title: zh ? "加密貨幣曝險" : "Crypto exposure",
      value: `${cryptoWeight.toFixed(1)}%`,
      warning: cryptoWeight > 35,
    },
    {
      detail: priceCoverage < 95
        ? (zh ? "部分持倉缺少價格，市值與配置分析可能不完整。" : "Missing prices may make valuation and allocation incomplete.")
        : (zh ? "大部分資產已有可用市場價格。" : "Market prices cover most portfolio value."),
      title: zh ? "價格覆蓋率" : "Price coverage",
      value: `${priceCoverage.toFixed(1)}%`,
      warning: priceCoverage < 95,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="glass-panel apple-card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">{zh ? "投資組合診斷" : "Portfolio diagnostics"}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink sm:text-3xl">
              {zh ? "風險與品質快照" : "Risk and quality snapshot"}
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
            label={zh ? "最大單一持倉" : "Largest position"}
            tone={concentrationHigh ? "warning" : "positive"}
            value={`${(largestHolding?.allocationPercent ?? 0).toFixed(1)}%`}
          />
          <AnalysisMetric
            detail={zh ? "反映實際分散程度" : "Adjusted for position weights"}
            label={zh ? "有效持倉數" : "Effective holdings"}
            tone={effectiveHoldings >= 5 ? "positive" : "warning"}
            value={effectiveHoldings.toFixed(1)}
          />
          <AnalysisMetric
            detail={zh ? "可計算損益的市值" : "Value with usable cost basis"}
            label={zh ? "成本覆蓋率" : "Cost coverage"}
            tone={costCoverage >= 90 ? "positive" : "warning"}
            value={`${costCoverage.toFixed(1)}%`}
          />
          <AnalysisMetric
            detail={zh ? `現金配置 ${cashWeight.toFixed(1)}%` : `Cash allocation ${cashWeight.toFixed(1)}%`}
            label={zh ? "前三大集中度" : "Top-three weight"}
            tone={topThreeWeight > 65 ? "warning" : "positive"}
            value={`${topThreeWeight.toFixed(1)}%`}
          />
        </div>
      </section>

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
          <h3 className="text-xl font-semibold text-ink">{zh ? "風險監測" : "Risk monitor"}</h3>
          <p className="mt-1 text-sm text-titanium">
            {zh ? "以明確門檻標示目前需要注意的配置問題。" : "Threshold-based checks for portfolio allocation and data quality."}
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
          emptyLabel={zh ? "需要已知成本才能分析損益來源。" : "Known costs are required for gain contribution analysis."}
          holdings={gainContributors}
          locale={locale}
          maxAbs={maxGainContribution}
          mode="gain"
          subtitle={zh ? "顯示哪些資產正在拉高或拖累累積未實現損益。" : "Assets contributing most to cumulative unrealized gain or loss."}
          title={zh ? "損益貢獻來源" : "Gain/loss contribution"}
        />
        <ContributionPanel
          emptyLabel={zh ? "目前沒有足夠的單日價格資料。" : "Not enough daily price data is available."}
          holdings={dayContributors}
          locale={locale}
          maxAbs={maxDayContribution}
          mode="day"
          subtitle={zh ? "依美元影響排序，不只看漲跌百分比。" : "Ranked by dollar impact, not percentage movement alone."}
          title={zh ? "今日風險貢獻" : "Daily risk contribution"}
        />
      </div>

      <section className="glass-panel apple-card p-5 sm:p-6">
        <div>
          <h3 className="text-xl font-semibold text-ink">{zh ? "壓力情境試算" : "Stress scenarios"}</h3>
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
                {formatCurrency(scenario.impact)}
              </p>
              <p className="mt-1 text-sm font-medium text-rose">{formatPercent(scenario.impactPercent)}</p>
              <div className="mt-4 border-t border-line pt-3 text-xs text-titanium">
                {zh ? "情境後估計市值" : "Estimated value after shock"}{" "}
                <span className="font-semibold text-ink">{formatCurrency(scenario.remainingValue)}</span>
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
                      {formatCurrency(value)}
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
        {locale === "zh" ? "同幣種跨地址持倉已先合併計算。" : "Same-asset positions across sources are aggregated first."}
      </p>
    </section>
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
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <section className="glass-panel apple-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <CircleDollarSign size={20} style={{ color: "var(--accent)" }} />
          <h3 className="text-xl font-semibold text-ink">外觀</h3>
        </div>
        <p className="mb-4 text-sm leading-6 text-titanium">選擇淺色、深色，或跟隨裝置系統設定。</p>
        <ThemeToggle />
      </section>
      <section className="glass-panel apple-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <Languages size={20} style={{ color: "var(--accent)" }} />
          <h3 className="text-xl font-semibold text-ink">{t.language}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            className={clsx("focus-ring rounded-2xl border border-line px-4 py-4", locale === "zh" ? "primary-button" : "interactive-muted text-ink")}
            onClick={() => onLocaleChange("zh")}
            type="button"
          >
            中文
          </button>
          <button
            className={clsx("focus-ring rounded-2xl border border-line px-4 py-4", locale === "en" ? "primary-button" : "interactive-muted text-ink")}
            onClick={() => onLocaleChange("en")}
            type="button"
          >
            English
          </button>
        </div>
      </section>
      <section className="glass-panel apple-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <Globe2 size={20} className="text-mint" />
          <h3 className="text-xl font-semibold text-ink">{t.baseCurrency}</h3>
        </div>
        <div className="subtle-panel apple-card-sm p-5">
          <p className="text-4xl font-semibold text-ink">USD</p>
          <p className="mt-3 text-sm leading-6 text-titanium">{t.baseCurrencyHelp}</p>
          {market && <p className="mt-4 text-sm text-titanium">1 USD = {market.fx.usdToTwd.toFixed(2)} TWD</p>}
        </div>
      </section>
      <section className="glass-panel apple-card p-5">
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
  allowEdit = true,
  compact = false,
  enriched,
  sourceMap,
  t,
  onDelete,
  onEdit,
}: {
  allowEdit?: boolean;
  compact?: boolean;
  enriched: EnrichedHolding[];
  sourceMap?: Map<string, EnrichedHolding[]>;
  t: ReturnType<typeof getDictionary>;
  onDelete: (id: string) => void;
  onEdit: (holding: Holding) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  if (!enriched.length) {
    return <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">{t.noHoldings}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-[18px] border border-line">
      <table className={clsx("w-full border-collapse text-left text-sm", compact ? "min-w-[760px]" : "min-w-[1120px]")}>
        <thead className="bg-white/5 text-xs uppercase tracking-[0.08em] text-titanium">
          <tr>
            <th className="w-[230px] px-4 py-3">{t.symbol}</th>
            <th className="w-[120px] px-4 py-3">{t.type}</th>
            {!compact && <th className="w-[150px] px-4 py-3 text-right">{t.quantity}</th>}
            <th className="w-[140px] px-4 py-3 text-right">{t.averageCost}</th>
            <th className="w-[130px] px-4 py-3 text-right">{t.value}</th>
            <th className="w-[145px] px-4 py-3 text-right">{t.gainLoss}</th>
            {!compact && <th className="w-[100px] px-4 py-3 text-right">{t.allocation}</th>}
            {!compact && <th className="w-[160px] px-4 py-3 text-right">{t.source}</th>}
            <th className="w-[110px] px-4 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {enriched.map((holding) => {
            const sourceKey = holdingSourceKey(holding);
            const sources = sourceMap?.get(sourceKey) ?? [];
            const hasSources = sources.length > 1;
            const isExpanded = expanded.has(sourceKey);

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
                  {allowEdit ? <button className="text-left" onClick={() => onEdit(holding)} type="button">
                    <span className="block font-semibold text-ink">{holding.symbol}</span>
                    <span className="block text-xs text-titanium">{holding.name}</span>
                  </button> : <div className="text-left">
                    <span className="block font-semibold text-ink">{holding.symbol}</span>
                    <span className="block text-xs text-titanium">{holding.name}</span>
                  </div>}
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="inline-flex whitespace-nowrap rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-titanium">
                  {t[holding.asset_type]}
                </span>
              </td>
              {!compact && <td className="whitespace-nowrap px-4 py-4 text-right text-ink">{holding.quantity.toLocaleString("en-US", { maximumFractionDigits: 8 })}</td>}
              <td className="whitespace-nowrap px-4 py-4 text-right text-ink">
                <AverageCostValue
                  editLabel={t.averageCost}
                  holding={holding}
                  unknownLabel={t.costUnknown}
                  onEdit={allowEdit ? onEdit : undefined}
                />
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-right text-ink">{formatCurrency(holding.valueUsd)}</td>
              <td className={clsx("whitespace-nowrap px-4 py-4 text-right", holding.cost_known === false ? "text-titanium" : holding.gainUsd >= 0 ? "text-mint" : "text-rose")}>
                {holding.cost_known === false ? <UnknownCostLabel label="N/A" /> : <><span className="block">{formatCurrency(holding.gainUsd)}</span><span className="text-xs">{formatPercent(holding.gainPercent)}</span></>}
              </td>
              {!compact && <td className="whitespace-nowrap px-4 py-4 text-right text-ink">{holding.allocationPercent.toFixed(1)}%</td>}
              {!compact && <td className="px-4 py-4 text-right text-titanium"><span className="block">{holding.source_kind === "wallet" ? holding.source_label : t.manual}</span><span className="text-xs">{holding.quote?.source ?? (holding.cost_known === false ? t.priceUnavailable : "Cost basis")}</span></td>}
              <td className="px-4 py-4 text-right">
                {!compact && holding.source_kind === "wallet" && (
                  <button
                    className="focus-ring rounded-full border border-line px-3 py-2 text-xs font-medium text-titanium transition hover:bg-white/10 hover:text-ink"
                    onClick={() => onEdit(holding)}
                    type="button"
                  >
                    {t.averageCost}
                  </button>
                )}
                {!compact && holding.source_kind !== "wallet" && (
                  <button
                    aria-label={`${t.delete} ${holding.symbol}`}
                    className="focus-ring rounded-xl border border-line p-2 text-titanium transition hover:bg-rose/10 hover:text-rose"
                    onClick={() => onDelete(holding.id)}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </td>
            </tr>
            {hasSources && isExpanded && (
              <tr className="border-t border-line bg-white/5">
                <td colSpan={compact ? 6 : 9} className="px-4 py-4">
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
  actionLabel,
  detail,
  icon,
  label,
  onClick,
  primary = false,
  trend,
  value,
}: {
  actionLabel?: string;
  detail?: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  primary?: boolean;
  trend?: number;
  value: string;
}) {
  const className = clsx(
    "glass-panel apple-card p-5 text-left",
    primary && "sm:col-span-2 xl:col-span-1",
    onClick && "focus-ring group transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]",
  );
  const content = (
    <>
      <div className="flex items-center justify-between text-titanium">
        <span className="text-sm">{label}</span>
        <span className="flex items-center gap-1.5">
          {icon}
          {onClick && <ChevronRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" size={15} />}
        </span>
      </div>
      <p className={clsx("mt-5 font-semibold tracking-[-0.045em]", primary ? "text-4xl" : "text-3xl", trend === undefined ? "text-ink" : trend >= 0 ? "text-mint" : "text-rose")}>
        {value}
      </p>
      {detail && <p className="mt-2 text-sm text-titanium">{detail}</p>}
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

function ChartLegend({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {data.slice(0, 8).map((entry, index) => (
        <div key={entry.name} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-titanium">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
            <span className="truncate">{entry.name}</span>
          </span>
          <span className="shrink-0 font-medium text-ink">{formatCurrency(entry.value)}</span>
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
            <span className="font-medium text-ink">{formatCurrency(Number(item.value ?? 0))}</span>
          </p>
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
    <div className="glass-panel apple-card-sm px-3 py-2 text-sm">
      <p className="text-ink">{item.name}</p>
      <p className="text-titanium">{formatCurrency(item.value)}</p>
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
  const content = holding.cost_known === false
    ? <UnknownCostLabel label={unknownLabel} />
    : formatAverageCost(holding);

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

function formatAverageCost(holding: EnrichedHolding) {
  return formatCurrency(holding.average_cost, holding.cost_currency);
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
            <p className="text-xs text-titanium">{t.value}</p>
            <p className="mt-1 text-ink">{formatCurrency(source.valueUsd)}</p>
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
  const allCategories = [...cashflowCategories.income, ...cashflowCategories.expense];
  const category = allCategories.find((item) => item.id === categoryId);
  if (!category) return categoryId;
  return locale === "zh" ? category.zh : category.en;
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
): CashflowCalendarEvent[] {
  const zh = locale === "zh";
  const visibleMonthKeys = new Set(getRecentMonthKeys(12).concat(getFutureMonthKeys(12)));
  const events: CashflowCalendarEvent[] = [];

  transactions.forEach((transaction) => {
    events.push({
      amount: `${transaction.transaction_type === "income" ? "+" : "-"}${formatCurrency(transaction.amount, transaction.currency)}`,
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
            amount: formatCurrency(expense.amount, expense.currency),
            date: `${monthKey}-${String(day).padStart(2, "0")}`,
            kind: "recurring",
            label: expense.is_subscription ? (zh ? "訂閱" : "Subscription") : getRecurringCategoryLabel(expense.category, locale),
            title: expense.name,
          });
        });
        return;
      }

      events.push({
        amount: formatCurrency(expense.amount, expense.currency),
        date: expense.next_due_date,
        kind: "recurring",
        label: expense.is_subscription ? (zh ? "訂閱" : "Subscription") : getRecurringCategoryLabel(expense.category, locale),
        title: expense.name,
      });
    });

  debts
    .filter((debt) => debt.is_active)
    .forEach((debt) => {
      events.push({
        amount: formatCurrency(debt.minimum_payment, debt.currency),
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

function formatCashflowTotals(transactions: CashflowTransaction[], type: CashflowType) {
  return formatCurrencyBuckets(
    transactions
      .filter((transaction) => transaction.transaction_type === type)
      .reduce<Record<Currency, number>>((acc, transaction) => {
        acc[transaction.currency] = (acc[transaction.currency] ?? 0) + transaction.amount;
        return acc;
      }, { USD: 0, TWD: 0 }),
  );
}

function formatNetCashflow(transactions: CashflowTransaction[]) {
  return formatCurrencyBuckets(
    transactions.reduce<Record<Currency, number>>((acc, transaction) => {
      const sign = transaction.transaction_type === "income" ? 1 : -1;
      acc[transaction.currency] = (acc[transaction.currency] ?? 0) + transaction.amount * sign;
      return acc;
    }, { USD: 0, TWD: 0 }),
  );
}

function formatRecurringMonthlyTotal(expenses: RecurringExpense[]) {
  return formatCurrencyBuckets(
    expenses.reduce<Record<Currency, number>>((acc, expense) => {
      const monthlyAmount = expense.frequency === "monthly" ? expense.amount : expense.amount / 12;
      acc[expense.currency] = (acc[expense.currency] ?? 0) + monthlyAmount;
      return acc;
    }, { USD: 0, TWD: 0 }),
  );
}

function formatRecurringAnnualTotal(expenses: RecurringExpense[]) {
  return formatCurrencyBuckets(
    expenses.reduce<Record<Currency, number>>((acc, expense) => {
      const annualAmount = expense.frequency === "monthly" ? expense.amount * 12 : expense.amount;
      acc[expense.currency] = (acc[expense.currency] ?? 0) + annualAmount;
      return acc;
    }, { USD: 0, TWD: 0 }),
  );
}

function formatDebtPrincipalTotal(debts: Debt[]) {
  return formatCurrencyBuckets(
    debts.reduce<Record<Currency, number>>((acc, debt) => {
      acc[debt.currency] = (acc[debt.currency] ?? 0) + debt.remaining_principal;
      return acc;
    }, { USD: 0, TWD: 0 }),
  );
}

function formatDebtMonthlyPaymentTotal(debts: Debt[]) {
  return formatCurrencyBuckets(
    debts.reduce<Record<Currency, number>>((acc, debt) => {
      acc[debt.currency] = (acc[debt.currency] ?? 0) + debt.minimum_payment;
      return acc;
    }, { USD: 0, TWD: 0 }),
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
        .filter((transaction) => transaction.category === budget.category)
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

function formatBudgetLimitTotal(rows: BudgetRow[]) {
  return formatCurrencyBuckets(
    rows.reduce<Record<Currency, number>>((acc, row) => {
      acc[row.budget.currency] = (acc[row.budget.currency] ?? 0) + row.budget.amount;
      return acc;
    }, { USD: 0, TWD: 0 }),
  );
}

function formatBudgetSpentTotal(rows: BudgetRow[]) {
  return formatCurrencyBuckets(
    rows.reduce<Record<Currency, number>>((acc, row) => {
      acc[row.budget.currency] = (acc[row.budget.currency] ?? 0) + row.spent;
      return acc;
    }, { USD: 0, TWD: 0 }),
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

function getDebtPrincipalUsd(debts: Debt[], twdToUsd: number) {
  return debts
    .filter((debt) => debt.is_active)
    .reduce((sum, debt) => sum + currencyAmountToUsd(debt.remaining_principal, debt.currency, twdToUsd), 0);
}

function getMonthlyCashflowChartData(transactions: CashflowTransaction[], twdToUsd: number, locale: Locale) {
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

function getExpenseCategoryChartData(transactions: CashflowTransaction[], twdToUsd: number, locale: Locale) {
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

function getFixedExpenseTrendData(expenses: RecurringExpense[], twdToUsd: number, locale: Locale) {
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

function getSubscriptionAnnualizedData(expenses: RecurringExpense[], twdToUsd: number) {
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

function getDebtDeclineData(debts: Debt[], twdToUsd: number, locale: Locale) {
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

function getNetWorthTrendData(transactions: CashflowTransaction[], currentNetWorthUsd: number, twdToUsd: number, locale: Locale) {
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


function formatRecurringAnnualizedAmount(expense: RecurringExpense) {
  const annualAmount = expense.frequency === "monthly" ? expense.amount * 12 : expense.amount;
  return formatCurrency(annualAmount, expense.currency);
}

function daysUntil(dateValue: string) {
  const dueDate = parseDateOnly(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
}

function formatCurrencyBuckets(values: Record<Currency, number>) {
  const items = (Object.entries(values) as Array<[Currency, number]>)
    .filter(([, value]) => Math.abs(value) > 0.000001)
    .map(([currency, value]) => formatCurrency(value, currency));

  return items.length ? items.join(" / ") : formatCurrency(0);
}

function holdingSourceKey(holding: EnrichedHolding) {
  const symbol = holding.symbol.toUpperCase();
  return [holding.asset_type, symbol, holding.market_data_id ?? symbol].join(":");
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
