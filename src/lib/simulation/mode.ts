/** Plan C is the application's only runtime. Keep this synthetic demo on loopback. */
export function simulationEnabled() {
  try {
    const url = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000");
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
