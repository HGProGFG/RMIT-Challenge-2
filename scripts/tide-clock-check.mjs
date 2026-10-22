import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TIME_SOURCES = Object.freeze([
  'https://ork1.tideprotocol.com/active',
  'https://api.github.com/',
]);
const MAX_SKEW_MS = 30_000;
const MAX_SAMPLE_MS = 5_000;

/**
 * @typedef {{fetchImpl?: typeof fetch, now?: () => number,
 *   monotonic?: () => number, readDockerTime?: () => string}} ClockDependencies
 */

/** Read response metadata only; never log response bodies or exception contents.
 * @param {string} url
 * @param {ClockDependencies} [dependencies]
 */
export async function sampleClock(url, {
  fetchImpl = fetch, now = Date.now, monotonic = () => performance.now(),
} = {}) {
  const start = now();
  const tick = monotonic();
  const response = await fetchImpl(url, {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8_000),
  });
  const elapsed = monotonic() - tick;
  const remote = Date.parse(response.headers.get('date') ?? '');
  const age = response.headers.get('age');
  await response.body?.cancel();
  if (!response.ok || response.redirected || !Number.isFinite(remote)
      || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > MAX_SAMPLE_MS
      || (age !== null && (!Number.isFinite(Number(age)) || Number(age) !== 0))
      || Math.abs(now() - start - elapsed) > 1_000) {
    throw new Error('NO_USABLE_CLOCK_SAMPLE');
  }
  return { source: new URL(url).hostname, offsetMs: remote - start - elapsed / 2 };
}

/** Read-only preflight. PASS concerns clocks, not vendor activation or ORK quorum.
 * Exit 0 = verified clocks, 1 = measured skew, 2 = verification unavailable.
 * @param {string} [docker]
 * @param {ClockDependencies} [dependencies]
 */
export async function checkClocks(docker = 'docker', dependencies = {}) {
  const now = dependencies.now ?? Date.now;
  const monotonic = dependencies.monotonic ?? (() => performance.now());
  const started = now();
  const tick = monotonic();
  const results = await Promise.allSettled(TIME_SOURCES.map(url => sampleClock(url, dependencies)));
  const valid = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  const common = { scope: 'clock-preflight-only', maxSkewMs: MAX_SKEW_MS,
    sources: valid.map(sample => sample.source) };
  /** @param {string} reason */
  const unknown = reason => ({ ...common, status: 'UNKNOWN', clockVerified: false, exitCode: 2, reason });
  if (valid.length !== TIME_SOURCES.length) return unknown('TIME_SOURCES_UNAVAILABLE');
  if (Math.abs(valid[0].offsetMs - valid[1].offsetMs) > 5_000) return unknown('TIME_SOURCES_DISAGREE');
  const hostOffsetMs = valid.reduce((sum, sample) => sum + sample.offsetMs, 0) / valid.length;
  const before = now();
  const dockerTick = monotonic();
  let dockerTime;
  try {
    dockerTime = dependencies.readDockerTime ? dependencies.readDockerTime() : execFileSync(docker,
      ['info', '--format', '{{.SystemTime}}'], {
        encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
  } catch {
    // A child-process exception can include arbitrary stdout/stderr. Do not print it.
    return unknown('DOCKER_TIME_UNAVAILABLE');
  }
  const after = now();
  const elapsed = monotonic() - dockerTick;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > MAX_SAMPLE_MS) return unknown('DOCKER_SAMPLE_TOO_SLOW');
  if (Math.abs(after - started - (monotonic() - tick)) > 1_000) return unknown('CLOCK_CHANGED_DURING_CHECK');
  const dockerToHostMs = Date.parse(dockerTime) - (before + after) / 2;
  if (!Number.isFinite(dockerToHostMs)) return unknown('DOCKER_TIME_UNAVAILABLE');
  const dockerOffsetMs = hostOffsetMs - dockerToHostMs;
  const clockVerified = Math.abs(hostOffsetMs) <= MAX_SKEW_MS && Math.abs(dockerOffsetMs) <= MAX_SKEW_MS;
  return { ...common, status: clockVerified ? 'PASS' : 'FAIL', clockVerified,
    exitCode: clockVerified ? 0 : 1, reason: clockVerified ? 'CLOCKS_ALIGNED' : 'CLOCK_SKEW',
    hostOffsetMs: Math.round(hostOffsetMs), dockerOffsetMs: Math.round(dockerOffsetMs) };
}

// Importing the module for regression tests never contacts a network or runs Docker.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkClocks(process.argv[2] ?? 'docker');
  console.log(JSON.stringify(result));
  if (result.status === 'FAIL') {
    console.error('Measured clock skew exceeds the limit. Synchronize Windows and Docker time, then rerun. No clocks were changed.');
  } else if (result.status === 'UNKNOWN') {
    console.error('Clock verification unavailable. Check HTTPS connectivity and Docker, then rerun. This is not a verified clock or a Tide activation result.');
  }
  process.exitCode = result.exitCode;
}
