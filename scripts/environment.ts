/** Explicit shell environment wins. Load Next-style local configuration for CLI commands. */
export function loadLocalEnvironment() {
  for (const path of [".env.local", ".env"]) {
    try { process.loadEnvFile(path); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
}
