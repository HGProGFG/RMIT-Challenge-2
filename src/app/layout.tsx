import type { ReactNode } from "react";

export const metadata = { title: "Sealed Exam Vault", description: "Encrypted exam storage with manual governance release." };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body style={{ fontFamily: "system-ui", margin: 32 }}>{children}</body></html>;
}
