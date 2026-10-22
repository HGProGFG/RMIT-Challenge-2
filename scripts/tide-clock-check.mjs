import { execFileSync } from 'node:child_process';

// Read-only preflight: signed Tide requests depend on both host and Docker time.
const docker = process.argv[2] ?? 'docker';
const maxSkewMs = 30_000;
const samples = await Promise.allSettled([
  'https://ork1.tideprotocol.com/active',
  'https://api.github.com/',
].map(async url => {
  const start = Date.now();
  const tick = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  const elapsed = performance.now() - tick;
  const remote = Date.parse(response.headers.get('date') ?? '');
  await response.body?.cancel();
  if (!Number.isFinite(remote) || Math.abs(Date.now() - start - elapsed) > 1_000) {
    throw new Error('No usable clock sample');
  }
  return { source: new URL(url).hostname, offsetMs: remote - start - elapsed / 2 };
}));
const valid = samples.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
if (valid.length < 2 || Math.abs(valid[0].offsetMs - valid[1].offsetMs) > 5_000) {
  console.warn('Clock verification unavailable: independent HTTPS time sources did not agree. Verify Windows and Docker time before Tide activation.');
  process.exitCode = 0; // Offline infrastructure can still start; this is not a verified clock.
} else {
  const hostOffsetMs = valid.reduce((sum, sample) => sum + sample.offsetMs, 0) / valid.length;
  const before = Date.now();
  const dockerTime = execFileSync(docker, ['info', '--format', '{{.SystemTime}}'], {
    encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const dockerToHostMs = Date.parse(dockerTime) - (before + Date.now()) / 2;
  if (!Number.isFinite(dockerToHostMs)) throw new Error('Docker engine time is unavailable.');
  const dockerOffsetMs = hostOffsetMs - dockerToHostMs;
  const clockVerified = Math.abs(hostOffsetMs) <= maxSkewMs && Math.abs(dockerOffsetMs) <= maxSkewMs;
  console.log(JSON.stringify({ clockVerified, hostOffsetMs: Math.round(hostOffsetMs),
    dockerOffsetMs: Math.round(dockerOffsetMs), maxSkewMs, sources: valid.map(sample => sample.source) }));
  if (!clockVerified) {
    console.error('Synchronize Windows Date & time, then verify Docker time. Large clock skew can reject Tide signed requests. This check changes no clocks.');
    process.exitCode = 1;
  }
}
