import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // x402-chainlink contains Node.js-only CRE CLI code (child_process, fs, path).
  // Mark it as external for server-side rendering so Next.js doesn't try to
  // bundle it for the browser. Client components import from lib/payment-client.ts
  // (browser-safe) instead.
  serverExternalPackages: ["x402-chainlink"],
};

export default nextConfig;
