"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Plus, RefreshCw, Trash2, Wallet } from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { WalletConnect } from "@/components/wallet-connect";
import type { Holding, Locale, WalletAccount, WalletAddressKind, WalletChain, WalletScanResponse } from "@/lib/types";
import { tx } from "@/lib/i18n";
import { resolveGainCalculationMode } from "@/lib/calculations";

const chainLabels: Record<WalletChain, string> = {
  ethereum: "Ethereum / EVM",
  base: "Base",
  arbitrum: "Arbitrum One",
  optimism: "OP Mainnet",
  polygon: "Polygon PoS",
  bitcoin: "Bitcoin",
  solana: "Solana",
  cardano: "Cardano",
};

const walletWarningMessages = {
  bitcoinSingleAddress: {
    en: "A single Bitcoin address may not represent your entire wallet. Add other addresses separately.",
    zh: "單一 Bitcoin 地址可能無法代表完整錢包。請分別加入其他地址。",
  },
  cardanoStakeRecommended: {
    en: "For Cardano, a stake1... address usually gives a more complete wallet view than one addr1... address.",
    zh: "Cardano 建議使用 stake1...，通常比單一 addr1... 更完整。",
  },
  noPositiveBalance: {
    en: "No assets with a positive balance were found, so the native coin is shown as 0 in the overview.",
    zh: "這次同步沒有找到正餘額資產，總覽會以 0 顯示這個原生幣。",
  },
};

const demoWalletAccounts: WalletAccount[] = [
  {
    id: "demo-wallet-eth",
    user_id: "demo-user",
    chain: "ethereum",
    address_kind: "address",
    label: "Demo ETH wallet",
    address: "0x000000000000000000000000000000000000dEaD",
    sync_status: "synced",
    last_synced_at: "2026-07-01T23:00:00.000Z",
    last_error: null,
    created_at: "2026-07-01T23:00:00.000Z",
    updated_at: "2026-07-01T23:00:00.000Z",
  },
  {
    id: "demo-wallet-btc",
    user_id: "demo-user",
    chain: "bitcoin",
    address_kind: "address",
    label: "Demo BTC wallet",
    address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    sync_status: "synced",
    last_synced_at: "2026-07-01T23:00:00.000Z",
    last_error: walletWarningMessages.bitcoinSingleAddress.en,
    created_at: "2026-07-01T23:00:00.000Z",
    updated_at: "2026-07-01T23:00:00.000Z",
  },
];

