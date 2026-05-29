import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const analyzerEnabled = process.env.ANALYZE === "true";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  ...(analyzerEnabled ? { distDir: ".next-analyze" } : {}),
};

export default analyzerEnabled
  ? withBundleAnalyzer({
      enabled: true,
      openAnalyzer: false,
    })(nextConfig)
  : nextConfig;
