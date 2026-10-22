import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

let connection: DatabaseSync | undefined;
export function db() {
  if (!connection) {
    const file = resolve(process.env.DATABASE_PATH ?? "data/vault.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    const instance = new DatabaseSync(file);
    instance.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    instance.exec("CREATE TABLE IF NOT EXISTS SchemaMigration(version INTEGER PRIMARY KEY, appliedAt TEXT NOT NULL)");
    instance.exec("BEGIN IMMEDIATE");
    try {
      if (!instance.prepare("SELECT version FROM SchemaMigration WHERE version=1").get()) {
        instance.exec(readFileSync(resolve("src/lib/db/migrations/001-initial.sql"), "utf8"));
        instance.prepare("INSERT INTO SchemaMigration VALUES(1,?)").run(new Date().toISOString());
      }
      instance.exec("COMMIT");
    } catch (error) { instance.exec("ROLLBACK"); instance.close(); throw error; }
    connection = instance;
  }
  return connection;
}
export function transaction<T>(fn: () => T): T {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try { const result = fn(); connection.exec("COMMIT"); return result; }
  catch (error) { connection.exec("ROLLBACK"); throw error; }
}
export function closeDb() { connection?.close(); connection = undefined; }
export function claimProof(thumbprint: string, jti: string, expiresAt: number) {
  return transaction(() => {
    db().prepare("DELETE FROM DpopReplay WHERE expiresAt < ?").run(Date.now());
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
