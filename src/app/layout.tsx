import type { ReactNode } from "react";
import { VaultSessionProvider } from "../providers/vault-session";
import { SimulationProvider } from "../providers/simulation-provider";
import "./globals.css";
export const metadata = { title: "Sealed — Exam Vault", description: "Đề thi niêm phong. Encrypted exam storage with independently approved access and honest security boundaries." };
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><SimulationProvider><VaultSessionProvider simulation>{children}</VaultSessionProvider></SimulationProvider></body></html>;
}
