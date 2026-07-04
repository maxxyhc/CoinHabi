import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/wallet/scan": ["./node_modules/tiny-secp256k1/lib/secp256k1.wasm"],
  },
  reactStrictMode: true,
  serverExternalPackages: ["tiny-secp256k1"],
};

export default nextConfig;
