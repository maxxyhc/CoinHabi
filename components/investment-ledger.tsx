"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, History, TrendingDown, TrendingUp, X } from "lucide-react";
import clsx from "clsx";
import { InfoTip } from "@/components/info-tip";
import { useMoney } from "@/components/money-context";
import { formatPercent, usdToCurrency } from "@/lib/calculations";
import type {
  EnrichedHolding,
  InvestmentPerformance,
  InvestmentSaleInput,
  InvestmentTransaction,
  Locale,
} from "@/lib/types";

const copy = {
  en: {
    buy: "Buy",
    close: "Close",
    costBasis: "Cost basis",
    currentHolding: "Current holding",
    cumulativeGain: "Cumulative P/L",
    cumulativeGainHelp: "Realized P/L plus the current unrealized P/L of holdings with a confirmed cost basis.",
    cumulativeReturn: "Cumulative return",
    cumulativeReturnHelp: "Cumulative P/L divided by confirmed tracked cost. This is an accounting return, not a time-weighted return.",
    date: "Sale date",
    fees: "Fees",
    history: "Investment history",
    historyEmpty: "Buys and sales recorded in Coinhabi will appear here.",
    holdingsAfterSale: "Remaining after sale",
    note: "Notes (optional)",
    opening: "Opening balance",
    performance: "Performance since tracking began",
    price: "Sale price per unit",
    proceeds: "Net proceeds",
    quantity: "Quantity sold",
    quantityDecreaseHelp: "To reduce a holding, use Record sale so realized P/L and history stay accurate.",
    realized: "Realized P/L",
    realizedHelp: "Profit or loss already locked in by recorded sales, after entered fees and taxes.",
    recordSale: "Record sale",
    save: "Record sale and update holding",
    saving: "Recording…",
    sell: "Sell",
    sellAll: "Sell all",
    trackedCost: "Confirmed tracked cost",
    unrealized: "Unrealized P/L",
    unrealizedHelp: "Current value minus the confirmed cost basis of investments you still hold.",
  },
  zh: {
    buy: "買入",
    close: "關閉",
    costBasis: "成本基礎",
    currentHolding: "目前持有",
    cumulativeGain: "累計損益",
    cumulativeGainHelp: "已實現損益加上目前仍持有、且成本可確認部位的未實現損益。",
    cumulativeReturn: "累計報酬率",
    cumulativeReturnHelp: "累計損益除以可確認的追蹤成本；這是會計報酬率，並非時間加權報酬率。",
    date: "賣出日期",
    fees: "手續費／交易稅",
    history: "投資交易紀錄",
    historyEmpty: "之後在 Coinhabi 登記的買入與賣出會顯示在這裡。",
    holdingsAfterSale: "賣出後剩餘",
    note: "備註（選填）",
    opening: "期初持倉",
    performance: "開始記錄後的投資績效",
    price: "每股／每幣成交價",
    proceeds: "賣出淨收入",
    quantity: "賣出數量",
    quantityDecreaseHelp: "若要減少持倉，請使用「登記賣出」，才能正確保留已實現損益與交易歷史。",
    realized: "已實現損益",
    realizedHelp: "已登記賣出交易所確定的損益，並扣除您輸入的手續費與交易稅。",
    recordSale: "登記賣出",
    save: "登記賣出並更新持倉",
    saving: "登記中…",
    sell: "賣出",
    sellAll: "全部賣出",
    trackedCost: "可確認追蹤成本",
    unrealized: "未實現損益",
    unrealizedHelp: "目前仍持有投資的現值減去可確認成本基礎。",
  },
  ja: {
    buy: "購入",
    close: "閉じる",
    costBasis: "取得原価",
    currentHolding: "現在の保有量",
    cumulativeGain: "累計損益",
    cumulativeGainHelp: "実現損益と、取得原価を確認できる現在保有分の含み損益の合計です。",
    cumulativeReturn: "累計リターン",
    cumulativeReturnHelp: "累計損益を確認済み追跡原価で割った会計上のリターンで、時間加重収益率ではありません。",
    date: "売却日",
    fees: "手数料・税金",
    history: "投資取引履歴",
    historyEmpty: "Coinhabiで記録した購入と売却がここに表示されます。",
    holdingsAfterSale: "売却後の残高",
    note: "メモ（任意）",
    opening: "開始時残高",
    performance: "記録開始後の投資成績",
    price: "1単位あたり売却価格",
    proceeds: "売却純収入",
    quantity: "売却数量",
    quantityDecreaseHelp: "保有数量を減らす場合は、実現損益と履歴を正確に残すため「売却を記録」を使用してください。",
    realized: "実現損益",
    realizedHelp: "記録した売却で確定した損益から、入力済みの手数料と税金を差し引いた金額です。",
    recordSale: "売却を記録",
    save: "売却を記録して保有を更新",
    saving: "記録中…",
    sell: "売却",
    sellAll: "全て売却",
    trackedCost: "確認済み追跡原価",
    unrealized: "含み損益",
    unrealizedHelp: "現在保有している投資の時価から、確認済み取得原価を差し引いた金額です。",
  },
  ko: {
    buy: "매수",
    close: "닫기",
    costBasis: "원가 기준",
    currentHolding: "현재 보유량",
    cumulativeGain: "누적 손익",
    cumulativeGainHelp: "실현 손익과 원가가 확인된 현재 보유분의 미실현 손익을 합한 값입니다.",
    cumulativeReturn: "누적 수익률",
    cumulativeReturnHelp: "누적 손익을 확인된 추적 원가로 나눈 회계 수익률이며 시간가중 수익률은 아닙니다.",
    date: "매도일",
    fees: "수수료·세금",
    history: "투자 거래 기록",
    historyEmpty: "Coinhabi에 기록한 매수와 매도가 여기에 표시됩니다.",
    holdingsAfterSale: "매도 후 잔량",
    note: "메모(선택)",
    opening: "기초 보유량",
    performance: "기록 시작 후 투자 성과",
    price: "단위당 매도가",
    proceeds: "순매도 대금",
    quantity: "매도 수량",
    quantityDecreaseHelp: "보유량을 줄이려면 실현 손익과 거래 기록이 정확히 남도록 '매도 기록'을 사용하세요.",
    realized: "실현 손익",
    realizedHelp: "기록된 매도로 확정된 손익에서 입력한 수수료와 세금을 반영한 금액입니다.",
    recordSale: "매도 기록",
    save: "매도 기록 및 보유량 업데이트",
    saving: "기록 중…",
    sell: "매도",
    sellAll: "전량 매도",
    trackedCost: "확인된 추적 원가",
    unrealized: "미실현 손익",
    unrealizedHelp: "현재 보유 중인 투자의 시가에서 확인된 원가 기준을 뺀 금액입니다.",
  },
  es: {
    buy: "Compra",
    close: "Cerrar",
    costBasis: "Base de coste",
    currentHolding: "Posición actual",
    cumulativeGain: "Ganancia/Pérdida acumulada",
    cumulativeGainHelp: "Ganancia realizada más la no realizada actual de las posiciones con coste confirmado.",
    cumulativeReturn: "Rentabilidad acumulada",
    cumulativeReturnHelp: "Ganancia acumulada dividida por el coste confirmado. Es una rentabilidad contable, no ponderada por tiempo.",
    date: "Fecha de venta",
    fees: "Comisiones e impuestos",
    history: "Historial de inversión",
    historyEmpty: "Las compras y ventas registradas en Coinhabi aparecerán aquí.",
    holdingsAfterSale: "Restante tras la venta",
    note: "Notas (opcional)",
    opening: "Saldo inicial",
    performance: "Rendimiento desde el inicio del seguimiento",
    price: "Precio de venta por unidad",
    proceeds: "Ingresos netos",
    quantity: "Cantidad vendida",
    quantityDecreaseHelp: "Para reducir una posición, usa Registrar venta y así conservar correctamente la ganancia realizada y el historial.",
    realized: "Ganancia/Pérdida realizada",
    realizedHelp: "Ganancia o pérdida confirmada por ventas registradas, después de las comisiones e impuestos introducidos.",
    recordSale: "Registrar venta",
    save: "Registrar venta y actualizar posición",
    saving: "Registrando…",
    sell: "Venta",
    sellAll: "Vender todo",
    trackedCost: "Coste confirmado",
    unrealized: "Ganancia/Pérdida no realizada",
    unrealizedHelp: "Valor actual menos el coste confirmado de las inversiones que aún mantienes.",
  },
} as const;

