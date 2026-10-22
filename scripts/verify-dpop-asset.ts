import { getVersionManifest } from "../src/lib/server/readiness";
const manifest = getVersionManifest();
console.log(JSON.stringify({ sha256: manifest.dpopAssetSha256, matches: manifest.dpopAssetMatches }));
if (!manifest.dpopAssetMatches) process.exitCode = 1;
