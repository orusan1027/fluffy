import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-side API calls only; no browser exposure of tokens.
  experimental: {},
};

export default nextConfig;
