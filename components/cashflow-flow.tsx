"use client";
import { ChevronLeft, ChevronRight, Wallet, Landmark, TrendingUp, ReceiptText, ArrowDownLeft, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { takeFlowActivity } from "@/lib/flow-activity";
import { currencyAmountToUsd } from "@/lib/calculations";
import { getMonthlyFlow } from "@/lib/financial-summary";
import type { CashflowTransaction, Debt, Locale } from "@/lib/types";
import { tx } from "@/lib/i18n";
import { useMoney } from "./money-context";
import { financialCopy } from "./financial-summary-copy";

const categoryNames: Record<string, string> = { salary: "Salary", bonus: "Bonus", side_income: "Side income", investment_income: "Investment income", other_income: "Other income", food: "Food", transport: "Transport", housing: "Housing", shopping: "Shopping", entertainment: "Entertainment", health: "Health", education: "Education", investment: "Investment", other_expense: "Other expense" };

export function CashflowFlow({ transactions, debts, assetValue, cashValue, locale }: { transactions: CashflowTransaction[]; debts: Debt[]; assetValue: number; cashValue: number; locale: Locale }) {
  const money = useMoney();
  const c = financialCopy(locale);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
  function shiftMonth(offset: number) {
    const [year, current] = month.split("-").map(Number);
    const next = new Date(year, current - 1 + offset, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}`);
    setDetail(null);
    setActivity(null);
  }
  const [detail, setDetail] = useState<"income" | "expense" | "investment" | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const [activity, setActivity] = useState<{ id: string; branch: string } | null>(null);
  const [motionPath, setMotionPath] = useState("");
  const [treeVisible, setTreeVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;
    const observer = new IntersectionObserver(([entry]) => setTreeVisible(entry.isIntersecting && entry.intersectionRatio >= 0.5), { threshold: 0.5 });
    observer.observe(tree);
    return () => observer.disconnect();
  }, []);
  const monthRows = transactions.filter(row => row.transaction_date.slice(0, 7) === month);
  function replayLatest() {
    const latest = [...monthRows].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.transaction_date.localeCompare(a.transaction_date))[0];
    if (!latest) return;
    setActivity({ id: `replay-${Date.now()}`, branch: latest.transaction_type === "income" ? "income" : latest.category === "investment" ? "investment" : "expense" });
  }
  useEffect(() => {
    // Defer consumption so React's development effect probe cannot discard an event.
    if (!treeVisible || !pageVisible) return;
    const timer = window.setTimeout(() => {
      if (!activity) setActivity(takeFlowActivity(transactions, month));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [transactions, month, activity, treeVisible, pageVisible]);
  useEffect(() => {
    if (!activity) return;
    const timer = window.setTimeout(() => setActivity(null), 4500);
    return () => window.clearTimeout(timer);
  }, [activity]);
  useLayoutEffect(() => {
    const tree = treeRef.current;
    if (!tree || !activity) return;
    const measure = () => {
      const source = tree.querySelector(".finance-tree-income")?.getBoundingClientRect();
      const target = tree.querySelector(`[data-flow-branch="${activity.branch}"]`)?.getBoundingClientRect();
      const bounds = tree.getBoundingClientRect();
      if (!source || !target) { setMotionPath(""); return; }
      const x = source.right - bounds.left, y = source.top + source.height / 2 - bounds.top;
      const endX = target.left - bounds.left, endY = target.top + target.height / 2 - bounds.top;
      const trunk = (x + endX) / 2;
      setMotionPath(`M ${x} ${y} H ${trunk} V ${endY} H ${endX}`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tree);
    return () => observer.disconnect();
  }, [activity]);
  const flow = getMonthlyFlow(transactions, month, money.fx);
  const debt = debts.filter(d => d.is_active).reduce((sum,d) => sum + currencyAmountToUsd(d.remaining_principal, d.currency, money.fx), 0);
  const labels = locale === "zh"
    ? { bills: "生活帳單", investment: "投資", cash: "現金", monthly: "所選月份", current: "目前餘額", invested: "月份投入", balance: "月份收支結餘", note: "連線表示財務分類，並非實際轉帳。收入、生活帳單與投資投入依所選月份；負債及現金顯示目前餘額。" }
    : { bills: tx(locale, "Living expenses"), investment: tx(locale, "Investment"), cash: tx(locale, "Cash"), monthly: c.month, current: c.balances, invested: c.investment, balance: c.net, note: "Connections show financial categories, not actual transfers. Income, bills and investment contributions use the selected month; debt and cash show current balances." };
  const branches = [
    { key: "expense", title: labels.bills, value: flow.expense, period: labels.monthly, icon: ReceiptText, color: "#e87983", sub: c.expenseDetails },
    { key: "debt", title: c.debt, value: debt, period: labels.current, icon: Landmark, color: "#e5ad53", sub: c.debt },
    { key: "investment", title: labels.investment, value: flow.investment, period: labels.monthly, icon: TrendingUp, color: "#8b8ce8", sub: `${labels.invested} · ${money.fmtUsd(flow.investment)}` },
    { key: "cash", title: labels.cash, value: cashValue, period: labels.current, icon: Wallet, color: "#55bca2", sub: `${labels.balance} · ${money.fmtUsd(flow.net)}` },
  ];
  const selectedRows = transactions.filter(t => t.transaction_date.slice(0,7) === month && (detail === "income" ? t.transaction_type === "income" : t.transaction_type === "expense" && (detail === "investment" ? t.category === "investment" : t.category !== "investment")));
  return <div className="space-y-5">
    <section className="glass-panel apple-card min-w-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-ink">{c.tab}</h3>
        <div className="flex items-center gap-1"><button type="button" aria-label={tx(locale,"Previous month")} className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl text-titanium" onClick={()=>shiftMonth(-1)}><ChevronLeft size={18} /></button><label className="flex items-center gap-2 text-sm text-titanium">{c.month}<input aria-label={c.month} type="month" value={month} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) { setMonth(e.target.value); setDetail(null); setActivity(null); } }} className="input-control focus-ring min-h-11 min-w-0 w-40 px-3" /></label><button type="button" aria-label={tx(locale,"Next month")} className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl text-titanium" onClick={()=>shiftMonth(1)}><ChevronRight size={18} /></button></div>
      </div>
      <div className="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-2">
        <span role="status" className="text-xs font-medium text-titanium">{activity ? (locale === "zh" ? `已更新 · ${activity.branch === "income" ? "收入" : activity.branch === "investment" ? "投資投入" : "生活帳單"}` : "Record updated") : ""}</span>
        <button type="button" disabled={!monthRows.length || !!activity} onClick={replayLatest} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-xs text-titanium disabled:opacity-40"><RotateCcw size={14} />{locale === "zh" ? "重播最近記帳" : "Replay latest entry"}</button>
      </div>
      <div ref={treeRef} className="finance-tree mt-7" aria-label={c.tab}>
        {activity && motionPath && activity.branch !== "income" && <svg key={activity.id} className="finance-flow-overlay" aria-hidden="true">
          <defs>
            {/* Jitters the bolt so it reads as an electric arc rather than a smooth dot. */}
            <filter id={`finance-arc-${activity.id}`} filterUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="turbulence" baseFrequency="0.35" numOctaves="2" result="noise">
                <animate attributeName="baseFrequency" values="0.35;0.6;0.28;0.5" dur="0.2s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <path d={motionPath} pathLength={100} className="finance-flow-wire" />
          <g className="finance-flow-glow">
            <path d={motionPath} pathLength={100} className="finance-flow-bolt" filter={`url(#finance-arc-${activity.id})`} />
            <path d={motionPath} pathLength={100} className="finance-flow-core" />
          </g>
        </svg>}
        <div className="finance-tree-source">
          <div className={`finance-tree-card finance-tree-income ${activity?.branch === "income" ? "finance-flow-arrival finance-flow-income-arrival" : ""}`}>
            <span className="finance-tree-icon" style={{ color: "var(--accent)" }}><ArrowDownLeft size={22} /></span>
            <p className="mt-3 text-sm font-medium text-ink">{c.income}</p>
            <p className="mt-1 text-[10px] text-titanium sm:text-xs">{labels.monthly}</p>
            <p className="finance-tree-amount">{money.fmtUsd(flow.income)}</p>
          </div>
        </div>
        <div className="finance-tree-branches">
          {branches.map(branch => <div className="finance-tree-branch" key={branch.key}>
            <div data-flow-branch={branch.key} className={`finance-tree-card ${activity?.branch === branch.key ? "finance-flow-arrival" : ""}`} style={{ borderLeftColor: branch.color, "--flow-color": branch.color } as React.CSSProperties}>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="finance-tree-icon" style={{ color: branch.color }}><branch.icon size={20} /></span>
                <div className="min-w-0"><h4 className="text-sm font-semibold text-ink sm:text-base">{branch.title}</h4><p className="mt-0.5 text-[10px] text-titanium sm:text-xs">{branch.period}</p></div>
              </div>
              <p className="finance-tree-amount">{money.fmtUsd(branch.value)}</p>
              {branch.key === "cash" && <p className="mt-1 break-words text-[10px] leading-4 text-titanium sm:text-xs">{branch.sub}</p>}
            </div>
          </div>)}
        </div>
      </div>
      {flow.count > 0 && <>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {([{key:"income",label:c.incomeDetails,groups:flow.incomes,total:flow.income},{key:"expense",label:c.expenseDetails,groups:flow.expenses,total:flow.expense}] as const).map(group => <div key={group.key} className="subtle-panel apple-card-sm p-4"><button type="button" aria-expanded={detail===group.key} onClick={()=>setDetail(detail===group.key?null:group.key)} className="focus-ring min-h-11 w-full text-left text-sm font-semibold text-ink">{group.label} · {c.details}</button>{Object.entries(group.groups).sort((a,b)=>b[1]-a[1]).map(([key,value]) => <div key={key} className="mt-3"><p className="flex flex-wrap justify-between gap-2 text-xs text-titanium"><span>{tx(locale,categoryNames[key]??key)}</span><span>{money.fmtUsd(value)}</span></p><div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{width:`${group.total ? value/group.total*100 : 0}%`}} /></div></div>)}{!Object.keys(group.groups).length && <p className="text-xs text-titanium">{c.none}</p>}</div>)}
        </div>
        {flow.investment > 0 && <button type="button" aria-expanded={detail==="investment"} onClick={()=>setDetail(detail==="investment"?null:"investment")} className="focus-ring mt-3 min-h-11 rounded-xl border border-line px-4 text-sm text-ink">{c.investment}: {money.fmtUsd(flow.investment)} · {c.details}</button>}
        {detail && <div className="mt-4 space-y-2 rounded-xl border border-line p-4">{selectedRows.length ? selectedRows.map(row=><div key={row.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-line py-2 text-sm text-ink"><div><p>{row.description || tx(locale,categoryNames[row.category]??row.category)}</p><p className="text-xs text-titanium">{row.transaction_date}</p></div><span>{money.fmtAmountFull(row.amount,row.currency)}</span></div>) : <p className="text-sm text-titanium">{c.none}</p>}</div>}
      </>}
    </section>
    <section className="glass-panel apple-card p-4 sm:p-6"><h3 className="text-lg font-semibold text-ink">{c.balances}</h3><div className="mt-4 grid gap-3 sm:grid-cols-3">{[{label:c.assets,value:assetValue},{label:c.debt,value:debt},{label:c.worth,value:assetValue-debt}].map(item=><div key={item.label} className="subtle-panel apple-card-sm p-4"><p className="text-xs text-titanium">{item.label}</p><p className="mt-2 break-words text-xl font-semibold text-ink">{money.fmtUsd(item.value)}</p></div>)}</div><p className="mt-4 text-xs leading-6 text-titanium">{c.balanceNote}</p></section>
  </div>;
}
