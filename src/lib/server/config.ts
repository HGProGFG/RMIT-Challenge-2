import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { AppError } from "./errors";

const publicKey = z.object({ kty: z.literal("OKP"), crv: z.literal("Ed25519"), x: z.string().min(1),
  kid: z.string().optional(), alg: z.literal("EdDSA").optional(), use: z.literal("sig").optional()
}).passthrough().refine(k => !("d" in k), "Public keys only");
const adapterSchema = z.object({ realm: z.string().min(1), resource: z.string().min(1),
  "auth-server-url": z.url(), jwk: z.object({ keys: z.array(publicKey).min(1) }) });
export function appOrigin() {
  try {
    const u = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000");
    if (u.pathname !== "/" || u.username || u.password || u.search || u.hash ||
        (u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname)))) throw Error();
    return u.origin;
  } catch { throw new AppError(503, "CONFIG_UNAVAILABLE", "APP_ORIGIN must be a canonical HTTPS origin or local HTTP origin."); }
}
export function tideConfig() {
  try {
    const adapter = adapterSchema.parse(JSON.parse(readFileSync(resolve(process.env.TIDECLOAK_ADAPTER_PATH ?? "data/tidecloak.json"), "utf8")));
    return { adapter, issuer: `${adapter["auth-server-url"].replace(/\/+$/, "")}/realms/${encodeURIComponent(adapter.realm)}` };
  } catch { throw new AppError(503, "AUTH_NOT_READY", "A pinned public Tide adapter with embedded Ed25519 keys is required.", true); }
}
export function ciphertextLimit(): number {
  const n = Number(process.env.MAX_CIPHERTEXT_BYTES);
  if (!Number.isSafeInteger(n) || n < 16384 || n > 1024 * 1024) {
    throw new AppError(503, "ENVELOPE_LIMIT_NOT_READY", "Dinh must confirm MAX_CIPHERTEXT_BYTES for the chosen envelope.");
  }
  return n;
}
