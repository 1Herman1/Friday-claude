import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  experimental: { serverActions: { bodySizeLimit: "15mb" } }, // скриншоты к сделке
};

export default nextConfig;
