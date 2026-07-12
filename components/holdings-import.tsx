"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import clsx from "clsx";
import * as XLSX from "xlsx";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  autoDetectMapping,
  buildCandidates,
  candidateIsValid,
  FIELD_ORDER,
  fieldLabels,
  type Candidate,
  type FieldKey,
  type Mapping,
} from "@/lib/holdings-import";
import { supportedCurrencies } from "@/lib/types";
import type { AssetType, Currency, EnrichedHolding, Locale } from "@/lib/types";
import { tx } from "@/lib/i18n";

export function HoldingsImport({
  demo = false,
  embedded = false,
  existingHoldings,
  locale,
  userId,
  onHoldingsChanged,
}: {
  demo?: boolean;
  embedded?: boolean;
  existingHoldings: EnrichedHolding[];
  locale: Locale;
  userId: string;
  onHoldingsChanged: () => Promise<void>;
}) {
  const zh = locale === "zh";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const existingKeys = useMemo(() => {
    const set = new Set<string>();
    existingHoldings.forEach((holding) => {
      set.add(`${holding.asset_type}:${holding.symbol.toUpperCase()}`);
    });
    return set;
  }, [existingHoldings]);

  function isDuplicate(candidate: Candidate) {
    return existingKeys.has(`${candidate.asset_type}:${candidate.symbol.trim().toUpperCase()}`);
  }

  function resetAll() {
    setHeaders([]);
    setDataRows([]);
    setMapping(null);
    setCandidates([]);
    setFileName("");
    setError("");
    setResult("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function downloadTemplate() {
    const aoa = [
      [
        tx(locale, "Type"),
        tx(locale, "Symbol"),
        tx(locale, "Name"),
        tx(locale, "Quantity"),
        tx(locale, "Average cost"),
        tx(locale, "Currency"),
      ],
      ["us_stock", "AAPL", "Apple Inc.", 10, 180, "USD"],
      ["tw_stock", "2330", tx(locale, "TSMC"), 2, 900, "TWD"],
      ["crypto", "BTC", "Bitcoin", 0.5, 60000, "USD"],
      ["cash", "USD", tx(locale, "US dollar cash"), 5000, 1, "USD"],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Holdings");
    XLSX.writeFile(workbook, "holdings-template.xlsx");
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setResult("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = new Uint8Array(loadEvent.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
        if (!rows.length) {
          setError(tx(locale, "This file appears to be empty."));
          return;
        }
        const parsedHeaders = (rows[0] as unknown[]).map((cell) => String(cell ?? "").trim());
        const parsedData = rows.slice(1) as unknown[][];
        const detected = autoDetectMapping(parsedHeaders);
        setHeaders(parsedHeaders);
        setDataRows(parsedData);
        setMapping(detected);
        setCandidates(buildCandidates(parsedData, detected));
      } catch {
        setError(tx(locale, "Could not read this file. Make sure it is .xlsx or .csv."));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function updateMapping(field: FieldKey, headerIndex: number | null) {
    if (!mapping) return;
    const nextMapping = { ...mapping, [field]: headerIndex };
    setMapping(nextMapping);
    setCandidates(buildCandidates(dataRows, nextMapping));
    setResult("");
  }

  function updateCandidate<K extends keyof Candidate>(id: string, key: K, value: Candidate[K]) {
    setCandidates((current) =>
      current.map((candidate) => (candidate.id === id ? { ...candidate, [key]: value } : candidate)),
    );
  }

  function setAllIncluded(include: boolean) {
    setCandidates((current) => current.map((candidate) => ({ ...candidate, include })));
  }

  const validCount = candidates.filter(candidateIsValid).length;
  const selectedValidCount = candidates.filter((candidate) => candidate.include && candidateIsValid(candidate)).length;
  const duplicateCount = candidates.filter(isDuplicate).length;

  async function handleImport() {
    setError("");
    setResult("");
    if (demo) {
      setError(tx(locale, "Demo mode is read-only. Changes are not saved."));
      return;
    }
    if (!supabase || !userId) {
      setError(tx(locale, "Not connected. Please refresh and try again."));
      return;
    }
    const toImport = candidates.filter((candidate) => candidate.include && candidateIsValid(candidate));
    if (!toImport.length) {
      setError(tx(locale, "There are no valid rows selected to import."));
      return;
    }
    const payloads = toImport.map((candidate) => ({
      user_id: userId,
      asset_type: candidate.asset_type,
      symbol: candidate.symbol.trim().toUpperCase(),
      name: candidate.name.trim() || candidate.symbol.trim().toUpperCase(),
      quantity: Number(candidate.quantity),
      average_cost: Number(candidate.average_cost),
      cost_currency: candidate.cost_currency,
      cost_known: true,
    }));

    setImporting(true);
    try {
      const { error: insertError } = await supabase.from("holdings").insert(payloads);
      if (insertError) {
        setError(insertError.message);
        return;
      }
      await onHoldingsChanged();
      const skipped = candidates.length - toImport.length;
      setResult(
        zh
          ? `成功匯入 ${toImport.length} 筆持倉${skipped > 0 ? `，略過 ${skipped} 筆` : ""}。`
          : `Imported ${toImport.length} holdings${skipped > 0 ? `, skipped ${skipped}` : ""}.`,
      );
      setHeaders([]);
      setDataRows([]);
      setMapping(null);
      setCandidates([]);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setImporting(false);
    }
  }

  const hasFile = mapping !== null;

  return (
    <div className="space-y-5">
      <section className={embedded ? "" : "glass-panel apple-card p-5"}>
        {!embedded && (
          <div className="mb-4 flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-mint" />
            <h3 className="text-xl font-semibold text-ink">{tx(locale, "Import holdings from Excel")}</h3>
          </div>
        )}
        <p className="text-sm leading-6 text-titanium">
          {zh
            ? "上傳 .xlsx 或 .csv，系統會自動辨識欄位並讓你在匯入前預覽、修正。也可以先下載範本填寫。"
            : "Upload an .xlsx or .csv file. Columns are auto-detected and you can review and fix everything before importing. You can also start from the template."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="interactive-muted focus-ring inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium text-ink"
            onClick={downloadTemplate}
            type="button"
          >
            <FileSpreadsheet size={16} />
            {tx(locale, "Download template")}
          </button>
          <label className="primary-button focus-ring inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium">
            <Upload size={16} />
            {tx(locale, "Choose file")}
            <input
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
              ref={fileInputRef}
              type="file"
            />
          </label>
          {fileName && <span className="inline-flex items-center text-sm text-titanium">{fileName}</span>}
        </div>

        {error && (
          <div className="apple-card-sm mt-4 flex items-start gap-2 border border-rose/30 bg-rose/10 p-4 text-sm text-rose">
            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
            <span>{error}</span>
          </div>
        )}
        {result && (
          <div className="apple-card-sm mt-4 flex items-start gap-2 border border-mint/30 bg-mint/10 p-4 text-sm text-mint">
            <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
            <span>{result}</span>
          </div>
        )}
      </section>

      {hasFile && (
        <>
          <section className={embedded ? "border-t border-line pt-5" : "glass-panel apple-card p-5"}>
            <h4 className="text-lg font-semibold text-ink">{tx(locale, "Column mapping")}</h4>
            <p className="mt-1 text-sm text-titanium">
              {tx(locale, "Auto-mapping may be imperfect — confirm or adjust below.")}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {FIELD_ORDER.map((field) => (
                <label className="block" key={field}>
                  <span className="mb-1.5 block text-xs font-medium text-titanium">
                    {zh ? fieldLabels[field].zh : fieldLabels[field].en}
                  </span>
                  <select
                    className="input-control focus-ring w-full px-3 text-ink"
                    value={mapping?.[field] ?? ""}
                    onChange={(event) => updateMapping(field, event.target.value === "" ? null : Number(event.target.value))}
                  >
                    <option value="">{tx(locale, "(not mapped)")}</option>
                    {headers.map((header, index) => (
                      <option key={`${field}-${index}`} value={index}>
                        {header || `${tx(locale, "Column")} ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className={embedded ? "border-t border-line pt-5" : "glass-panel apple-card p-5"}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-ink">{tx(locale, "Import preview")}</h4>
                <p className="mt-1 text-sm text-titanium">
                  {zh
                    ? `共 ${candidates.length} 列，可匯入 ${validCount} 列，已勾選 ${selectedValidCount} 列，${duplicateCount} 列在系統已存在。`
                    : `${candidates.length} rows · ${validCount} valid · ${selectedValidCount} selected · ${duplicateCount} already exist.`}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="interactive-muted focus-ring rounded-full border border-line px-3 py-2 text-xs text-ink" onClick={() => setAllIncluded(true)} type="button">
                  {tx(locale, "Select all")}
                </button>
                <button className="interactive-muted focus-ring rounded-full border border-line px-3 py-2 text-xs text-ink" onClick={() => setAllIncluded(false)} type="button">
                  {tx(locale, "Clear all")}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-titanium">
                    <th className="px-2 py-2 font-medium">{tx(locale, "Import")}</th>
                    <th className="px-2 py-2 font-medium">{tx(locale, "Type")}</th>
                    <th className="px-2 py-2 font-medium">{tx(locale, "Symbol")}</th>
                    <th className="px-2 py-2 font-medium">{tx(locale, "Name")}</th>
                    <th className="px-2 py-2 font-medium">{tx(locale, "Quantity")}</th>
                    <th className="px-2 py-2 font-medium">{tx(locale, "Avg cost")}</th>
                    <th className="px-2 py-2 font-medium">{tx(locale, "Currency")}</th>
                    <th className="px-2 py-2 font-medium">{tx(locale, "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => {
                    const valid = candidateIsValid(candidate);
                    const duplicate = isDuplicate(candidate);
                    return (
                      <tr className={clsx("border-b border-line/60", !valid && "bg-rose/5")} key={candidate.id}>
                        <td className="px-2 py-2">
                          <input
                            checked={candidate.include}
                            className="h-4 w-4"
                            onChange={(event) => updateCandidate(candidate.id, "include", event.target.checked)}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            className="input-control focus-ring w-full min-w-[96px] px-2 text-ink"
                            value={candidate.asset_type}
                            onChange={(event) => updateCandidate(candidate.id, "asset_type", event.target.value as AssetType)}
                          >
                            <option value="us_stock">{tx(locale, "US stock")}</option>
                            <option value="tw_stock">{tx(locale, "TW stock")}</option>
                            <option value="crypto">{tx(locale, "Crypto")}</option>
                            <option value="cash">{tx(locale, "Cash")}</option>
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="input-control focus-ring w-full min-w-[88px] px-2 uppercase text-ink"
                            onChange={(event) => updateCandidate(candidate.id, "symbol", event.target.value)}
                            value={candidate.symbol}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="input-control focus-ring w-full min-w-[120px] px-2 text-ink"
                            onChange={(event) => updateCandidate(candidate.id, "name", event.target.value)}
                            value={candidate.name}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="input-control focus-ring w-full min-w-[80px] px-2 text-ink"
                            inputMode="decimal"
                            onChange={(event) => updateCandidate(candidate.id, "quantity", event.target.value)}
                            value={candidate.quantity}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="input-control focus-ring w-full min-w-[80px] px-2 text-ink"
                            inputMode="decimal"
                            onChange={(event) => updateCandidate(candidate.id, "average_cost", event.target.value)}
                            value={candidate.average_cost}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            className="input-control focus-ring w-full min-w-[76px] px-2 text-ink"
                            value={candidate.cost_currency}
                            onChange={(event) => updateCandidate(candidate.id, "cost_currency", event.target.value as Currency)}
                          >
                            {supportedCurrencies.map((currency) => (
                              <option key={currency} value={currency}>{currency}</option>
                            ))}
                          </select>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {!valid ? (
                            <span className="inline-flex items-center gap-1 text-xs text-rose">
                              <AlertTriangle size={13} />
                              {tx(locale, "Invalid")}
                            </span>
                          ) : duplicate ? (
                            <span className="inline-flex items-center rounded-full bg-amber/15 px-2 py-0.5 text-xs font-medium text-amber">
                              {tx(locale, "Exists")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-mint">
                              <CheckCircle2 size={13} />
                              {tx(locale, "Ready")}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="primary-button focus-ring inline-flex items-center gap-2 rounded-full px-5 py-3 font-medium disabled:opacity-60"
                disabled={importing || selectedValidCount === 0}
                onClick={handleImport}
                type="button"
              >
                {importing && <LoaderCircle className="animate-spin" size={16} />}
                {zh ? `匯入 ${selectedValidCount} 筆持倉` : `Import ${selectedValidCount} holdings`}
              </button>
              <button
                className="interactive-muted focus-ring rounded-full border border-line px-5 py-3 text-ink"
                onClick={resetAll}
                type="button"
              >
                {tx(locale, "Start over")}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