export function WalletTracker({
  demo = false,
  locale,
  userId,
  onHoldingsChanged,
}: {
  demo?: boolean;
  locale: Locale;
  userId: string;
  onHoldingsChanged: () => Promise<void>;
}) {
  const supabase = useRef(demo ? null : createSupabaseBrowserClient()).current;
  const [accounts, setAccounts] = useState<WalletAccount[]>(demo ? demoWalletAccounts : []);
  const [chain, setChain] = useState<WalletChain>("ethereum");
  const [addressKind, setAddressKind] = useState<WalletAddressKind>("address");
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const autoSyncStarted = useRef(false);
  const syncingIds = useRef(new Set<string>());
  const zh = locale === "zh";

  const loadAccounts = useCallback(async () => {
    if (demo) {
      setAccounts(demoWalletAccounts);
      return demoWalletAccounts;
    }
    if (!supabase) return [];
    const { data, error: loadError } = await supabase.from("wallet_accounts").select("*").order("created_at");
    if (loadError) {
      setError(loadError.message);
      return [];
    }
    const next = (data ?? []) as WalletAccount[];
    setAccounts(next);
    return next;
  }, [demo, supabase]);

  const syncAccount = useCallback(async (account: WalletAccount, quiet = false) => {
    if (!supabase) return;
    if (syncingIds.current.has(account.id)) return;
    syncingIds.current.add(account.id);
    if (!quiet) setError("");
    setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, sync_status: "syncing" } : item));
    await supabase.from("wallet_accounts").update({ sync_status: "syncing", last_error: null }).eq("id", account.id);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error(tx(locale, "Your session has expired. Please sign in again."));
      }

      const response = await fetch("/api/wallet/scan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chain: account.chain,
          address: account.address,
          addressKind: account.address_kind ?? "address",
          gapLimit: account.gap_limit ?? 20,
        }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          response.status === 401
            ? (tx(locale, "Your session has expired. Please sign in again."))
            : (zh ? `錢包同步服務回傳異常格式（HTTP ${response.status}）。` : `Wallet sync returned an invalid response (HTTP ${response.status}).`),
        );
      }
      const result = (await response.json()) as WalletScanResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Wallet sync failed.");

      const assets = result.assets.filter((asset) => asset.quantity > 0 || asset.assetId === account.chain);
      const { data: existing } = await supabase
        .from("holdings")
        .select("id, source_asset_id, average_cost, break_even_price, gain_calculation_mode, cost_currency, cost_known")
        .eq("source_account_id", account.id);
      const existingByAsset = new Map(
        ((existing ?? []) as Pick<Holding, "id" | "source_asset_id" | "average_cost" | "break_even_price" | "gain_calculation_mode" | "cost_currency" | "cost_known">[])
          .map((item) => [item.source_asset_id, item]),
      );
      if (assets.length) {
        const payload = assets.map((asset) => {
          const savedCost = existingByAsset.get(asset.assetId);
          const gainCalculationMode = savedCost
            ? resolveGainCalculationMode(savedCost)
            : "estimated";
          return {
            user_id: userId,
            asset_type: "crypto" as const,
            symbol: asset.symbol.toUpperCase(),
            name: asset.name,
            quantity: asset.quantity,
            average_cost: savedCost?.average_cost ?? 0,
            break_even_price: gainCalculationMode === "break_even" &&
              savedCost?.break_even_price !== null &&
              savedCost?.break_even_price !== undefined &&
              Number.isFinite(savedCost.break_even_price) &&
              savedCost.break_even_price > 0
              ? savedCost.break_even_price
              : null,
            gain_calculation_mode: gainCalculationMode,
            cost_currency: savedCost?.cost_currency ?? ("USD" as const),
            notes: null,
            market_data_id: asset.marketDataId ?? null,
            source_kind: "wallet" as const,
            source_label: account.label,
            source_account_id: account.id,
            source_asset_id: asset.assetId,
            cost_known: savedCost?.cost_known ?? false,
          };
        });
        const { error: upsertError } = await supabase.from("holdings").upsert(payload, { onConflict: "source_account_id,source_asset_id" });
        if (upsertError) throw upsertError;
      }

      const activeIds = new Set(assets.map((asset) => asset.assetId));
      const staleIds = ((existing ?? []) as Pick<Holding, "id" | "source_asset_id">[])
        .filter((item) => !item.source_asset_id || !activeIds.has(item.source_asset_id))
        .map((item) => item.id);
      if (staleIds.length) {
        const { error: deleteError } = await supabase.from("holdings").delete().in("id", staleIds);
        if (deleteError) throw deleteError;
      }

      const warning = [
        ...result.warnings,
        assets.some((asset) => asset.quantity > 0) ? "" : walletWarningMessages.noPositiveBalance.en,
      ].filter(Boolean).join(" ") || null;
      const { error: statusError } = await supabase.from("wallet_accounts").update({
        sync_status: "synced",
        last_synced_at: result.refreshedAt,
        last_error: warning,
      }).eq("id", account.id);
      if (statusError) throw statusError;
      await Promise.all([loadAccounts(), onHoldingsChanged()]);
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "Wallet sync failed.";
      await supabase.from("wallet_accounts").update({ sync_status: "error", last_error: message }).eq("id", account.id);
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, sync_status: "error", last_error: message } : item));
      if (!quiet) setError(message);
    } finally {
      syncingIds.current.delete(account.id);
    }
  }, [loadAccounts, locale, onHoldingsChanged, supabase, userId, zh]);

  useEffect(() => {
    if (demo) return;
    void loadAccounts().then((loaded) => {
      if (autoSyncStarted.current) return;
      autoSyncStarted.current = true;
      loaded.forEach((account) => void syncAccount(account, true));
    });
  }, [demo, loadAccounts, syncAccount]);

  async function addAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo) {
      setError(tx(locale, "Demo mode uses isolated sample data and does not connect or save real wallets."));
      return;
    }
    if (!supabase || saving) return;
    const normalizedAddress = address.trim();
    if (!normalizedAddress) {
      setError(tx(locale, "Enter a public address."));
      return;
    }
    if (accounts.some((account) => account.chain === chain && account.address.toLowerCase() === normalizedAddress.toLowerCase())) {
      setError(tx(locale, "This address is already being tracked."));
      return;
    }
    setSaving(true);
    setError("");
    const bitcoinXpub = chain === "bitcoin" && addressKind === "xpub";
    const payload = {
      user_id: userId,
      chain,
      address_kind: bitcoinXpub ? "xpub" : "address",
      derivation_purpose: bitcoinXpub ? bitcoinPurpose(normalizedAddress) : null,
      account_index: 0,
      gap_limit: bitcoinXpub ? 20 : 20,
      label: label.trim() || (bitcoinXpub ? "Bitcoin account" : chainLabels[chain]),
      address: normalizedAddress,
    };
    const { data, error: insertError } = await supabase.from("wallet_accounts").insert(payload).select().single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setLabel("");
    setAddress("");
    setAddressKind("address");
    const account = data as WalletAccount;
    setAccounts((current) => [...current, account]);
    await syncAccount(account);
  }

  async function deleteAccount(account: WalletAccount) {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("wallet_accounts").delete().eq("id", account.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setAccounts((current) => current.filter((item) => item.id !== account.id));
    await onHoldingsChanged();
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[400px_1fr]">
      <section className="glass-panel apple-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <Wallet size={20} style={{ color: "var(--accent)" }} />
          <h3 className="text-xl font-semibold text-ink">{tx(locale, "Add watch-only address")}</h3>
        </div>
        <div className="mb-5">
          <p className="mb-1 text-sm font-medium text-ink">{tx(locale, "Choose wallet type")}</p>
          <p className="mb-3 text-xs leading-5 text-titanium">{tx(locale, "Choose cold or hot wallet, then select the wallet and blockchain.")}</p>
          {demo ? (
            <div className="apple-card-sm border border-mint/20 bg-mint/5 p-4 text-sm leading-6 text-titanium">
              {tx(locale, "Demo mode uses isolated sample wallets and never reads, connects, or stores real wallet data.")}
            </div>
          ) : (
            <WalletConnect
              locale={locale}
              onUseAddress={(connected) => {
                setChain(connected.chain);
                setAddressKind("address");
                setLabel(connected.label);
                setAddress(connected.address);
                setError("");
              }}
            />
          )}
        </div>
        <div className="mb-5 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-titanium">
          <span className="h-px flex-1 bg-line" />
          <span>{tx(locale, "Or enter manually")}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <form className={clsx("space-y-4", demo && "opacity-60")} onSubmit={addAccount}>
          <fieldset className="contents" disabled={demo}>
          <Field label={tx(locale, "Blockchain")}>
            <select
              className="input-control focus-ring w-full px-3 text-ink"
              value={chain}
              onChange={(event) => {
                const nextChain = event.target.value as WalletChain;
                setChain(nextChain);
                if (nextChain !== "bitcoin") setAddressKind("address");
              }}
            >
              {Object.entries(chainLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </Field>
          {chain === "bitcoin" && (
            <Field label={tx(locale, "Bitcoin tracking mode")}>
              <div className="pill-panel grid grid-cols-2 gap-2 p-1.5">
                <button
                  className={clsx("focus-ring min-h-11 rounded-full text-sm font-medium", addressKind === "address" ? "primary-button" : "text-titanium hover:text-ink")}
                  onClick={() => setAddressKind("address")}
                  type="button"
                >
                  {tx(locale, "Single address")}
                </button>
                <button
                  className={clsx("focus-ring min-h-11 rounded-full text-sm font-medium", addressKind === "xpub" ? "primary-button" : "text-titanium hover:text-ink")}
                  onClick={() => setAddressKind("xpub")}
                  type="button"
                >
                  xpub / ypub / zpub
                </button>
              </div>
            </Field>
          )}
          <Field label={tx(locale, "Name")}>
            <input className="input-control focus-ring w-full px-3 text-ink" placeholder={tx(locale, "e.g. Cold wallet")} value={label} onChange={(event) => setLabel(event.target.value)} />
          </Field>
          <Field label={chain === "bitcoin" && addressKind === "xpub" ? "xpub / ypub / zpub" : "Public address"}>
            <textarea
              className="input-control focus-ring min-h-24 w-full resize-none px-3 py-3 font-mono text-sm text-ink"
              placeholder={addressPlaceholder(chain, addressKind)}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
            />
          </Field>
          <div className="apple-card-sm border border-mint/20 bg-mint/5 p-3 text-xs leading-5 text-titanium">
            {tx(locale, "Public information only. Never enter a seed phrase, private key, or PIN.")}
          </div>
          {chain === "bitcoin" && addressKind === "address" && <Notice>{tx(locale, "One Bitcoin address may not represent the entire wallet. Use xpub/ypub/zpub for account-level tracking.")}</Notice>}
          {chain === "bitcoin" && addressKind === "xpub" && <Notice>{tx(locale, "xpub/ypub/zpub can only reveal public addresses and balances, not spend funds. It does expose account-level privacy.")}</Notice>}
          {chain === "cardano" && <Notice>{tx(locale, "For Cardano, stake1... is recommended for a more complete wallet view. If you cannot find a stake address, addr1... still works but may only represent one address.")}</Notice>}
          <button className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium disabled:opacity-60" disabled={saving} type="submit">
            {saving ? <LoaderCircle className="animate-spin" size={17} /> : <Plus size={17} />}
            {tx(locale, "Add and sync")}
          </button>
          </fieldset>
        </form>
      </section>

      <section className="glass-panel apple-card p-5">
        <div className="mb-5">
          <h3 className="text-xl font-semibold text-ink">{tx(locale, "Tracked addresses")}</h3>
          <p className="mt-1 text-sm text-titanium">
            {demo
              ? (tx(locale, "These are isolated examples and do not access your wallet or database."))
              : (tx(locale, "Addresses sync on page load and can be refreshed individually."))}
          </p>
        </div>
        {error && <div className="apple-card-sm mb-4 border border-rose/30 bg-rose/10 p-3 text-sm text-rose">{error}</div>}
        {!accounts.length ? (
          <div className="subtle-panel apple-card-sm p-8 text-center text-titanium">{tx(locale, "No tracked addresses yet.")}</div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <article key={account.id} className="subtle-panel apple-card-sm p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={account.sync_status} />
                      <p className="font-semibold text-ink">{account.label}</p>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-titanium">{chainLabels[account.chain]}</span>
                      {account.chain === "bitcoin" && account.address_kind === "xpub" && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-titanium">xpub</span>}
                    </div>
                    <p className="mt-2 truncate font-mono text-xs text-titanium">{account.address}</p>
                    <p className="mt-2 text-xs text-titanium">
                      {account.sync_status === "syncing" ? (tx(locale, "Syncing...")) : account.last_synced_at ? `${tx(locale, "Last sync")}: ${new Date(account.last_synced_at).toLocaleString()}` : (tx(locale, "Not synced yet"))}
                    </p>
                    {account.last_error && <p className={clsx("mt-2 text-xs", account.sync_status === "error" ? "text-rose" : "text-amber")}>{translateWalletWarning(account.last_error, locale)}</p>}
                  </div>
                  {!demo && <div className="flex gap-2">
                    <button aria-label="Refresh wallet" className="focus-ring rounded-xl border border-line p-2 text-titanium hover:text-ink" disabled={account.sync_status === "syncing"} onClick={() => void syncAccount(account)} type="button"><RefreshCw className={clsx(account.sync_status === "syncing" && "animate-spin")} size={16} /></button>
                    <button aria-label="Delete wallet" className="focus-ring rounded-xl border border-line p-2 text-titanium hover:bg-rose/10 hover:text-rose" onClick={() => void deleteAccount(account)} type="button"><Trash2 size={16} /></button>
                  </div>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusIcon({ status }: { status: WalletAccount["sync_status"] }) {
  if (status === "syncing") return <LoaderCircle className="animate-spin" size={17} style={{ color: "var(--accent)" }} />;
  if (status === "error") return <AlertTriangle className="text-rose" size={17} />;
  if (status === "synced") return <CheckCircle2 className="text-mint" size={17} />;
  return <Wallet className="text-titanium" size={17} />;
}

function translateWalletWarning(message: string, locale: Locale) {
  const target = locale === "zh" ? "zh" : "en";
  return Object.values(walletWarningMessages).reduce((text, warning) => {
    return text
      .replaceAll(warning.en, warning[target])
      .replaceAll(warning.zh, warning[target]);
  }, message);
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="apple-card-sm flex gap-2 border border-amber/20 bg-amber/5 p-3 text-xs leading-5 text-amber"><AlertTriangle className="shrink-0" size={16} />{children}</div>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="block"><span className="mb-2 block text-sm text-titanium">{label}</span>{children}</label>;
}

function addressPlaceholder(chain: WalletChain, addressKind: WalletAddressKind) {
  if (chain === "cardano") return "stake1... (recommended) or addr1...";
  if (chain === "bitcoin" && addressKind === "xpub") return "xpub... / ypub... / zpub...";
  return "Public address only";
}

function bitcoinPurpose(value: string) {
  const prefix = value.slice(0, 4).toLowerCase();
  if (prefix === "xpub") return 44;
  if (prefix === "ypub") return 49;
  if (prefix === "zpub") return 84;
  return null;
}
