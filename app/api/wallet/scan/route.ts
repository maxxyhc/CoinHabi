import { NextResponse } from "next/server";
import { scanWalletAddress, validateWalletAddress } from "@/lib/wallet/scan";
import type { WalletAddressKind, WalletChain } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    address?: string;
    addressKind?: WalletAddressKind;
    chain?: WalletChain;
    gapLimit?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const chain = body.chain;
  const address = body.address?.trim();
  const addressKind = body.addressKind ?? (chain === "bitcoin" && address && /^(xpub|ypub|zpub)/i.test(address) ? "xpub" : "address");

  if (!chain || !address || !validateWalletAddress(chain, address, addressKind)) {
    return NextResponse.json({ error: "Invalid public address for the selected blockchain." }, { status: 400 });
  }

  try {
    const response = await scanWalletAddress({
      address,
      addressKind,
      chain,
      gapLimit: body.gapLimit,
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet sync failed." }, { status: 502 });
  }
}
