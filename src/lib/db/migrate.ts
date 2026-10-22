import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDb, SCHEMA_VERSION } from "./index";

const migrations = ["001-initial.sql", "002-active-run.sql"];
/** CLI/offline only. API requests never apply migrations. */
export function migrate() {
  const connection = openDb();
  connection.exec("BEGIN IMMEDIATE");
  try {
    connection.exec("CREATE TABLE IF NOT EXISTS SchemaMigration(version INTEGER PRIMARY KEY, appliedAt TEXT NOT NULL)");
    const applied = connection.prepare("SELECT version FROM SchemaMigration ORDER BY version").all() as { version: number }[];
    if (applied.some((row, index) => row.version !== index + 1) || applied.length > SCHEMA_VERSION) throw Error("Unsupported migration history");
    for (let index = applied.length; index < migrations.length; index++) {
      connection.exec(readFileSync(resolve("src/lib/db/migrations", migrations[index]), "utf8"));
      connection.prepare("INSERT INTO SchemaMigration VALUES(?,?)").run(index + 1, new Date().toISOString());
    }
    connection.exec("COMMIT");
    return SCHEMA_VERSION;
  } catch (error) { connection.exec("ROLLBACK"); throw error; }
}
