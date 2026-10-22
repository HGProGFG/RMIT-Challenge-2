import { db, closeDb } from "../src/lib/db/index";
db();
closeDb();
console.log("SQLite migrations applied. No identity, policy or protected authority was created.");