export function InvestmentPerformancePanel({
  compact = false,
  locale,
  performance,
}: {
  compact?: boolean;
  locale: Locale;
  performance: InvestmentPerformance;
}) {
  const money = useMoney();
  const c = copy[locale];
  const positive = performance.cumulativeGainUsd >= 0;
  const metrics = [
    { help: c.cumulativeGainHelp, label: c.cumulativeGain, value: performance.hasPerformanceData ? money.fmtUsd(performance.cumulativeGainUsd) : "N/A", tone: performance.hasPerformanceData ? performance.cumulativeGainUsd : undefined },
    { help: c.cumulativeReturnHelp, label: c.cumulativeReturn, value: performance.hasPerformanceData ? formatPercent(performance.cumulativeReturnPercent) : "N/A", tone: performance.hasPerformanceData ? performance.cumulativeReturnPercent : undefined },
    { help: c.realizedHelp, label: c.realized, value: performance.saleCount ? money.fmtUsd(performance.realizedGainUsd) : "—", tone: performance.saleCount ? performance.realizedGainUsd : undefined },
    { help: c.unrealizedHelp, label: c.unrealized, value: performance.hasPerformanceData ? money.fmtUsd(performance.unrealizedGainUsd) : "N/A", tone: performance.hasPerformanceData ? performance.unrealizedGainUsd : undefined },
  ];

  return (
    <section className={clsx("border border-line bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]", compact ? "rounded-[24px] p-4" : "glass-panel apple-card p-5 sm:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={clsx("font-semibold text-ink", compact ? "text-[15px]" : "text-xl")}>{c.performance}</h2>
          {performance.startedAt && (
            <p className="mt-1 text-xs text-titanium">
              {formatLedgerDate(performance.startedAt, locale)} · {c.trackedCost} {money.fmtUsd(performance.trackedCostUsd)}
            </p>
          )}
        </div>
        <span className={clsx("grid shrink-0 place-items-center rounded-full", compact ? "h-9 w-9" : "h-10 w-10", performance.hasPerformanceData ? positive ? "bg-mint/10 text-mint" : "bg-rose/10 text-rose" : "bg-[var(--surface-muted)] text-titanium")}>
          {positive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
        </span>
      </div>
      <div className={clsx("mt-4 grid grid-cols-2", compact ? "gap-2" : "gap-3 lg:grid-cols-4")}>
        {metrics.map((metric, index) => (
          <div className="rounded-2xl bg-[var(--surface-muted)] p-3" key={metric.label}>
            <div className="flex items-center gap-1 text-[10px] text-titanium">
              <span>{metric.label}</span>
              <InfoTip align={index % 2 === 0 ? "left" : "right"} text={metric.help} />
            </div>
            <p className={clsx("mt-1 truncate font-semibold tabular-nums", compact ? "text-sm" : "text-base", metric.tone === undefined ? "text-ink" : metric.tone >= 0 ? "text-mint" : "text-rose")}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function InvestmentHistoryPanel({
  compact = false,
  locale,
  transactions,
}: {
  compact?: boolean;
  locale: Locale;
  transactions: InvestmentTransaction[];
}) {
  const money = useMoney();
  const c = copy[locale];
  const rows = transactions.slice(0, compact ? 6 : 12);

  return (
    <section className={clsx("border border-line bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]", compact ? "rounded-[24px] p-4" : "glass-panel apple-card p-5 sm:p-6")}>
      <div className="flex items-center gap-2">
        <History className="text-[var(--accent)]" size={18} />
        <h2 className={clsx("font-semibold text-ink", compact ? "text-[15px]" : "text-xl")}>{c.history}</h2>
      </div>
      {!rows.length ? (
        <p className="mt-4 rounded-2xl bg-[var(--surface-muted)] p-4 text-sm leading-6 text-titanium">{c.historyEmpty}</p>
      ) : (
        <div className="mt-3 divide-y divide-line">
          {rows.map((transaction) => {
            const selling = transaction.transaction_type === "sell";
            const typeLabel = selling ? c.sell : transaction.transaction_type === "buy" ? c.buy : c.opening;
            const amount = selling ? transaction.proceeds : transaction.cost_basis;
            return (
              <article className="flex items-center justify-between gap-3 py-3" key={transaction.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full", selling ? "bg-rose/10 text-rose" : "bg-mint/10 text-mint")}>
                    {selling ? <ArrowUpFromLine size={15} /> : <ArrowDownToLine size={15} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{transaction.symbol} · {typeLabel}</p>
                    <p className="mt-0.5 truncate text-[10px] text-titanium">
                      {formatLedgerDate(transaction.transaction_date, locale)} · {formatTransactionQuantity(transaction)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-ink">{amount === null ? "N/A" : money.fmtAmountFull(amount, transaction.currency)}</p>
                  {selling && (
                    <p className={clsx("mt-0.5 text-[10px] font-semibold", transaction.realized_gain === null ? "text-titanium" : transaction.realized_gain >= 0 ? "text-mint" : "text-rose")}>
                      {c.realized} {transaction.realized_gain === null ? "N/A" : money.fmtAmountFull(transaction.realized_gain, transaction.currency)}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function InvestmentSaleModal({
  holding,
  locale,
  onClose,
  onSubmit,
}: {
  holding: EnrichedHolding;
  locale: Locale;
  onClose: () => void;
  onSubmit: (input: InvestmentSaleInput) => Promise<void>;
}) {
  const money = useMoney();
  const c = copy[locale];
  const currentPrice = holding.quote?.priceUsd
    ? usdToCurrency(holding.quote.priceUsd, holding.cost_currency, money.fx)
    : 0;
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(currentPrice > 0 ? String(Number(currentPrice.toFixed(8))) : "");
  const [fees, setFees] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const quantityValue = Number(quantity || 0);
  const priceValue = Number(price || 0);
  const feeValue = Number(fees || 0);
  const multiplier = holding.asset_type === "tw_stock" ? 1000 : 1;
  const units = quantityValue * multiplier;
  const proceeds = Math.max(0, (units * priceValue) - feeValue);
  const basisPrice = holding.gain_calculation_mode === "break_even" && holding.break_even_price
    ? holding.break_even_price
    : holding.average_cost;
  const costBasis = holding.cost_known === false ? null : units * basisPrice;
  const realizedGain = costBasis === null ? null : proceeds - costBasis;
  const remaining = Math.max(0, holding.quantity - quantityValue);

  const summary = useMemo(() => [
    { label: c.proceeds, value: priceValue > 0 && quantityValue > 0 ? money.fmtAmountFull(proceeds, holding.cost_currency) : "—" },
    { label: c.costBasis, value: costBasis === null ? "N/A" : money.fmtAmountFull(costBasis, holding.cost_currency) },
    { label: c.realized, value: realizedGain === null ? "N/A" : money.fmtAmountFull(realizedGain, holding.cost_currency), tone: realizedGain },
    { label: c.holdingsAfterSale, value: formatQuantityValue(remaining, holding.asset_type) },
  ], [c, costBasis, holding.asset_type, holding.cost_currency, money, priceValue, proceeds, quantityValue, realizedGain, remaining]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!Number.isFinite(quantityValue) || quantityValue <= 0 || quantityValue > holding.quantity) {
      setError(`${c.quantity}: 0 – ${formatQuantityValue(holding.quantity, holding.asset_type)}`);
      return;
    }
    if (!Number.isFinite(priceValue) || priceValue <= 0 || !Number.isFinite(feeValue) || feeValue < 0) {
      setError(`${c.price} / ${c.fees}`);
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        fees: feeValue,
        holdingId: holding.id,
        notes,
        pricePerUnit: priceValue,
        quantity: quantityValue,
        transactionDate: date,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : c.recordSale);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm">
      <section className="absolute inset-x-0 bottom-0 max-h-[94dvh] overflow-y-auto rounded-t-[30px] border border-line bg-[var(--surface-raised)] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl lg:inset-x-1/2 lg:bottom-auto lg:top-1/2 lg:max-h-[90vh] lg:w-[620px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[28px] lg:p-6">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line lg:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose">{c.recordSale}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{holding.symbol} · {holding.name}</h2>
            <p className="mt-1 text-xs text-titanium">{c.currentHolding}: {formatQuantityValue(holding.quantity, holding.asset_type)}</p>
          </div>
          <button aria-label={c.close} className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-titanium" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center justify-between text-sm text-titanium">
                {holding.asset_type === "tw_stock" ? `${c.quantity}（張）` : c.quantity}
                <button className="focus-ring rounded-full px-2 py-1 text-xs font-semibold text-[var(--accent)]" onClick={() => setQuantity(String(holding.quantity))} type="button">{c.sellAll}</button>
              </span>
              <input className="input-control focus-ring w-full px-3 text-ink" inputMode="decimal" max={holding.quantity} min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} required type="number" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-titanium">{c.price}（{holding.cost_currency}）</span>
              <input className="input-control focus-ring w-full px-3 text-ink" inputMode="decimal" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} required type="number" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-titanium">{c.fees}（{holding.cost_currency}）</span>
              <input className="input-control focus-ring w-full px-3 text-ink" inputMode="decimal" min="0" step="any" value={fees} onChange={(event) => setFees(event.target.value)} type="number" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-titanium">{c.date}</span>
              <input className="input-control focus-ring w-full px-3 text-ink" value={date} onChange={(event) => setDate(event.target.value)} required type="date" />
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm text-titanium">{c.note}</span>
            <textarea className="input-control focus-ring min-h-20 w-full resize-y px-3 py-2 text-ink" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface-muted)] p-3 sm:grid-cols-4">
            {summary.map((item) => (
              <div className="min-w-0" key={item.label}>
                <p className="text-[10px] text-titanium">{item.label}</p>
                <p className={clsx("mt-1 truncate text-xs font-semibold tabular-nums", item.tone == null ? "text-ink" : item.tone >= 0 ? "text-mint" : "text-rose")}>{item.value}</p>
              </div>
            ))}
          </div>

          {error && <p className="rounded-2xl border border-rose/25 bg-rose/10 p-3 text-sm text-rose">{error}</p>}
          <button className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rose px-4 font-semibold text-white transition hover:opacity-90 disabled:opacity-50" disabled={saving} type="submit">
            <ArrowUpFromLine size={17} />
            {saving ? c.saving : c.save}
          </button>
        </form>
      </section>
    </div>
  );
}

export function getRecordSaleLabel(locale: Locale) {
  return copy[locale].recordSale;
}

export function getQuantityDecreaseHelp(locale: Locale) {
  return copy[locale].quantityDecreaseHelp;
}

function formatTransactionQuantity(transaction: InvestmentTransaction) {
  return formatQuantityValue(transaction.quantity, transaction.asset_type);
}

function formatQuantityValue(value: number, assetType: EnrichedHolding["asset_type"]) {
  const formatted = value.toLocaleString("en-US", { maximumFractionDigits: 8 });
  return assetType === "tw_stock" ? `${formatted} 張` : formatted;
}

function formatLedgerDate(value: string, locale: Locale) {
  const localeTag = { en: "en-US", es: "es-ES", ja: "ja-JP", ko: "ko-KR", zh: "zh-TW" }[locale];
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" });
}
