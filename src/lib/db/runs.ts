import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { DemoRun, VersionManifest } from "../contracts";
import { AppError } from "../server/errors";
import { db, transaction } from "./index";

export type CreateRunInput = { realmId: string; clientId: string; issuer: string; manifest: VersionManifest };
export function getActiveRun(): DemoRun | null {
  return (db().prepare("SELECT * FROM DemoRun WHERE active=1").get() as unknown as DemoRun | undefined) ?? null;
}
export function requireActiveRun(issuer?: string) {
  const run = getActiveRun();
  if (!run) throw new AppError(503, "RUN_NOT_READY", "Create a synthetic demo run with the offline CLI first.");
  if (issuer && run.issuer !== issuer) throw new AppError(403, "RUN_ISSUER_MISMATCH", "The active run belongs to a different issuer.");
  return run;
}
export function insertDemoRun(input: CreateRunInput): DemoRun {
  z.object({ realmId: z.string().min(1).max(256), clientId: z.string().min(1).max(256), issuer: z.url() }).parse(input);
  const id = randomUUID();
  db().prepare("INSERT INTO DemoRun(id,mode,createdAt,versionManifest,pinnedKeyFingerprint,active,realmId,clientId,issuer) VALUES(?,'LIVE_MANUAL_RELEASE',?,?,?,1,?,?,?)")
    .run(id, new Date().toISOString(), JSON.stringify(input.manifest), input.manifest.pinnedKeyFingerprint, input.realmId, input.clientId, input.issuer);
  return requireActiveRun();
}
/** Used only by offline CLI/tests; creating another run requires explicit reset of the active one. */
export function createDemoRun(input: CreateRunInput) {
  return transaction(() => {
    if (getActiveRun()) throw new AppError(409, "ACTIVE_RUN_EXISTS", "An active run already exists. Reset it explicitly offline.");
    return insertDemoRun(input);
  });
}
