"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Identity, Readiness, Role } from "../lib/contracts";
import { api, safeError } from "../lib/client/api";
import { getBrowserTide } from "../lib/tide/browser/adapter";

type Session = { identity: Identity; readiness: { authentication: Readiness; policy: Readiness; governance: Readiness } };
type Context = { session: Session | null; loading: boolean; error: string; notice: string; preview: boolean;
  login: (role?: Role) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void>; notify: (message: string) => void; };
const SessionContext = createContext<Context | null>(null);
export function VaultSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null), [loading, setLoading] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const path = usePathname(), epoch = useRef(0);
  async function refresh() {
    const current = ++epoch.current;
    if (!getBrowserTide().connected) { setSession(null); return; }
    setLoading(true);
    try { const value = await api<Session>("/api/session"); if (current === epoch.current) { setSession(value); setError(""); } }
    catch (e) { if (current === epoch.current) { setSession(null); setError(safeError(e)); } }
    finally { if (current === epoch.current) setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { setNotice(""); }, [path]);
  async function login(role?: Role) {
    setError("");
    if (!getBrowserTide().connected) { setError("Tide sign-in is not connected yet. Choosing a demo identity does not create a session or grant a role."); return; }
    setLoading(true);
    try { await getBrowserTide().login(role); await refresh(); }
    catch { setSession(null); setError("Sign-in could not be verified. Please try again with the correct Tide account."); }
    finally { setLoading(false); }
  }
  async function logout() {
    ++epoch.current; setSession(null); setError("");
    window.dispatchEvent(new Event("vault:clear-plaintext"));
    try { await getBrowserTide().logout(); }
    catch { setError("The local session was cleared. Complete sign-out in Tide before changing accounts."); }
  }
  return <SessionContext.Provider value={{ session, loading, error, notice, preview: !session, login, logout, refresh, notify: setNotice }}>
    {children}
  </SessionContext.Provider>;
}
export function useVaultSession() { const context = useContext(SessionContext); if (!context) throw new Error("Session provider required"); return context; }
