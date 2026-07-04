import type {
  CashflowTransaction,
  Currency,
  Debt,
  EnrichedHolding,
  Holding,
  Locale,
  MarketQuote,
  RecurringExpense,
} from "@/lib/types";

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value > 1000 ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function enrichHoldings(
  holdings: Holding[],
  quotes: Record<string, MarketQuote>,
  twdToUsd: number,
): EnrichedHolding[] {
  const enriched = holdings.map((holding) => {
    const symbol = holding.symbol.toUpperCase();
    const quote = quotes[holding.id] ?? quotes[holding.market_data_id ?? ""] ?? quotes[symbol];
    const priceUsd = quote?.priceUsd ?? fallbackPriceUsd(holding, twdToUsd);
    const costUsd = holding.cost_currency === "TWD" ? holding.average_cost * twdToUsd : holding.average_cost;
    const units = holding.asset_type === "tw_stock" ? holding.quantity * 1000 : holding.quantity;
    const valueUsd = units * priceUsd;
    const costKnown = holding.cost_known !== false;
    const costBasisUsd = costKnown ? units * costUsd : 0;
    const gainUsd = costKnown ? valueUsd - costBasisUsd : 0;
    const gainPercent = costBasisUsd ? (gainUsd / costBasisUsd) * 100 : 0;
    const dayChangeRate = quote ? quote.dayChangePercent / 100 : 0;
    const dayChangeUsd = dayChangeRate === -1 ? 0 : valueUsd - valueUsd / (1 + dayChangeRate);

    return {
      ...holding,
      quote,
      valueUsd,
      costBasisUsd,
      gainUsd,
      gainPercent,
      dayChangeUsd,
      allocationPercent: 0,
    };
  });

  const totalValue = enriched.reduce((sum, holding) => sum + holding.valueUsd, 0);
  return enriched.map((holding) => ({
    ...holding,
    allocationPercent: totalValue ? (holding.valueUsd / totalValue) * 100 : 0,
  }));
}

export function getPortfolioTotals(holdings: EnrichedHolding[]) {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costBasisUsd, 0);
  const totalGain = holdings.reduce((sum, holding) => sum + holding.gainUsd, 0);
  const totalReturn = totalCost ? (totalGain / totalCost) * 100 : 0;
  const dayChange = holdings.reduce((sum, holding) => sum + holding.dayChangeUsd, 0);
  const dayChangePercent = totalValue ? (dayChange / totalValue) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalGain,
    totalReturn,
    dayChange,
    dayChangePercent,
  };
}

