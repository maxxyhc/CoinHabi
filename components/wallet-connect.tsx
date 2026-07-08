"use client";

import { useEffect, useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { CheckCircle2, ChevronDown, Cpu, Link2, Plus, Smartphone } from "lucide-react";
import clsx from "clsx";
import { isWalletConnectConfigured } from "@/lib/appkit";
import type { Locale, WalletChain } from "@/lib/types";
import { tx } from "@/lib/i18n";

type ConnectableChain = Exclude<WalletChain, "cardano">;
type WalletKind = "hardware" | "hot";

const evmChains: ConnectableChain[] = ["ethereum", "base", "arbitrum", "optimism", "polygon"];

type ConnectedAddress = {
  address: string;
  chain: ConnectableChain;
  label: string;
};

type WalletOption = {
  id: string;
  name: string;
  description: { zh: string; en: string };
  chains: ConnectableChain[];
};

const chainInfo: Record<ConnectableChain, { namespace: "eip155" | "solana" | "bip122"; title: string }> = {
  ethereum: { namespace: "eip155", title: "Ethereum" },
  base: { namespace: "eip155", title: "Base" },
  arbitrum: { namespace: "eip155", title: "Arbitrum One" },
  optimism: { namespace: "eip155", title: "OP Mainnet" },
  polygon: { namespace: "eip155", title: "Polygon PoS" },
  solana: { namespace: "solana", title: "Solana" },
  bitcoin: { namespace: "bip122", title: "Bitcoin" },
};

const walletOptions: Record<WalletKind, WalletOption[]> = {
  hardware: [
    {
      id: "ledger",
      name: "Ledger",
      description: {
        zh: "透過 Ledger Live 或相容錢包連接",
        en: "Connect through Ledger Live or a compatible wallet",
      },
      chains: [...evmChains, "solana", "bitcoin"],
    },
    {
      id: "trezor",
      name: "Trezor",
      description: {
        zh: "透過 Trezor Suite 或相容錢包連接",
        en: "Connect through Trezor Suite or a compatible wallet",
      },
      chains: [...evmChains, "bitcoin"],
    },
  ],
  hot: [
    {
      id: "metamask",
      name: "MetaMask",
      description: { zh: "瀏覽器或手機錢包", en: "Browser or mobile wallet" },
      chains: evmChains,
    },
    {
      id: "phantom",
      name: "Phantom",
      description: { zh: "Solana 與 EVM 錢包", en: "Solana and EVM wallet" },
      chains: ["solana", ...evmChains],
    },
    {
      id: "trust",
      name: "Trust Wallet",
      description: { zh: "多鏈手機錢包", en: "Multi-chain mobile wallet" },
      chains: [...evmChains, "solana", "bitcoin"],
    },
    {
      id: "other",
      name: "Other wallet",
      description: { zh: "其他 WalletConnect 相容錢包", en: "Other WalletConnect-compatible wallet" },
      chains: [...evmChains, "solana", "bitcoin"],
    },
  ],
};

export function WalletConnect({ locale, onUseAddress }: { locale: Locale; onUseAddress: (value: ConnectedAddress) => void }) {
  if (!isWalletConnectConfigured) {
    return (
      <div className="apple-card-sm border border-amber/30 bg-amber/5 p-4">
        <p className="font-medium text-ink">{tx(locale, "Wallet connection is not configured")}</p>
        <p className="mt-1 text-xs leading-5 text-titanium">
          {tx(locale, "Add NEXT_PUBLIC_REOWN_PROJECT_ID to .env.local, then restart the app.")}
        </p>
      </div>
    );
  }

  return <ConfiguredWalletConnect locale={locale} onUseAddress={onUseAddress} />;
}

function ConfiguredWalletConnect({ locale, onUseAddress }: { locale: Locale; onUseAddress: (value: ConnectedAddress) => void }) {
  const zh = locale === "zh";
  const { open } = useAppKit();
  const [kind, setKind] = useState<WalletKind>("hardware");
  const [selectedWalletId, setSelectedWalletId] = useState("ledger");
  const [selectionOpen, setSelectionOpen] = useState(true);
  const [requestedChains, setRequestedChains] = useState<ConnectableChain[]>([]);
  const ethereum = useAppKitAccount({ namespace: "eip155" });
  const solanaAccount = useAppKitAccount({ namespace: "solana" });
  const bitcoinAccount = useAppKitAccount({ namespace: "bip122" });
  const options = walletOptions[kind];
  const selectedWallet = options.find((wallet) => wallet.id === selectedWalletId) ?? options[0];
  const accountFor = (chain: ConnectableChain) => evmChains.includes(chain) ? ethereum : chain === "solana" ? solanaAccount : bitcoinAccount;
  const connectedChains = requestedChains.filter((chain) => accountFor(chain).address);

  useEffect(() => {
    setRequestedChains((current) => {
      const next = [...current];
      if (ethereum.address && !next.some((chain) => evmChains.includes(chain))) next.push("ethereum");
      if (solanaAccount.address && !next.includes("solana")) next.push("solana");
      if (bitcoinAccount.address && !next.includes("bitcoin")) next.push("bitcoin");
      return next.length === current.length ? current : next;
    });
  }, [bitcoinAccount.address, ethereum.address, solanaAccount.address]);

  useEffect(() => {
    if (connectedChains.length > 0) setSelectionOpen(false);
  }, [connectedChains.length]);

  function changeKind(nextKind: WalletKind) {
    setKind(nextKind);
    setSelectedWalletId(walletOptions[nextKind][0].id);
  }

  function connectChain(chain: ConnectableChain) {
    setRequestedChains((current) => current.includes(chain) ? current : [...current, chain]);
    const account = accountFor(chain);
    if (account.isConnected) {
      setSelectionOpen(false);
      return;
    }
    void open({ view: "Connect", namespace: chainInfo[chain].namespace });
  }

  return (
    <div className="space-y-4">
      {connectedChains.length > 0 && !selectionOpen && (
        <button
          className="interactive-muted focus-ring flex w-full items-center justify-between rounded-full border border-line px-4 py-3 text-sm font-medium text-ink"
          onClick={() => setSelectionOpen(true)}
          type="button"
        >
          <span>{tx(locale, "Connect another wallet or asset")}</span>
          <ChevronDown size={16} />
        </button>
      )}

      {selectionOpen && <div className="space-y-4">
      <div className="pill-panel grid grid-cols-2 gap-2 p-1.5">
        <button
          className={clsx("focus-ring flex min-h-12 items-center justify-center gap-2 rounded-full text-sm font-medium", kind === "hardware" ? "primary-button" : "text-titanium hover:text-ink")}
          onClick={() => changeKind("hardware")}
          type="button"
        >
          <Cpu size={17} />
          {tx(locale, "Cold wallet")}
        </button>
        <button
          className={clsx("focus-ring flex min-h-12 items-center justify-center gap-2 rounded-full text-sm font-medium", kind === "hot" ? "primary-button" : "text-titanium hover:text-ink")}
          onClick={() => changeKind("hot")}
          type="button"
        >
          <Smartphone size={17} />
          {tx(locale, "Hot wallet")}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((wallet) => (
          <button
            className={clsx(
              "focus-ring rounded-2xl border p-3 text-left transition",
              selectedWallet.id === wallet.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line bg-panel hover:border-[var(--accent)]",
            )}
            key={wallet.id}
            onClick={() => setSelectedWalletId(wallet.id)}
            type="button"
          >
            <span className="block font-medium text-ink">{wallet.name}</span>
            <span className="mt-1 block text-xs leading-5 text-titanium">{zh ? wallet.description.zh : wallet.description.en}</span>
          </button>
        ))}
      </div>

      <div className="field-surface apple-card-sm border border-line p-4">
        <p className="text-sm font-medium text-ink">
          {tx(locale, "Choose a network or asset to import")}
        </p>
        <p className="mt-1 text-xs leading-5 text-titanium">
          {zh ? `將透過 ${selectedWallet.name} 取得所選區塊鏈的公開地址。` : `The public address will be requested through ${selectedWallet.name}.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedWallet.chains.map((chain) => (
            <button
              className="interactive-muted focus-ring flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs font-medium text-ink"
              key={chain}
              onClick={() => connectChain(chain)}
              type="button"
            >
              {accountFor(chain).isConnected ? <CheckCircle2 className="text-mint" size={15} /> : <Link2 size={15} />}
              {chainInfo[chain].title}
            </button>
          ))}
        </div>
      </div>
      </div>}

      {connectedChains.length > 0 && (
        <div className="apple-card-sm border border-mint/25 bg-mint/5 p-4">
          <p className="text-sm font-medium text-ink">{tx(locale, "Connected public addresses")}</p>
          <div className="mt-3 space-y-2">
            {connectedChains.map((chain) => {
              const account = accountFor(chain);
              return (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-3" key={chain}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink">{chainInfo[chain].title}</p>
                    <p className="mt-1 truncate font-mono text-xs text-titanium">{account.address}</p>
                  </div>
                  <button
                    className="primary-button focus-ring flex items-center gap-1 rounded-full px-3 py-2 text-xs font-medium"
                    onClick={() => onUseAddress({ address: account.address!, chain, label: `${selectedWallet.name} ${chainInfo[chain].title}` })}
                    type="button"
                  >
                    <Plus size={14} />
                    {tx(locale, "Track")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs leading-5 text-titanium">
        {kind === "hardware"
          ? (tx(locale, "Cold wallets usually provide their public address through Ledger Live, Trezor Suite, MetaMask, or Phantom."))
          : (tx(locale, "Only public addresses are read. No signature, seed phrase, private key, or PIN is requested."))}
      </p>
    </div>
  );
}
