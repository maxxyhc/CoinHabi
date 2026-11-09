import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/market/earnings.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, Date, URL, Number, Array, Set });
const { buildEarningsWeek } = exports;

const row = (symbol, date, hour, revenueEstimate) => ({ symbol, date, hour, quarter: 3, year: 2026, epsEstimate: 1, epsActual: null, revenueEstimate });

test('keeps the largest reporters per session, ranked by revenue estimate', () => {
  const week = buildEarningsWeek([
    row('SMALL', '2026-11-09', 'bmo', 1e6),
    row('BIG', '2026-11-09', 'bmo', 9e9),
    row('MID', '2026-11-09', 'bmo', 5e8),
    row('NOREV', '2026-11-09', 'bmo', null),
  ], '2026-11-09', [], 2);
  assert.deepEqual([...week.days[0].beforeOpen.map((e) => e.symbol)], ['BIG', 'MID']);
  assert.equal(week.total, 2);
});

test('adds held companies first in their session without taking a ranked slot', () => {
  const week = buildEarningsWeek([
    row('BIG', '2026-11-10', 'amc', 9e9),
    row('MID', '2026-11-10', 'amc', 5e8),
    row('mine', '2026-11-10', 'amc', 1),
  ].map((r) => ({ ...r, symbol: r.symbol.toUpperCase() })), '2026-11-09', ['mine'], 1);
  const session = week.days[1].afterClose;
  assert.deepEqual([...session.map((e) => e.symbol)], ['MINE', 'BIG']);
  assert.equal(session[0].held, true);
});

test('held companies without an announced session still reach the holdings strip', () => {
  const week = buildEarningsWeek([row('NVDA', '2026-11-12', '', 5e10)], '2026-11-09', ['NVDA']);
  assert.equal(week.total, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(week.held.map((e) => [e.symbol, e.date, e.hour]))), [['NVDA', '2026-11-12', '']]);
});

test('lays out Monday to Friday and ignores rows outside the week', () => {
  const week = buildEarningsWeek([row('SAT', '2026-11-14', 'bmo', 9e9), row('PREV', '2026-11-06', 'amc', 9e9)], '2026-11-09', []);
  assert.deepEqual([...week.days.map((d) => d.date)], ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  assert.equal(week.total, 0);
});
