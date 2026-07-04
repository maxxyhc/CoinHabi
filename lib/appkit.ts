"use client";

import { createAppKit } from "@reown/appkit/react";
import { arbitrum, base, bitcoin, mainnet, optimism, polygon, solana } from "@reown/appkit/networks";
import { BitcoinAdapter } from "@reown/appkit-adapter-bitcoin";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

export const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() ?? "";
export const isWalletConnectConfigured = Boolean(reownProjectId);

if (isWalletConnectConfigured) {
  const evmNetworks: [typeof mainnet, typeof base, typeof arbitrum, typeof optimism, typeof polygon] = [
    mainnet,
    base,
    arbitrum,
    optimism,
    polygon,
  ];
  const networks: [typeof mainnet, typeof base, typeof arbitrum, typeof optimism, typeof polygon, typeof solana, typeof bitcoin] = [
    ...evmNetworks,
    solana,
    bitcoin,
  ];
  const wagmiAdapter = new WagmiAdapter({ networks: evmNetworks, projectId: reownProjectId });

  createAppKit({
    adapters: [wagmiAdapter, new SolanaAdapter(), new BitcoinAdapter()],
    networks,
    defaultNetwork: mainnet,
    projectId: reownProjectId,
    metadata: {
      name: "Financial Tracker",
      description: "Read-only portfolio and public wallet tracking",
      url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3021",
      icons: [],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
    },
  });
}
