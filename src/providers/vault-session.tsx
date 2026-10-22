"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Role, SessionResponse } from "../lib/contracts";
import { api, safeError } from "../lib/client/api";
import { getBrowserTide, subscribeBrowserTide } from "../lib/tide/browser/adapter";

type Context = { session: SessionResponse | null; loading: boolean; error: string; notice: string; preview: boolean;
  login: (role?: Role) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void>; notify: (message: string) => void; };
const SessionContext = createContext<Context | null>(null);
export function VaultSessionProvider({ children }: { children: ReactNode }) {
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
        setError(roleHint && !value.identity.realmRoles.includes(roleHint)
          ? `This session belongs to ${value.identity.alias}. Sign out to use the selected responsibility.` : "");
      }
    }
    catch (e) { if (current === epoch.current) { setSession(null); clearSensitiveState(); setError(safeError(e)); } }
    finally { if (current === epoch.current) setLoading(false); }
  }
  useEffect(() => {
    const invalidate = () => { ++epoch.current; setSession(null); setLoading(false); clearSensitiveState(); setError("Your session expired or could not be verified. Sign in again."); };
    window.addEventListener("vault:session-invalidated", invalidate);
    const unsubscribe = subscribeBrowserTide(() => { ++epoch.current; setSession(null); clearSensitiveState(); void refresh(); });
    void refresh();
    return () => { ++epoch.current; unsubscribe(); window.removeEventListener("vault:session-invalidated", invalidate); };
  }, []);
  useEffect(() => { setNotice(""); }, [path]);
  async function login(role?: Role) {
    setError("");
    if (!getBrowserTide().connected) { setError("Tide sign-in is not connected yet. Choosing a demo identity does not create a session or grant a role."); return; }
    const current = ++epoch.current; setLoading(true);
    try { await getBrowserTide().login(role); if (current === epoch.current) await refresh(role); }
    catch { if (current === epoch.current) { setSession(null); clearSensitiveState(); setError("Sign-in could not be verified. Please try again with the correct Tide account."); } }
    finally { if (current === epoch.current) setLoading(false); }
  }
  async function logout() {
    ++epoch.current; setSession(null); setError(""); setLoading(false); clearSensitiveState();
    try { await getBrowserTide().logout(); }
    catch { setError("The local session was cleared. Complete sign-out in Tide before changing accounts."); }
  }
  return <SessionContext.Provider value={{ session, loading, error, notice, preview: !session, login, logout, refresh: () => refresh(), notify: setNotice }}>
    {children}
  </SessionContext.Provider>;
}
export function useVaultSession() { const context = useContext(SessionContext); if (!context) throw new Error("Session provider required"); return context; }
