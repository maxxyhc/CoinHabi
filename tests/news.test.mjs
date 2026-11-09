import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/market/news.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports });
const { mentions } = exports;
const article = (headline, summary = '') => ({ headline, summary });

test('keeps articles naming the ticker or the company', () => {
  assert.ok(mentions(article('NVDA slides after guidance'), 'NVDA', 'NVIDIA Corporation'));
  assert.ok(mentions(article('Chipmakers rally', 'Nvidia led the gains.'), 'NVDA', 'NVIDIA Corporation'));
  assert.ok(mentions(article('Coinbase volumes jump'), 'COIN', 'COINBASE GLOBAL INC -CLASS A'));
});

test('drops listicles that only carry the ticker as a tag', () => {
  assert.ok(!mentions(article('3 Top Dividend Stocks to Buy in November'), 'NVDA', 'NVIDIA Corporation'));
});

test('matches whole words, so a ticker inside another word does not count', () => {
  assert.ok(!mentions(article('Coinciding with earnings season'), 'COIN', 'X'));
});
