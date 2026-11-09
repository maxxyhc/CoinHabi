import { currencyAmountToUsd, getHoldingUnits, type CurrencyFxInput } from "./calculations";
import type { CashflowTransaction, Holding } from "./types";

/** Acquisition cost of current positions; break-even prices include different adjustments. */
export function getInvestmentCost(holdings: Holding[], fx: CurrencyFxInput) {
  const investments = holdings.filter(h => h.asset_type !== "cash" && h.quantity > 0);
  const known = investments.filter(h => h.cost_known !== false && Number.isFinite(h.average_cost) && h.average_cost >= 0);
  return {
    total: known.reduce((sum, h) => sum + currencyAmountToUsd(getHoldingUnits(h) * h.average_cost, h.cost_currency, fx), 0),
    known: known.length,
    missing: investments.length - known.length,
    count: investments.length,
  };
}

export function getMonthlyFlow(transactions: CashflowTransaction[], month: string, fx: CurrencyFxInput) {
  const rows = transactions.filter(t => t.transaction_date.slice(0, 7) === month);
  const incomes: Record<string, number> = {};
  const expenses: Record<string, number> = {};
  let investment = 0;
  for (const row of rows) {
    const value = currencyAmountToUsd(row.amount, row.currency, fx);
    if (row.transaction_type === "expense" && row.category === "investment") {
      investment += value;
    } else {
      const groups = row.transaction_type === "income" ? incomes : expenses;
      groups[row.category] = (groups[row.category] ?? 0) + value;
    }
  }
  const income = Object.values(incomes).reduce((a,b) => a+b, 0);
  const expense = Object.values(expenses).reduce((a,b) => a+b, 0);
  const net = income - expense - investment;
  return { income, expense, investment, net, surplus: Math.max(0, net), gap: Math.max(0, -net), incomes, expenses, count: rows.length };
}
