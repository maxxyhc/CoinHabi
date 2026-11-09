import { totalBudgetCategory } from "@/lib/types";
import type {
  CashflowTransaction,
  Debt,
  Holding,
  InvestmentTransaction,
  MarketResponse,
  MonthlyBudget,
  RecurringExpense,
} from "@/lib/types";

/** Read-only sample data powering the /demo experience. Not persisted. */
export function createDemoData() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const date = (day: number) => `${currentYear}-${currentMonth}-${String(day).padStart(2, "0")}`;
  const isoNow = new Date().toISOString();
  const trackingStart = new Date(now);
  trackingStart.setDate(trackingStart.getDate() - 45);
  const saleDate = new Date(now);
  saleDate.setDate(saleDate.getDate() - 12);

  const holdings: Holding[] = [
    { id: "demo-h-1", user_id: "demo-user", asset_type: "us_stock", symbol: "AAPL", name: "Apple Inc.", quantity: 8, average_cost: 172, break_even_price: null, gain_calculation_mode: "average_cost", cost_currency: "USD", notes: null, market_data_id: "AAPL", source_kind: "manual", source_label: "Manual", source_account_id: null, source_asset_id: null, cost_known: true, created_at: isoNow, updated_at: isoNow },
    { id: "demo-h-2", user_id: "demo-user", asset_type: "tw_stock", symbol: "2330.TW", name: "Taiwan Semiconductor", quantity: 2, average_cost: 880, break_even_price: 886.5, gain_calculation_mode: "break_even", cost_currency: "TWD", notes: null, market_data_id: "2330.TW", source_kind: "manual", source_label: "Manual", source_account_id: null, source_asset_id: null, cost_known: true, created_at: isoNow, updated_at: isoNow },
    { id: "demo-h-3", user_id: "demo-user", asset_type: "crypto", symbol: "BTC", name: "Bitcoin", quantity: 0.035, average_cost: 42000, break_even_price: null, gain_calculation_mode: "estimated", cost_currency: "USD", notes: null, market_data_id: "bitcoin", source_kind: "wallet", source_label: "Demo BTC wallet", source_account_id: "demo-wallet-btc", source_asset_id: "demo-btc", cost_known: false, created_at: isoNow, updated_at: isoNow },
    { id: "demo-h-4", user_id: "demo-user", asset_type: "crypto", symbol: "ETH", name: "Ethereum", quantity: 1.4, average_cost: 2400, break_even_price: null, gain_calculation_mode: "estimated", cost_currency: "USD", notes: null, market_data_id: "ethereum", source_kind: "wallet", source_label: "Demo ETH wallet", source_account_id: "demo-wallet-eth", source_asset_id: "demo-eth", cost_known: false, created_at: isoNow, updated_at: isoNow },
    { id: "demo-h-5", user_id: "demo-user", asset_type: "cash", symbol: "USD", name: "台新 Richart 活存", quantity: 3500, average_cost: 1, break_even_price: null, gain_calculation_mode: "average_cost", cost_currency: "USD", notes: null, market_data_id: null, source_kind: "manual", source_label: "Manual", source_account_id: null, source_asset_id: null, cost_known: true, created_at: isoNow, updated_at: isoNow },
  ];

  const transactions: CashflowTransaction[] = [
    { id: "demo-t-1", user_id: "demo-user", transaction_type: "income", amount: 5200, currency: "USD", category: "salary", description: "Monthly salary", transaction_date: date(5), payment_method: "Bank transfer", notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-t-2", user_id: "demo-user", transaction_type: "expense", amount: 18.5, currency: "USD", category: "food", description: "Lunch", transaction_date: date(8), payment_method: "Credit card", notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-t-3", user_id: "demo-user", transaction_type: "expense", amount: 78, currency: "USD", category: "transport", description: "Gas", transaction_date: date(10), payment_method: "Credit card", notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-t-4", user_id: "demo-user", transaction_type: "expense", amount: 145, currency: "USD", category: "shopping", description: "Household supplies", transaction_date: date(12), payment_method: "Credit card", notes: null, created_at: isoNow, updated_at: isoNow },
    { id: "demo-t-5", user_id: "demo-user", transaction_type: "income", amount: 350, currency: "USD", category: "side_income", description: "Freelance project", transaction_date: date(18), payment_method: "Transfer", notes: null, created_at: isoNow, updated_at: isoNow },
  ];

  const investmentTransactions: InvestmentTransaction[] = [
    { id: "demo-it-3", user_id: "demo-user", holding_id: "demo-h-1", asset_type: "us_stock", symbol: "AAPL", name: "Apple Inc.", transaction_type: "sell", quantity: 2, price_per_unit: 190, fees: 1, currency: "USD", cost_basis: 344, proceeds: 379, realized_gain: 35, transaction_date: saleDate.toISOString().slice(0, 10), notes: "Partial profit taking", created_at: saleDate.toISOString() },
    { id: "demo-it-2", user_id: "demo-user", holding_id: "demo-h-2", asset_type: "tw_stock", symbol: "2330.TW", name: "Taiwan Semiconductor", transaction_type: "opening", quantity: 2, price_per_unit: 880, fees: 0, currency: "TWD", cost_basis: 1760000, proceeds: null, realized_gain: null, transaction_date: trackingStart.toISOString().slice(0, 10), notes: null, created_at: trackingStart.toISOString() },
    { id: "demo-it-1", user_id: "demo-user", holding_id: "demo-h-1", asset_type: "us_stock", symbol: "AAPL", name: "Apple Inc.", transaction_type: "opening", quantity: 10, price_per_unit: 172, fees: 0, currency: "USD", cost_basis: 1720, proceeds: null, realized_gain: null, transaction_date: trackingStart.toISOString().slice(0, 10), notes: null, created_at: trackingStart.toISOString() },
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
    { id: "demo-b-1", user_id: "demo-user", month: `${currentYear}-${currentMonth}-01`, category: totalBudgetCategory, amount: 1400, currency: "USD", notes: null, created_at: isoNow, updated_at: isoNow },
  ];

  const market: MarketResponse = {
    refreshedAt: isoNow,
    fx: {
      usdToTwd: 32.2,
      twdToUsd: 1 / 32.2,
      usdToEur: 0.92,
      eurToUsd: 1 / 0.92,
      usdToJpy: 157,
      jpyToUsd: 1 / 157,
      usdToKrw: 1380,
      krwToUsd: 1 / 1380,
      usdRates: {
        USD: 1,
        TWD: 32.2,
        EUR: 0.92,
        JPY: 157,
        KRW: 1380,
        HKD: 7.8,
        GBP: 0.79,
        CAD: 1.36,
        AUD: 1.52,
        SGD: 1.35,
        CNY: 7.2,
        CHF: 0.9,
        INR: 83,
        SAR: 3.75,
      },
    },
    quotes: {
      "demo-h-1": { symbol: "AAPL", price: 196.5, currency: "USD", priceUsd: 196.5, dayChangePercent: 0.8, source: "Demo" },
      "demo-h-2": { symbol: "2330.TW", price: 960, currency: "TWD", priceUsd: 960 / 32.2, dayChangePercent: -0.4, source: "Demo" },
      "demo-h-3": { symbol: "BTC", price: 61500, currency: "USD", priceUsd: 61500, dayChangePercent: 1.9, source: "Demo" },
      "demo-h-4": { symbol: "ETH", price: 3350, currency: "USD", priceUsd: 3350, dayChangePercent: -1.1, source: "Demo" },
      "demo-h-5": { symbol: "USD", price: 1, currency: "USD", priceUsd: 1, dayChangePercent: 0, source: "Demo" },
    },
  };

  return { budgets, debts, holdings, investmentTransactions, market, recurringExpenses, transactions };
}
