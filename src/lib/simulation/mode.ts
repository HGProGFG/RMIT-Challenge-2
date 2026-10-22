/** Explicit server-selected demonstration mode. No real Tide keys or credentials are used. */
export function simulationEnabled() {
  if (process.env.TIDE_SIMULATION !== "true") return false;
  try {
    const url = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000");
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
