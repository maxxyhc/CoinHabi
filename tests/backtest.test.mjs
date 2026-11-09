import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/backtest.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: () => ({}), Math, Date, Number, Object, Set, Map });
const { runBacktest } = exports;

const series = (currency, start, values) => ({
  currency,
  closes: new Map(values.map((value, index) => [new Date(Date.parse(start) + index * 86400000).toISOString().slice(0, 10), value])),
});
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('weights positions by current units and reports return from the first common day', () => {
  const result = runBacktest([
    { symbol: 'A', units: 1, history: series('USD', '2026-01-01', [100, 110, 120]) },
    { symbol: 'B', units: 2, history: series('USD', '2026-01-01', [50, 50, 50]) },
  ], {}, {});
  // 200 → 220: A's 20% gain on half the portfolio is a 10% portfolio gain.
  close(result.portfolio.totalReturn, 10);
  assert.deepEqual([...result.points.map((point) => point.date)], ['2026-01-01', '2026-01-02', '2026-01-03']);
});

test('converts through historical FX, so a currency move shows up even when the local price is flat', () => {
  const result = runBacktest(
    [{ symbol: '2330.TW', units: 1, history: series('TWD', '2026-01-01', [1000, 1000]) }],
    {},
    { TWD: series('TWD', '2026-01-01', [32, 25]) },
  );
  close(result.portfolio.totalReturn, (1000 / 25) / (1000 / 32) * 100 - 100);
});

test('max drawdown is measured from the running peak, not the start', () => {
  const result = runBacktest([{ symbol: 'A', units: 1, history: series('USD', '2026-01-01', [100, 200, 100, 150]) }], {}, {});
  close(result.portfolio.maxDrawdown, -50);
  close(result.portfolio.totalReturn, 50);
});

test('forward-fills across closed-market days instead of dropping or zeroing them', () => {
  const stock = { currency: 'USD', closes: new Map([['2026-01-02', 100], ['2026-01-05', 110]]) };
  const coin = series('USD', '2026-01-02', [10, 10, 10, 10]);
  const result = runBacktest([{ symbol: 'S', units: 1, history: stock }, { symbol: 'C', units: 1, history: coin }], {}, {});
  // Weekend days 03 and 04 carry the stock's Friday close.
  [0, 0, 0, (120 / 110 - 1) * 100].forEach((expected, index) => close(result.points[index].portfolio, expected));
});

test('drops late-listed, unknown and unconvertible symbols instead of shrinking the window', () => {
  const result = runBacktest([
    { symbol: 'OLD', units: 1, history: series('USD', '2026-01-01', Array(60).fill(10)) },
    { symbol: 'IPO', units: 1, history: series('USD', '2026-02-15', [10, 12]) },
    { symbol: 'NOPE', units: 1, history: null },
    { symbol: 'JPY1', units: 1, history: series('JPY', '2026-01-01', [10, 10]) },
    { symbol: 'EMPTY', units: 0, history: null },
  ], {}, {});
  assert.deepEqual([...result.excluded], ['IPO', 'NOPE', 'JPY1']);
  assert.equal(result.points[0].date, '2026-01-01');
});

test('benchmarks are normalised on the same axis', () => {
  const result = runBacktest(
    [{ symbol: 'A', units: 1, history: series('USD', '2026-01-01', [100, 100, 100]) }],
    { SPY: series('USD', '2026-01-01', [400, 420, 440]) },
    {},
  );
  close(result.benchmarks.SPY.totalReturn, 10);
  close(result.points[1].SPY, 5);
});

test('nothing priceable returns null rather than a flat line', () => {
  assert.equal(runBacktest([{ symbol: 'X', units: 1, history: null }], {}, {}), null);
});
