import {
  convertAmount,
  currencyBucketsToUsd,
  formatCurrency,
  formatUsdIn,
  type CurrencyBuckets,
  type CurrencyFxInput,
} from "@/lib/calculations";
import { supportedCurrencies } from "@/lib/types";
import type { Currency, MarketQuote } from "@/lib/types";

export type MoneyFmt = {
  displayCurrency: Currency;
  fx: CurrencyFxInput;
  /** Format a USD value in the display currency. */
  fmtUsd: (valueUsd: number) => string;
  /** Convert an amount from its own currency into the display currency. */
  fmtAmount: (value: number, from: Currency) => string;
  /** Like fmtAmount, but appends the original amount in parentheses when currencies differ. */
  fmtAmountFull: (value: number, from: Currency) => string;
};

export function createMoney(displayCurrency: Currency, fx: CurrencyFxInput): MoneyFmt {
  const fmtAmount = (value: number, from: Currency) =>
    formatCurrency(convertAmount(value, from, displayCurrency, fx), displayCurrency);
  return {
    displayCurrency,
    fx,
    fmtUsd: (valueUsd: number) => formatUsdIn(valueUsd, displayCurrency, fx),
    fmtAmount,
    fmtAmountFull: (value: number, from: Currency) =>
      from === displayCurrency
        ? formatCurrency(value, from)
        : `${fmtAmount(value, from)} (${formatCurrency(value, from)})`,
  };
}

export function formatCurrentPrice(quote: MarketQuote | undefined, money: MoneyFmt) {
  if (!quote || !Number.isFinite(quote.price) || !Number.isFinite(quote.priceUsd)) {
    return null;
  }

  const quoteCurrency = quote.currency.toUpperCase();
  if ((supportedCurrencies as readonly string[]).includes(quoteCurrency)) {
    const currency = quoteCurrency as Currency;
    const converted = convertAmount(quote.price, currency, money.displayCurrency, money.fx);
    const displayed = formatPriceCurrency(converted, money.displayCurrency);
    return currency === money.displayCurrency
      ? displayed
      : `${displayed} (${formatPriceCurrency(quote.price, currency)})`;
  }

  return formatPriceCurrency(
    convertAmount(quote.priceUsd, "USD", money.displayCurrency, money.fx),
    money.displayCurrency,
  );
}

function formatPriceCurrency(value: number, currency: Currency) {
  const absolute = Math.abs(value);
  const noMinorUnits = currency === "JPY" || currency === "KRW";
  const maximumFractionDigits = noMinorUnits
    ? 0
    : absolute >= 1
      ? 2
      : absolute >= 0.01
        ? 4
        : absolute >= 0.0001
          ? 6
          : 10;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value);
}

export const defaultMoney = createMoney("USD", 1 / 32);

export function formatCurrencyBuckets(money: MoneyFmt, values: CurrencyBuckets) {
  return money.fmtUsd(currencyBucketsToUsd(values, money.fx));
}