export function aggregateHoldingsForOverview(holdings: EnrichedHolding[]) {
  const groups = holdings.reduce<Map<string, EnrichedHolding[]>>((acc, holding) => {
    const symbol = holding.symbol.toUpperCase();
    const key = [holding.asset_type, symbol, holding.market_data_id ?? symbol].join(":");
    acc.set(key, [...(acc.get(key) ?? []), holding]);
    return acc;
  }, new Map());

  const aggregated = [...groups.values()].map((items) => {
    if (items.length === 1) return items[0];

    const base = items[0];
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const valueUsd = items.reduce((sum, item) => sum + item.valueUsd, 0);
    const costBasisUsd = items.reduce((sum, item) => sum + item.costBasisUsd, 0);
    const gainUsd = items.reduce((sum, item) => sum + item.gainUsd, 0);
    const dayChangeUsd = items.reduce((sum, item) => sum + item.dayChangeUsd, 0);
    const allCostsKnown = items.every((item) => item.cost_known !== false);
    const sourceLabels = [...new Set(items.map((item) => item.source_label).filter(Boolean))];

    return {
      ...base,
      id: `overview:${base.asset_type}:${base.symbol.toUpperCase()}:${base.market_data_id ?? base.symbol.toUpperCase()}`,
      name: sourceLabels.length > 1 ? `${base.name} (${sourceLabels.length} sources)` : base.name,
      quantity,
      valueUsd,
      costBasisUsd,
      gainUsd,
      gainPercent: costBasisUsd ? (gainUsd / costBasisUsd) * 100 : 0,
      dayChangeUsd,
      cost_known: allCostsKnown,
      source_label: sourceLabels.length > 1 ? `${sourceLabels.length} sources` : base.source_label,
    } satisfies EnrichedHolding;
  });

  const totalValue = aggregated.reduce((sum, holding) => sum + holding.valueUsd, 0);
  return aggregated
    .map((holding) => ({
      ...holding,
      allocationPercent: totalValue ? (holding.valueUsd / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export function groupBy<T extends string>(
  holdings: EnrichedHolding[],
  getKey: (holding: EnrichedHolding) => T,
) {
  const totals = holdings.reduce<Record<T, number>>((acc, holding) => {
    const key = getKey(holding);
    acc[key] = (acc[key] ?? 0) + holding.valueUsd;
    return acc;
  }, {} as Record<T, number>);

  return Object.entries(totals)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value);
}

function fallbackPriceUsd(holding: Holding, twdToUsd: number) {
  if (holding.asset_type === "cash") {
    return holding.symbol.toUpperCase() === "TWD" ? twdToUsd : 1;
  }
  return holding.cost_currency === "TWD" ? holding.average_cost * twdToUsd : holding.average_cost;
}

export type CurrencyBuckets = Record<Currency, number>;

export type MonthlyCashflowOverview = {
  income: CurrencyBuckets;
  expenses: CurrencyBuckets;
  recurring: CurrencyBuckets;
  debtPayments: CurrencyBuckets;
  leftover: CurrencyBuckets;
  pressureRatio: number;
};

export function parseDateOnly(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`);
}

export function isSameMonth(dateValue: string) {
  const date = parseDateOnly(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function emptyCurrencyBuckets(): CurrencyBuckets {
  return { USD: 0, TWD: 0 };
}

export function currencyBucketTotal(values: CurrencyBuckets) {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

export function currencyAmountToUsd(value: number, currency: Currency, twdToUsd: number) {
  return currency === "TWD" ? value * twdToUsd : value;
}

export function currencyBucketsToUsd(values: CurrencyBuckets, twdToUsd: number) {
  return (Object.entries(values) as Array<[Currency, number]>).reduce(
    (sum, [currency, value]) => sum + currencyAmountToUsd(value, currency, twdToUsd),
    0,
  );
}

export function getMonthlyCashflowOverview(
  transactions: CashflowTransaction[],
  recurringExpenses: RecurringExpense[],
  debts: Debt[],
): MonthlyCashflowOverview {
  const income = emptyCurrencyBuckets();
  const expenses = emptyCurrencyBuckets();
  const recurring = emptyCurrencyBuckets();
  const debtPayments = emptyCurrencyBuckets();

  transactions.forEach((transaction) => {
    if (transaction.transaction_type === "income") {
      income[transaction.currency] += transaction.amount;
    } else {
      expenses[transaction.currency] += transaction.amount;
    }
  });

  recurringExpenses.forEach((expense) => {
    const monthlyAmount = expense.frequency === "monthly" ? expense.amount : expense.amount / 12;
    recurring[expense.currency] += monthlyAmount;
  });

  debts.forEach((debt) => {
    debtPayments[debt.currency] += debt.minimum_payment;
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

export function formatHealthRatio(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}

export function getFinancialHealthScore({
  dataIssues,
  debtIncomeRatio,
  fixedPressure,
  savingsRate,
}: {
  dataIssues: number;
  debtIncomeRatio: number | null;
  fixedPressure: number | null;
  savingsRate: number | null;
}) {
  let score = 100;

  if (savingsRate === null) score -= 15;
  else if (savingsRate < 0) score -= 30;
  else if (savingsRate < 10) score -= 18;
  else if (savingsRate < 20) score -= 8;

  if (fixedPressure === null) score -= 10;
  else if (fixedPressure > 70) score -= 25;
  else if (fixedPressure > 50) score -= 12;

  if (debtIncomeRatio !== null) {
    if (debtIncomeRatio > 36) score -= 20;
    else if (debtIncomeRatio > 20) score -= 8;
  }

  score -= Math.min(dataIssues * 3, 12);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildFinancialHealthNotes({
  dataIssues,
  debtIncomeRatio,
  fixedPressure,
  incomeUsd,
  locale,
  overBudgetCount,
  savingsRate,
  subscriptionsToReviewCount,
  unknownCostCount,
}: {
  dataIssues: number;
  debtIncomeRatio: number | null;
  fixedPressure: number | null;
  incomeUsd: number;
  locale: Locale;
  overBudgetCount: number;
  savingsRate: number | null;
  subscriptionsToReviewCount: number;
  unknownCostCount: number;
}) {
  const zh = locale === "zh";
  const notes: string[] = [];

  if (incomeUsd <= 0) {
    notes.push(zh ? "先記錄本月收入，儲蓄率、固定支出壓力與負債收入比才會更準。" : "Add this month's income so savings rate, fixed pressure, and debt-to-income become meaningful.");
  }
  if (savingsRate !== null && savingsRate < 0) {
    notes.push(zh ? "本月預估結餘為負，代表收入扣掉支出、固定扣款與債務最低付款後不夠用。" : "Estimated leftover is negative after expenses, recurring bills, and debt minimums.");
  } else if (savingsRate !== null && savingsRate < 10) {
    notes.push(zh ? "本月儲蓄率偏低，可以先從固定支出或預算超支分類開始檢查。" : "Savings rate is low. Start by reviewing recurring costs or over-budget categories.");
  }
  if (fixedPressure !== null && fixedPressure > 70) {
    notes.push(zh ? "固定支出壓力偏高，收入中太多比例已被固定扣款與債務最低付款占用。" : "Fixed-cost pressure is high; recurring bills and debt minimums are taking a large share of income.");
  }
  if (debtIncomeRatio !== null && debtIncomeRatio > 36) {
    notes.push(zh ? "負債收入比偏高，建議優先檢查高利率債務與最低付款安排。" : "Debt-to-income is elevated. Review high-interest debts and minimum payment plans first.");
  }
  if (overBudgetCount > 0) {
    notes.push(zh ? `目前有 ${overBudgetCount} 個預算分類超支。` : `${overBudgetCount} budget categories are currently over budget.`);
  }
  if (subscriptionsToReviewCount > 0) {
    notes.push(zh ? `有 ${subscriptionsToReviewCount} 個訂閱或固定支出標記為少用/可取消。` : `${subscriptionsToReviewCount} subscriptions or recurring items are marked as rarely used or cancel candidates.`);
  }
  if (unknownCostCount > 0) {
    notes.push(zh ? `有 ${unknownCostCount} 筆資產成本未知，總損益與報酬率會不完整。` : `${unknownCostCount} holdings have unknown cost, so gain/loss and return are incomplete.`);
  }
  if (dataIssues > unknownCostCount) {
    notes.push(zh ? "部分資產缺少價格資料，總市值可能低估或不完整。" : "Some holdings are missing price data, so total value may be understated or incomplete.");
  }
  if (!notes.length) {
    notes.push(zh ? "目前沒有明顯警訊。你可以持續補齊收入、支出、預算與成本資料，讓這頁更準。" : "No major warnings right now. Keep income, spending, budgets, and cost basis updated to improve this view.");
  }

  return notes;
}

export type HealthQuest = {
  id: string;
  label: string;
  points: number;
};

export function buildHealthQuests({
  dataIssues,
  debtIncomeRatio,
  fixedPressure,
  locale,
  savingsRate,
}: {
  dataIssues: number;
  debtIncomeRatio: number | null;
  fixedPressure: number | null;
  locale: Locale;
  savingsRate: number | null;
}): HealthQuest[] {
  const zh = locale === "zh";
  const quests: HealthQuest[] = [];

  if (savingsRate === null) {
    quests.push({ id: "record-income", label: zh ? "記錄本月收入，讓儲蓄率能被計算" : "Log this month's income so savings rate can be calculated", points: 15 });
  } else if (savingsRate < 0) {
    quests.push({ id: "savings-positive", label: zh ? "讓本月結餘轉正（收入 > 全部支出）" : "Get this month's leftover back to positive", points: 12 });
  } else if (savingsRate < 10) {
    quests.push({ id: "savings-10", label: zh ? "把本月儲蓄率拉到 10% 以上" : "Raise savings rate above 10%", points: 10 });
  } else if (savingsRate < 20) {
    quests.push({ id: "savings-20", label: zh ? "把本月儲蓄率拉到 20% 以上" : "Raise savings rate above 20%", points: 8 });
  }

  if (fixedPressure === null) {
    quests.push({ id: "record-fixed", label: zh ? "補齊收入資料，計算固定支出壓力" : "Add income data to unlock fixed-cost pressure", points: 10 });
  } else if (fixedPressure > 70) {
    quests.push({ id: "fixed-70", label: zh ? "把固定支出壓力降到 70% 以下" : "Bring fixed-cost pressure below 70%", points: 13 });
  } else if (fixedPressure > 50) {
    quests.push({ id: "fixed-50", label: zh ? "把固定支出壓力降到 50% 以下" : "Bring fixed-cost pressure below 50%", points: 12 });
  }

  if (debtIncomeRatio !== null) {
    if (debtIncomeRatio > 36) {
      quests.push({ id: "dti-36", label: zh ? "把負債收入比降到 36% 以下" : "Bring debt-to-income below 36%", points: 12 });
    } else if (debtIncomeRatio > 20) {
      quests.push({ id: "dti-20", label: zh ? "把負債收入比降到 20% 以下" : "Bring debt-to-income below 20%", points: 8 });
    }
  }

  if (dataIssues > 0) {
    quests.push({
      id: "data-quality",
      label: zh ? `補齊 ${dataIssues} 筆缺成本或缺價格的資產資料` : `Fix ${dataIssues} holdings with missing cost or price data`,
      points: Math.min(dataIssues * 3, 12),
    });
  }

  return quests.sort((a, b) => b.points - a.points);
}
