import type { EvmWalletChain, WalletAddressKind, WalletAsset, WalletChain, WalletScanResponse } from "@/lib/types";

const nativeAssets: Record<WalletChain, Omit<WalletAsset, "quantity">> = {
  ethereum: { assetId: "ethereum", symbol: "ETH", name: "Ethereum", priceUsd: null, dayChangePercent: 0, marketDataId: "ethereum" },
  base: { assetId: "base", symbol: "ETH", name: "Ethereum on Base", priceUsd: null, dayChangePercent: 0, marketDataId: "ethereum" },
  arbitrum: { assetId: "arbitrum", symbol: "ETH", name: "Ethereum on Arbitrum", priceUsd: null, dayChangePercent: 0, marketDataId: "ethereum" },
  optimism: { assetId: "optimism", symbol: "ETH", name: "Ethereum on OP Mainnet", priceUsd: null, dayChangePercent: 0, marketDataId: "ethereum" },
  polygon: { assetId: "polygon", symbol: "POL", name: "Polygon Ecosystem Token", priceUsd: null, dayChangePercent: 0, marketDataId: "polygon-ecosystem-token" },
  bitcoin: { assetId: "bitcoin", symbol: "BTC", name: "Bitcoin", priceUsd: null, dayChangePercent: 0, marketDataId: "bitcoin" },
  solana: { assetId: "solana", symbol: "SOL", name: "Solana", priceUsd: null, dayChangePercent: 0, marketDataId: "solana" },
  cardano: { assetId: "cardano", symbol: "ADA", name: "Cardano", priceUsd: null, dayChangePercent: 0, marketDataId: "cardano" },
};

const evmChains: Record<EvmWalletChain, { baseUrl: string; envUrl?: string; label: string }> = {
  ethereum: { baseUrl: "https://eth.blockscout.com", envUrl: process.env.ETHEREUM_BLOCKSCOUT_URL, label: "Ethereum" },
  base: { baseUrl: "https://base.blockscout.com", envUrl: process.env.BASE_BLOCKSCOUT_URL, label: "Base" },
  arbitrum: { baseUrl: "https://arbitrum.blockscout.com", envUrl: process.env.ARBITRUM_BLOCKSCOUT_URL, label: "Arbitrum" },
  optimism: { baseUrl: "https://explorer.optimism.io", envUrl: process.env.OPTIMISM_BLOCKSCOUT_URL, label: "OP Mainnet" },
  polygon: { baseUrl: "https://polygon.blockscout.com", envUrl: process.env.POLYGON_BLOCKSCOUT_URL, label: "Polygon" },
};

type BitcoinAddressInfo = {
  chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number; tx_count?: number };
  mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number; tx_count?: number };
};

type XpubFormat = "p2pkh" | "p2sh-p2wpkh" | "p2wpkh";
type CardanoAsset = { policy_id?: string; asset_name?: string; quantity?: string };
type BitcoinDerivationDependencies = {
  bip32: ReturnType<typeof import("bip32")["BIP32Factory"]>;
  bitcoin: typeof import("bitcoinjs-lib");
  bs58check: typeof import("bs58check")["default"];
};

let bitcoinDerivationDependencies: Promise<BitcoinDerivationDependencies> | null = null;

function loadBitcoinDerivationDependencies() {
  if (!bitcoinDerivationDependencies) {
    bitcoinDerivationDependencies = Promise.all([
      import("bitcoinjs-lib"),
      import("bip32"),
      import("bs58check"),
      import("tiny-secp256k1"),
    ]).then(([bitcoin, { BIP32Factory }, bs58checkModule, ecc]) => ({
      bip32: BIP32Factory(ecc),
      bitcoin,
      bs58check: bs58checkModule.default,
    }));
  }
  return bitcoinDerivationDependencies;
}

const xpubVersions: Record<string, { purpose: 44 | 49 | 84; format: XpubFormat }> = {
  xpub: { purpose: 44, format: "p2pkh" },
  ypub: { purpose: 49, format: "p2sh-p2wpkh" },
  zpub: { purpose: 84, format: "p2wpkh" },
};

