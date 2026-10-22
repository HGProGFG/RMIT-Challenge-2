"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TideCloakProvider, useTideCloak } from "@tidecloak/nextjs";
import type { PublicTideConfig } from "../lib/server/config";
import { configureBrowserTide, disconnectBrowserTide } from "../lib/tide/browser/adapter";
import { createSdkAdapter } from "../lib/tide/browser/sdk-adapter";
import { createSimulationAdapter } from "../lib/simulation/browser";

function Bridge({ config, children }: { config: PublicTideConfig; children: ReactNode }) {
  const tide = useTideCloak();
  useEffect(() => {
    if (tide.isInitializing || tide.initError) { disconnectBrowserTide(); return; }
    configureBrowserTide(createSdkAdapter(config));
    return disconnectBrowserTide;
    // Token changes also invalidate any old decrypted UI state and reverify /api/session.
  }, [config, tide.isInitializing, tide.initError, tide.authenticated, tide.token]);
  return children;
}
export function TideProvider({ config, simulation = false, children }: { config: PublicTideConfig | null; simulation?: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return disconnectBrowserTide; }, []);
  useEffect(() => { if (simulation) { configureBrowserTide(createSimulationAdapter()); return disconnectBrowserTide; } }, [simulation]);
  const sdkConfig = useMemo(() => config ? { ...config, useDPoP: { mode: "strict", alg: "ES256" } } : null, [config]);
  if (simulation || !mounted || !sdkConfig || !config) return children;
  return <TideCloakProvider config={sdkConfig}><Bridge config={config}>{children}</Bridge></TideCloakProvider>;
}
