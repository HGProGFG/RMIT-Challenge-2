import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
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
