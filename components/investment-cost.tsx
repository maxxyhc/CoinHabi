"use client";
import type { Holding, Locale } from "@/lib/types";
import { getInvestmentCost } from "@/lib/financial-summary";
import { useMoney } from "@/components/money-context";
import { financialCopy } from "./financial-summary-copy";
import { InfoTip } from "./info-tip";

export function InvestmentCost({ holdings, locale }: { holdings: Holding[]; locale: Locale }) {
  const money = useMoney();
  const cost = getInvestmentCost(holdings, money.fx);
  const c = financialCopy(locale);
  return <div className="mt-3 text-xs leading-5 text-titanium">
    <div className="flex flex-wrap items-center gap-x-2"><span>{c.cost}</span><strong className="font-semibold text-ink">{cost.count && !cost.known ? c.costNone : money.fmtUsd(cost.total)}</strong><InfoTip text={c.costHelp} /></div>
    {cost.missing > 0 && <p>{c.partial} ({cost.missing}/{cost.count})</p>}
  </div>;
}
