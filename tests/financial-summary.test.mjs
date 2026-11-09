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
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file,'utf8'));
  const exports = {};
  cache.set(file,exports);
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{exports,Intl,Date,require:(name)=>{
    const target = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file),name);
    return load(target.endsWith('.json')?target:target+'.ts');
  }});
  return exports;
}
const {getInvestmentCost,getMonthlyFlow} = load('lib/financial-summary.ts');
const fx = {usdRates:{USD:1,TWD:32,JPY:160,HKD:8}};
const holding = (extra={}) => ({asset_type:'us_stock',quantity:2,average_cost:100,cost_currency:'USD',cost_known:true,break_even_price:120,...extra});
const tx = (amount, type='expense', category='food', currency='USD', date='2026-09-01')=>({amount,transaction_type:type,category,currency,transaction_date:date});

test('cost excludes cash, uses average cost not break-even, and preserves lot size',()=>{
 const result=getInvestmentCost([holding(),holding({asset_type:'tw_stock',quantity:1,average_cost:32,cost_currency:'TWD'}),holding({asset_type:'stock',lot_size:100,quantity:1,average_cost:16,cost_currency:'JPY'}),holding({asset_type:'cash',quantity:10000})],fx);
 assert.equal(result.total,1210);
 assert.equal(result.count,3);
});
test('unknown costs remain missing, while recorded zero cost is valid',()=>{
 const result=getInvestmentCost([holding({cost_known:false}),holding({average_cost:0}),holding({average_cost:NaN}),holding({quantity:0})],fx);
 assert.equal(result.total,0);assert.equal(result.known,1);assert.equal(result.missing,2);
});
test('month filtering and mixed currencies balance income against spending, investing and surplus',()=>{
 const result=getMonthlyFlow([tx(100,'income','salary'),tx(320,'expense','food','TWD'),tx(1600,'expense','investment','JPY'),tx(100,'expense','food','USD','2026-08-31')],'2026-09',fx);
 assert.equal(result.income,100);assert.equal(result.expense,10);assert.equal(result.investment,10);assert.equal(result.net,80);
 assert.equal(result.income+result.gap,result.expense+result.investment+result.surplus);
});
test('expense-only month shows unfunded gap rather than invented income',()=>{
 const result=getMonthlyFlow([tx(40),tx(60,'expense','investment')],'2026-09',fx);
 assert.equal(result.income,0);assert.equal(result.gap,100);assert.equal(result.surplus,0);assert.equal(result.net,-100);
});
test('empty and income-only months remain finite and balanced',()=>{
 const empty=getMonthlyFlow([],'2026-09',fx);assert.equal(empty.count,0);assert.equal(empty.net,0);
 const income=getMonthlyFlow([tx(80,'income','salary')],'2026-09',fx);assert.equal(income.surplus,80);assert.equal(income.gap,0);
});

const {queueFlowActivity,takeFlowActivity} = load('lib/flow-activity.ts');
test('activity waits for matching loaded rows and month, groups destinations, then plays once',()=>{
 const rows = [{...tx(20),id:'food-1'},{...tx(30),id:'food-2'},{...tx(40,'expense','investment'),id:'invest-1'},{...tx(50,'income','salary'),id:'income-1'}];
 for (const row of rows) queueFlowActivity(row.id);
 assert.equal(takeFlowActivity([], '2026-09'),null);
 assert.equal(takeFlowActivity(rows, '2026-08'),null);
 assert.equal(takeFlowActivity(rows, '2026-09').branch,'expense');
 assert.equal(takeFlowActivity(rows, '2026-09').branch,'investment');
 assert.equal(takeFlowActivity(rows, '2026-09').branch,'income');
 assert.equal(takeFlowActivity(rows, '2026-09'),null);
});
