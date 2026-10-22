import type { NextConfig } from "next";
import { resolve } from "node:path";

const config: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR ?? ".next",
  serverExternalPackages: ["node:sqlite"],
  webpack(config) {
    // Required by the published Tide SDK (pack 1.9.33).
    config.module.strictExportPresence = false;
    config.resolve.alias = { ...config.resolve.alias,
      "@tidecloak/react": resolve("node_modules/@tidecloak/react/dist/esm/index.js") };
    return config;
  },
  async rewrites() {
    return [{ source: "/tide_dpop/:path*", destination: "/tide_dpop_auth.html" }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Content-Security-Policy", value: "frame-src 'self' https:; object-src 'none'; base-uri 'self'" }
      ] },
      ...["/tide_dpop/:path*", "/tide_dpop_auth.html"].map(source => ({ source, headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'unsafe-inline'" },
        { key: "Allow-CSP-From", value: "*" },
        { key: "Cache-Control", value: "no-store" }
      ] }))
    ];
  }
};
export default config;
