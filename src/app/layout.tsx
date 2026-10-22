import type { ReactNode } from "react";
import { VaultSessionProvider } from "../providers/vault-session";
import "./globals.css";
export const metadata = { title: "Sealed — Exam Vault", description: "Đề thi niêm phong. Encrypted exam storage with independently approved access and honest security boundaries." };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><VaultSessionProvider>{children}</VaultSessionProvider></body></html>;
}
