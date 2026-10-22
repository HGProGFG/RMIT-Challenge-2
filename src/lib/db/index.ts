import { DatabaseSync } from "node:sqlite";
import { closeSync, mkdirSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AppError } from "../server/errors";

let connection: DatabaseSync | undefined;
let lock: { fd: number; path: string } | undefined;
let exitRegistered = false;
export const SCHEMA_VERSION = 2;
export function databasePath() { return resolve(process.env.DATABASE_PATH ?? "data/vault.sqlite"); }
/** One process owns the demo DB. CLI mutation and a running API cannot share it. */
export function openDb() {
  if (!connection) {
    const file = databasePath();
    mkdirSync(dirname(file), { recursive: true });
    try {
      const path = `${file}.lock`, fd = openSync(path, "wx", 0o600);
      lock = { fd, path };
      writeFileSync(fd, JSON.stringify({ pid: process.pid }));
      if (!exitRegistered) { process.once("exit", closeDb); exitRegistered = true; }
      connection = new DatabaseSync(file);
      connection.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    } catch (error) {
      closeDb();
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new AppError(503, "DATABASE_IN_USE", "Stop the application and other database commands before offline maintenance.", true);
      throw error;
    }
  }
  return connection;
}
export function db() {
  const instance = openDb();
  try {
    const row = instance.prepare("SELECT max(version) AS version FROM SchemaMigration").get() as { version: number };
    if (row.version !== SCHEMA_VERSION) throw Error();
    return instance;
  } catch { throw new AppError(503, "MIGRATIONS_REQUIRED", "Stop the application and run npm run db:migrate."); }
}
export function transaction<T>(fn: () => T): T {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try { const result = fn(); connection.exec("COMMIT"); return result; }
  catch (error) { connection.exec("ROLLBACK"); throw error; }
}
export function closeDb() {
  connection?.close(); connection = undefined;
  if (lock) {
    const owned = lock; lock = undefined;
    closeSync(owned.fd); unlinkSync(owned.path);
  }
}
export function purgeExpiredJti(now = Date.now()) {
  return Number(db().prepare("DELETE FROM DpopReplay WHERE expiresAt < ?").run(now).changes);
}
export function claimProof(thumbprint: string, jti: string, expiresAt: number) {
  return transaction(() => {
    purgeExpiredJti();
    return db().prepare("INSERT INTO DpopReplay VALUES(?,?,?) ON CONFLICT DO NOTHING")
      .run(thumbprint, jti, expiresAt).changes === 1;
  });
}
export function claimRate(bucket: string, limit: number) {
  return transaction(() => {
    const window = Math.floor(Date.now() / 60000);
    db().prepare("DELETE FROM RateLimit WHERE window < ?").run(window - 1);
    const row = db().prepare("INSERT INTO RateLimit VALUES(?,?,1) ON CONFLICT(bucket,window) DO UPDATE SET count=count+1 RETURNING count")
      .get(bucket, window) as { count: number };
    return row.count <= limit;
  });
}
