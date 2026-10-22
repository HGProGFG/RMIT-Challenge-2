"use client";
import { useEffect, type ReactNode } from "react";
import { configureBrowserTide, disconnectBrowserTide } from "../lib/tide/browser/adapter";
import { createSimulationAdapter } from "../lib/simulation/browser";

/** Plan C has no live Tide provider, realm export, license or account callback. */
export function SimulationProvider({ children }: { children: ReactNode }) {
  useEffect(() => { configureBrowserTide(createSimulationAdapter()); return disconnectBrowserTide; }, []);
  return children;
}