function native(chain: WalletChain, quantity: number): WalletAsset {
  return { ...nativeAssets[chain], quantity };
}

function shortId(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function isEvmChain(chain: WalletChain): chain is EvmWalletChain {
  return chain in evmChains;
}

export function validateWalletAddress(chain: WalletChain, address: string, addressKind: WalletAddressKind) {
  if (isEvmChain(chain)) return /^0x[a-fA-F0-9]{40}$/.test(address);
  if (chain === "bitcoin") {
    if (addressKind === "xpub") return /^(xpub|ypub|zpub)[a-zA-HJ-NP-Z0-9]{90,120}$/.test(address);
    return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/.test(address);
  }
  if (chain === "solana") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  return /^(addr1|stake1)[a-z0-9]{20,120}$/.test(address);
}

async function scanEvm(chain: EvmWalletChain, address: string) {
  const config = evmChains[chain];
  const baseUrl = config.envUrl ?? config.baseUrl;
  const [addressResponse, tokensResponse] = await Promise.all([
    fetch(`${baseUrl}/api/v2/addresses/${address}`, { next: { revalidate: 30 } }),
    fetch(`${baseUrl}/api/v2/addresses/${address}/tokens?type=ERC-20`, { next: { revalidate: 30 } }),
  ]);
  if (!addressResponse.ok) throw new Error(`${config.label} address lookup failed.`);
  const account = (await addressResponse.json()) as { coin_balance?: string };
  const tokenData = tokensResponse.ok
    ? ((await tokensResponse.json()) as { items?: Array<{ value?: string; token?: { address_hash?: string; symbol?: string; name?: string; decimals?: string } }> })
    : { items: [] };
  const assets = [native(chain, Number(account.coin_balance ?? 0) / 1e18)];
  for (const item of tokenData.items ?? []) {
    const contract = item.token?.address_hash;
    if (!contract) continue;
    const decimals = Number(item.token?.decimals ?? 0);
    const quantity = Number(item.value ?? 0) / 10 ** decimals;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    assets.push({
      assetId: `${chain}:${contract.toLowerCase()}`,
      symbol: item.token?.symbol || shortId(contract),
      name: item.token?.name || item.token?.symbol || shortId(contract),
      quantity,
      priceUsd: null,
      dayChangePercent: 0,
      contractAddress: contract.toLowerCase(),
    });
  }
  return { assets, warnings: tokensResponse.ok ? [] : [`${config.label} ERC-20 token lookup is temporarily unavailable.`] };
}

function bitcoinSatoshis(data: BitcoinAddressInfo) {
  const confirmed = (data.chain_stats?.funded_txo_sum ?? 0) - (data.chain_stats?.spent_txo_sum ?? 0);
  const pending = (data.mempool_stats?.funded_txo_sum ?? 0) - (data.mempool_stats?.spent_txo_sum ?? 0);
  return confirmed + pending;
}

function bitcoinTxCount(data: BitcoinAddressInfo) {
  return (data.chain_stats?.tx_count ?? 0) + (data.mempool_stats?.tx_count ?? 0);
}

async function fetchBitcoinAddress(base: string, address: string) {
  const response = await fetch(`${base}/address/${address}`, { next: { revalidate: 30 } });
  if (!response.ok) throw new Error("Bitcoin address lookup failed.");
  return response.json() as Promise<BitcoinAddressInfo>;
}

async function scanBitcoinAddress(address: string) {
  const base = process.env.BITCOIN_API_URL ?? "https://mempool.space/api";
  const data = await fetchBitcoinAddress(base, address);
  return {
    assets: [native("bitcoin", bitcoinSatoshis(data) / 1e8)],
    warnings: ["A single Bitcoin address may not represent your entire wallet. Add other addresses separately."],
  };
}

async function normalizeXpub(value: string) {
  const dependencies = await loadBitcoinDerivationDependencies();
  const prefix = value.slice(0, 4).toLowerCase();
  const config = xpubVersions[prefix];
  if (!config) throw new Error("Only Bitcoin mainnet xpub, ypub, and zpub are supported.");
  const decoded = dependencies.bs58check.decode(value);
  const normalized = Buffer.from(decoded);
  normalized.writeUInt32BE(0x0488b21e, 0);
  return { dependencies, xpub: dependencies.bs58check.encode(normalized), ...config };
}

function deriveBitcoinAddress(dependencies: BitcoinDerivationDependencies, xpub: string, format: XpubFormat, branch: 0 | 1, index: number) {
  const node = dependencies.bip32.fromBase58(xpub, dependencies.bitcoin.networks.bitcoin).derive(branch).derive(index);
  const publicKey = Buffer.from(node.publicKey);
  if (format === "p2pkh") {
    return dependencies.bitcoin.payments.p2pkh({ pubkey: publicKey, network: dependencies.bitcoin.networks.bitcoin }).address;
  }
  if (format === "p2sh-p2wpkh") {
    const redeem = dependencies.bitcoin.payments.p2wpkh({ pubkey: publicKey, network: dependencies.bitcoin.networks.bitcoin });
    return dependencies.bitcoin.payments.p2sh({ redeem, network: dependencies.bitcoin.networks.bitcoin }).address;
  }
  return dependencies.bitcoin.payments.p2wpkh({ pubkey: publicKey, network: dependencies.bitcoin.networks.bitcoin }).address;
}

async function scanBitcoinBranch(
  base: string,
  dependencies: BitcoinDerivationDependencies,
  xpub: string,
  format: XpubFormat,
  branch: 0 | 1,
  gapLimit: number,
) {
  const maxAddresses = Number(process.env.BITCOIN_XPUB_MAX_ADDRESSES ?? 200);
  const batchSize = 10;
  let consecutiveEmpty = 0;
  let index = 0;
  let totalSatoshis = 0;
  let scanned = 0;
  let used = 0;

  while (consecutiveEmpty < gapLimit && index < maxAddresses) {
    const indexes = Array.from({ length: Math.min(batchSize, maxAddresses - index) }, (_, offset) => index + offset);
    const addresses = indexes
      .map((item) => deriveBitcoinAddress(dependencies, xpub, format, branch, item))
      .filter((item): item is string => Boolean(item));
    const results = await Promise.all(addresses.map((derivedAddress) => fetchBitcoinAddress(base, derivedAddress)));

    for (const result of results) {
      scanned += 1;
      const satoshis = bitcoinSatoshis(result);
      const hasActivity = satoshis > 0 || bitcoinTxCount(result) > 0;
      totalSatoshis += satoshis;
      if (hasActivity) {
        used += 1;
        consecutiveEmpty = 0;
      } else {
        consecutiveEmpty += 1;
      }
      if (consecutiveEmpty >= gapLimit) break;
    }
    index += batchSize;
  }

  return { totalSatoshis, scanned, used };
}

async function scanBitcoinXpub(address: string, gapLimit = 20) {
  const base = process.env.BITCOIN_API_URL ?? "https://mempool.space/api";
  const normalizedGapLimit = Math.min(50, Math.max(5, gapLimit));
  const { dependencies, xpub, purpose, format } = await normalizeXpub(address);
  const [receive, change] = await Promise.all([
    scanBitcoinBranch(base, dependencies, xpub, format, 0, normalizedGapLimit),
    scanBitcoinBranch(base, dependencies, xpub, format, 1, normalizedGapLimit),
  ]);
  const scanned = receive.scanned + change.scanned;
  const used = receive.used + change.used;
  const totalSatoshis = receive.totalSatoshis + change.totalSatoshis;
  const warnings = [
    `Bitcoin ${purpose === 84 ? "zpub" : purpose === 49 ? "ypub" : "xpub"} account scanned ${scanned} derived addresses (${used} with activity).`,
    "Do not add single addresses from the same Bitcoin account separately, or the BTC balance may be counted twice.",
  ];
  return { assets: [native("bitcoin", totalSatoshis / 1e8)], warnings };
}

async function solanaRpc(method: string, params: unknown[]) {
  const response = await fetch(process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Solana RPC request failed.");
  return response.json() as Promise<{ result?: unknown; error?: { message?: string } }>;
}

async function scanSolana(address: string) {
  const programs = [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  ];
  const [balanceResult, ...tokenResults] = await Promise.all([
    solanaRpc("getBalance", [address]),
    ...programs.map((programId) => solanaRpc("getTokenAccountsByOwner", [address, { programId }, { encoding: "jsonParsed" }])),
  ]);
  const lamports = Number((balanceResult.result as { value?: number } | undefined)?.value ?? 0);
  const assets = [native("solana", lamports / 1e9)];
  for (const result of tokenResults) {
    const accounts = (result.result as { value?: Array<{ account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmountString?: string } } } } } }> } | undefined)?.value ?? [];
    for (const account of accounts) {
      const info = account.account?.data?.parsed?.info;
      const mint = info?.mint;
      const quantity = Number(info?.tokenAmount?.uiAmountString ?? 0);
      if (!mint || !Number.isFinite(quantity) || quantity <= 0) continue;
      assets.push({ assetId: `solana:${mint}`, symbol: shortId(mint), name: `SPL ${shortId(mint)}`, quantity, priceUsd: null, dayChangePercent: 0, contractAddress: mint });
    }
  }
  return { assets, warnings: [] as string[] };
}

