"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Role, SessionResponse } from "../lib/contracts";
import { advanceClientSession, api, ClientApiError, safeError } from "../lib/client/api";
import { getBrowserTide, subscribeBrowserTide } from "../lib/tide/browser/adapter";
import { hasVerifiedRole } from "../lib/roles";

type Context = { session: SessionResponse | null; loading: boolean; error: string; notice: string; preview: boolean; simulation: boolean;
  login: (role?: Role, participant?: string) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void>; notify: (message: string) => void; };
const SessionContext = createContext<Context | null>(null);
export function VaultSessionProvider({ children, simulation = false }: { children: ReactNode; simulation?: boolean }) {
  const [session, setSession] = useState<SessionResponse | null>(null), [loading, setLoading] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const path = usePathname(), epoch = useRef(0);
  function clearSensitiveState() { window.dispatchEvent(new Event("vault:clear-plaintext")); }
  async function refresh(roleHint?: Role) {
    const current = ++epoch.current;
    if (!getBrowserTide().connected) { setSession(null); setLoading(false); clearSensitiveState(); return; }
    setLoading(true);
    try {
      const value = await api<SessionResponse>("/api/session");
      if (current === epoch.current) {
        setSession(value);
        setError(roleHint && !hasVerifiedRole(value.identity, roleHint)
          ? `This session belongs to ${value.identity.alias}. Sign out to use the selected responsibility.` : "");
      }
    }
    catch (e) { if (current === epoch.current) { setSession(null); clearSensitiveState(); setError(simulation && e instanceof ClientApiError && e.status === 401 ? "" : safeError(e)); } }
    finally { if (current === epoch.current) setLoading(false); }
  }
  useEffect(() => {
    const invalidate = () => { ++epoch.current; setSession(null); setLoading(false); clearSensitiveState(); setError(simulation ? "" : "Your session expired or could not be verified. Sign in again."); };
    window.addEventListener("vault:session-invalidated", invalidate);
    const unsubscribe = subscribeBrowserTide(() => { advanceClientSession(); ++epoch.current; setSession(null); clearSensitiveState(); void refresh(); });
    void refresh();
    return () => { ++epoch.current; unsubscribe(); window.removeEventListener("vault:session-invalidated", invalidate); };
  }, []);
  useEffect(() => { setNotice(""); }, [path]);
  async function login(role?: Role, participant?: string) {
    setError("");
    if (!getBrowserTide().connected) { setError("The Plan C demo is loading. Please try again."); return; }
    advanceClientSession();
    const current = ++epoch.current; setLoading(true);
    try { await getBrowserTide().login(role, participant); if (current === epoch.current) await refresh(role); }
    catch { if (current === epoch.current) { setSession(null); clearSensitiveState(); setError("Could not select the demo account. Reload the page and try again."); } }
    finally { if (current === epoch.current) setLoading(false); }
  }
  async function logout() {
    advanceClientSession();
    ++epoch.current; setSession(null); setError(""); setLoading(false); clearSensitiveState();
    try { await getBrowserTide().logout(); }
    catch { setError("Could not finish leaving the demo account. Reload the page and select it again."); }
  }
  return <SessionContext.Provider value={{ session, loading, error, notice, simulation, preview: !session, login, logout, refresh: () => refresh(), notify: setNotice }}>
    {children}
  </SessionContext.Provider>;
}
export function useVaultSession() { const context = useContext(SessionContext); if (!context) throw new Error("Session provider required"); return context; }
