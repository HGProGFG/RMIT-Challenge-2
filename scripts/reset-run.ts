import { z } from "zod";
import { closeDb } from "../src/lib/db";
import { createDemoRun, getActiveRun } from "../src/lib/db/runs";
import { previewRunReset, resetDemoRun } from "../src/lib/db/reset";
import { tideConfig } from "../src/lib/server/config";
import { AppError } from "../src/lib/server/errors";
import { getVersionManifest } from "../src/lib/server/readiness";
import { loadLocalEnvironment } from "./environment";

loadLocalEnvironment();
try {
  const args = process.argv.slice(2);
  const create = args.length === 1 && args[0] === "--create";
  const runIndex = args.indexOf("--run-id"), runId = runIndex >= 0 ? args[runIndex + 1] : undefined;
  const apply = args.includes("--apply");
  if (!create && (!runId || !z.uuid().safeParse(runId).success || runIndex !== 0 ||
      args.length !== (apply ? 3 : 2) || (apply && args[2] !== "--apply"))) {
    throw new AppError(422, "INVALID_ARGUMENTS", "Use --create, or --run-id UUID [--apply]. Reset defaults to dry-run.");
  }
  if (create || apply) {
    const { adapter, issuer } = tideConfig();
    const input = { realmId: adapter.realm, clientId: adapter.resource, issuer, manifest: getVersionManifest() };
    const result = create ? { run: createDemoRun(input), remoteAuthorityChanged: false } : resetDemoRun(runId!, input);
    console.log(JSON.stringify(result));
    console.log("Local synthetic data only. Prepare new signed policies; this command does not revoke grants or sign policies.");
  } else {
    console.log(JSON.stringify({ dryRun: true, ...previewRunReset(runId!), activeRun: getActiveRun()?.id }));
  }
} catch (error) {
  console.error(error instanceof AppError ? `${error.code}: ${error.message}` : "Offline run command failed. Check migrations and the database lock.");
  process.exitCode = 1;
} finally { closeDb(); }