async function koiosPost(path: string, body: object) {
  const response = await fetch(`${process.env.CARDANO_KOIOS_URL ?? "https://api.koios.rest/api/v1"}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Cardano lookup failed.");
  return response.json() as Promise<Array<Record<string, unknown>>>;
}

function cardanoTokens(items: CardanoAsset[]) {
  return items.flatMap<WalletAsset>((item) => {
    const policy = item.policy_id ?? "";
    const assetName = item.asset_name ?? "";
    const quantity = Number(item.quantity ?? 0);
    if (!policy || quantity <= 0) return [];
    const fingerprint = `${policy}${assetName}`;
    return [{ assetId: `cardano:${fingerprint}`, symbol: assetName ? shortId(assetName) : shortId(policy), name: `Cardano native ${shortId(fingerprint)}`, quantity, priceUsd: null, dayChangePercent: 0, contractAddress: fingerprint }];
  });
}

async function scanCardano(address: string) {
  if (address.startsWith("stake1")) {
    const [accountRows, assetRows] = await Promise.all([
      koiosPost("account_info", { _stake_addresses: [address] }),
      koiosPost("account_assets", { _stake_addresses: [address] }),
    ]);
    const account = accountRows[0] ?? {};
    const assets = (assetRows[0]?.asset_list ?? assetRows) as CardanoAsset[];
    return { assets: [native("cardano", Number(account.total_balance ?? 0) / 1e6), ...cardanoTokens(assets)], warnings: [] as string[] };
  }
  const rows = await koiosPost("address_info", { _addresses: [address] });
  const account = rows[0] ?? {};
  const tokenList = (account.asset_list ?? []) as CardanoAsset[];
  return {
    assets: [native("cardano", Number(account.balance ?? 0) / 1e6), ...cardanoTokens(tokenList)],
    warnings: ["For Cardano, a stake1... address usually gives a more complete wallet view than one addr1... address."],
  };
}

export async function scanWalletAddress({
  address,
  addressKind,
  chain,
  gapLimit,
}: {
  address: string;
  addressKind: WalletAddressKind;
  chain: WalletChain;
  gapLimit?: number;
}): Promise<WalletScanResponse> {
  const result = isEvmChain(chain)
    ? await scanEvm(chain, address)
    : chain === "bitcoin"
      ? addressKind === "xpub"
        ? await scanBitcoinXpub(address, gapLimit)
        : await scanBitcoinAddress(address)
      : chain === "solana"
        ? await scanSolana(address)
        : await scanCardano(address);

  return { chain, address, ...result, refreshedAt: new Date().toISOString() };
}
