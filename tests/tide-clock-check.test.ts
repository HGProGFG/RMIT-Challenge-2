import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkClocks, sampleClock } from '../scripts/tide-clock-check.mjs';

// Synthetic HTTP Date responses test the preflight only. No Tide flow is mocked
// or verified here, and these tests never contact an ORK or modify a realm.
const NOW = Date.parse('2026-10-22T08:00:00Z');
const dateResponse = (offset = 0, status = 200, age?: string) => new Response(null, {
  status, headers: { date: new Date(NOW + offset).toUTCString(), ...(age === undefined ? {} : { age }) },
});
const okFetch: typeof fetch = async () => dateResponse();
const base = { fetchImpl: okFetch, now: () => NOW, monotonic: () => 0,
  readDockerTime: () => new Date(NOW).toISOString() };

for (const [name, fetchImpl] of [
  ['all time sources offline', async () => { throw new Error('offline'); }],
  ['one time source unavailable', async (input: string | URL | Request) => {
    if (String(input).includes('api.github.com')) throw new Error('offline');
    return dateResponse();
  }],
  ['HTTP 500 with a plausible Date header', async () => dateResponse(0, 500)],
  ['a missing Date header', async () => new Response(null)],
  ['a cached Date response', async () => dateResponse(0, 200, '120')],
] as const) {
  test(`${name} cannot report successful clock verification`, async () => {
    const result = await checkClocks('unused', { ...base, fetchImpl });
    assert.equal(result.status, 'UNKNOWN');
    assert.equal(result.clockVerified, false);
    assert.equal(result.exitCode, 2);
  });
}

test('disagreeing independent time sources are UNKNOWN, not success', async () => {
  const fetchImpl: typeof fetch = async input => dateResponse(String(input).includes('api.github.com') ? 10_000 : 0);
  const result = await checkClocks('unused', { ...base, fetchImpl });
  assert.equal(result.reason, 'TIME_SOURCES_DISAGREE');
  assert.equal(result.exitCode, 2);
});

test('aligned host and Docker clocks pass the clock check only', async () => {
  const result = await checkClocks('unused', base);
  assert.equal(result.status, 'PASS');
  assert.equal(result.exitCode, 0);
  assert.equal(result.scope, 'clock-preflight-only');
});

test('confirmed host skew fails', async () => {
  const result = await checkClocks('unused', { ...base, fetchImpl: async () => dateResponse(60_000) });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.exitCode, 1);
});

test('confirmed Docker skew fails even when host time is correct', async () => {
  const result = await checkClocks('unused', { ...base, readDockerTime: () => new Date(NOW - 60_000).toISOString() });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.exitCode, 1);
});

test('unparseable Docker time is UNKNOWN', async () => {
  const result = await checkClocks('unused', { ...base, readDockerTime: () => 'not-a-date' });
  assert.equal(result.reason, 'DOCKER_TIME_UNAVAILABLE');
  assert.equal(result.exitCode, 2);
});

test('Docker exceptions cannot disclose stdout, stderr or secrets', async () => {
  const marker = 'secret-output-must-not-escape';
  const result = await checkClocks('unused', { ...base, readDockerTime: () => { throw new Error(marker); } });
  assert.equal(result.exitCode, 2);
  assert.ok(!JSON.stringify(result).includes(marker));
});

test('slow HTTPS samples are rejected', async () => {
  let tick = 0;
  await assert.rejects(sampleClock('https://example.invalid', { ...base,
    monotonic: () => { const previous = tick; tick += 6_000; return previous; },
  }), /NO_USABLE_CLOCK_SAMPLE/);
});

test('wall clock jumps during a time sample are rejected', async () => {
  let calls = 0;
  await assert.rejects(sampleClock('https://example.invalid', { ...base,
    now: () => NOW + (calls++ === 0 ? 0 : 60_000),
  }), /NO_USABLE_CLOCK_SAMPLE/);
});

test('clock changes during Docker inspection are UNKNOWN', async () => {
  let wall = NOW;
  const result = await checkClocks('unused', { ...base, now: () => wall,
    readDockerTime: () => { wall += 60_000; return new Date(wall).toISOString(); },
  });
  assert.equal(result.reason, 'CLOCK_CHANGED_DURING_CHECK');
  assert.equal(result.exitCode, 2);
});

test('zero Age is allowed but malformed or nonzero Age is not', async () => {
  await sampleClock('https://example.invalid', { ...base, fetchImpl: async () => dateResponse(0, 200, '0') });
  for (const age of ['unknown', '-1', '1']) {
    await assert.rejects(sampleClock('https://example.invalid', { ...base,
      fetchImpl: async () => dateResponse(0, 200, age) }), /NO_USABLE_CLOCK_SAMPLE/);
  }
});

test('requests are bounded, uncached, and never follow redirects', async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal instanceof AbortSignal);
    return dateResponse();
  };
  await sampleClock('https://example.invalid', { ...base, fetchImpl });
});


test('CLI returns exit 2, not exit 0, when both time sources are offline', () => {
  const preload = 'data:text/javascript,' + encodeURIComponent(
    'globalThis.fetch = async () => { throw new Error("offline-test"); };');
  const script = fileURLToPath(new URL('../scripts/tide-clock-check.mjs', import.meta.url));
  const result = spawnSync(process.execPath, ['--import', preload, script], {
    encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).reason, 'TIME_SOURCES_UNAVAILABLE');
  assert.ok(!result.stderr.includes('offline-test'));
});
