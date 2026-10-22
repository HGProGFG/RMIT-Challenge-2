import { closeDb } from "../src/lib/db/index";
import { migrate } from "../src/lib/db/migrate";
import { loadLocalEnvironment } from "./environment";
loadLocalEnvironment();
try { console.log(`SQLite schema version ${migrate()} applied. No protected authority was created.`); }
catch { console.error("Migration failed. Stop the application, check database lock and migration history."); process.exitCode = 1; }
finally { closeDb(); }
