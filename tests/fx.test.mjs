import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

function loadFx(fetch) {
  const transpile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const types = { exports: {} };
  vm.runInNewContext(transpile('lib/types.ts'), types);
  const context = { exports: {}, require: () => types.exports, fetch, AbortSignal, Date };
  vm.runInNewContext(transpile('lib/market/fx.ts'), context);
  return context.exports;
}
const currencies = ['USD','TWD','EUR','JPY','KRW','HKD','GBP','CAD','AUD','SGD','CNY','CHF','INR','SAR'];
const rates = Object.fromEntries(currencies.map(c => [c, c === 'USD' ? 1 : 30]));
const updatedAt = new Date(Date.now() - 3600000).toISOString();
const cached = { usdRates: rates, updatedAt };
const offline = async () => { throw new Error('offline'); };

test('first failure without valid saved rates is unavailable, never fixed rates', async () => {
  await assert.rejects(loadFx(offline).fetchFxRates(), /FX_UNAVAILABLE/);
});
test('saved browser rates survive a server cold start and retain provider timestamp', async () => {
  const result = await loadFx(offline).fetchFxRates(cached);
  assert.equal(result.status, 'cached');
  assert.equal(result.updatedAt, updatedAt);
  assert.equal(result.twdToUsd, 1 / 30);
});
test('rejects incomplete, nonpositive, nonfinite, wrong-base and future saved data', () => {
  const { parseFxCache } = loadFx(offline);
  for (const usdRates of [{...rates, SGD: undefined}, {...rates, TWD: 0}, {...rates, JPY: Infinity}, {...rates, USD: 2}]) {
    assert.equal(parseFxCache({...cached, usdRates}), null);
  }
  assert.equal(parseFxCache({...cached, updatedAt: new Date(Date.now()+3600000).toISOString()}), null);
});
test('success, provider outage, then recovery preserve and replace last success', async () => {
  let fail = false;
  let twd = 31;
  const fx = loadFx(async () => {
    if (fail) throw new Error('offline');
    return { ok: true, json: async () => ({result:'success',base_code:'USD',rates:{...rates,TWD:twd},time_last_update_unix:Math.floor(Date.parse(updatedAt)/1000)}) };
  });
  assert.equal((await fx.fetchFxRates()).status, 'fresh');
  fail = true;
  const fallback = await fx.fetchFxRates();
  assert.equal(fallback.status, 'cached');
  assert.equal(fallback.usdToTwd, 31);
  fail = false; twd = 33;
  const recovered = await fx.fetchFxRates();
  assert.equal(recovered.status, 'fresh');
  assert.equal(recovered.usdToTwd, 33);
});
test('old provider data is explicitly stale even when HTTP succeeds', async () => {
  const fx = loadFx(async () => ({ok:true,json:async()=>({result:'success',base_code:'USD',rates,time_last_update_unix:Math.floor((Date.now()-48*3600000)/1000)})}));
  assert.equal((await fx.fetchFxRates()).status, 'cached');
});
test('provider errors and incomplete rates fall back to saved data', async () => {
  for (const payload of [{result:'error'}, {result:'success',base_code:'USD',rates:{USD:1},time_last_update_unix:Date.now()/1000}]) {
    const fx = loadFx(async () => ({ok:true,json:async()=>payload}));
    assert.equal((await fx.fetchFxRates(cached)).usdToTwd, 30);
  }
});
