import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, Intl, Date, require: (name) => {
    const target = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
    return load(target.endsWith('.json') ? target : target + '.ts');
  } });
  return exports;
}
const { buildPortfolioSnapshot } = load('lib/portfolio-snapshot.ts');

const fx = { usdRates: { USD: 1, TWD: 32 } };
const holding = (extra) => ({ id: extra.symbol, asset_type: 'us_stock', quantity: 2, average_cost: 100, cost_currency: 'USD', cost_known: true, break_even_price: null, gain_calculation_mode: 'average_cost', ...extra });
const quote = (symbol, priceUsd) => ({ symbol, price: priceUsd, currency: 'USD', priceUsd, dayChangePercent: 0, source: 'test' });

test('splits investment and cash, sums known cost basis, keeps lot size in units', () => {
  const snapshot = buildPortfolioSnapshot('u1', '2026-11-09', [
    holding({ symbol: 'AAPL' }),
    holding({ symbol: '2330.TW', asset_type: 'tw_stock', quantity: 1, lot_size: 1000, average_cost: 640, cost_currency: 'TWD' }),
    holding({ symbol: 'USD', asset_type: 'cash', quantity: 500 }),
  ], { AAPL: quote('AAPL', 150), '2330.TW': quote('2330.TW', 30), USD: quote('USD', 1) }, fx);

  assert.equal(snapshot.investment_value_usd, 300 + 30000);
  assert.equal(snapshot.cash_value_usd, 500);
  assert.equal(snapshot.total_value_usd, 30800);
  assert.equal(snapshot.cost_basis_usd, 200 + 20000);
  assert.equal(snapshot.unpriced_count, 0);
  assert.equal(snapshot.holdings.find((h) => h.symbol === '2330.TW').units, 1000);
});

test('flags holdings valued at fallback price instead of hiding the gap', () => {
  const snapshot = buildPortfolioSnapshot('u1', '2026-11-09', [holding({ symbol: 'AAPL' }), holding({ symbol: 'MSFT' })], { AAPL: quote('AAPL', 150) }, fx);
  assert.equal(snapshot.unpriced_count, 1);
  assert.equal(snapshot.holdings.find((h) => h.symbol === 'MSFT').priced, false);
});

test('unknown cost contributes value but no cost basis', () => {
  const snapshot = buildPortfolioSnapshot('u1', '2026-11-09', [holding({ symbol: 'BTC', asset_type: 'crypto', cost_known: false, quantity: 1 })], { BTC: quote('BTC', 90000) }, fx);
  assert.equal(snapshot.investment_value_usd, 90000);
  assert.equal(snapshot.cost_basis_usd, 0);
});

test('generic "stock" folds into US/Taiwan by listing; other markets stay generic', () => {
  const { resolveAssetType } = load('lib/calculations.ts');
  const type = (symbol, extra = {}) => resolveAssetType({ asset_type: 'stock', symbol, market_code: null, ...extra });
  assert.equal(type('SPCX'), 'us_stock');
  assert.equal(type('BRK.B'), 'us_stock');
  assert.equal(type('2330.TW'), 'tw_stock');
  assert.equal(type('7203.T'), 'stock');
  assert.equal(type('SPCX', { market_code: 'JP' }), 'stock');
  assert.equal(resolveAssetType({ asset_type: 'crypto', symbol: 'BTC', market_code: null }), 'crypto');
});
