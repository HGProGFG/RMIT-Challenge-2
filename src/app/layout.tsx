import type { ReactNode } from "react";
import { VaultSessionProvider } from "../providers/vault-session";
import { TideProvider } from "../providers/tide-provider";
import { publicTideConfig } from "../lib/server/config";
import "./globals.css";
export const metadata = { title: "Sealed — Exam Vault", description: "Đề thi niêm phong. Encrypted exam storage with independently approved access and honest security boundaries." };
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><TideProvider config={publicTideConfig()}><VaultSessionProvider>{children}</VaultSessionProvider></TideProvider></body></html>;
}
