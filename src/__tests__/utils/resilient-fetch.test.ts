import { createResilientFetch } from '../../utils/resilient-fetch.js';

// A minimal HTML page whose inline runtime matches the library's ondemand regex.
const GOOD_HOMEPAGE = `<!doctype html><html><head><script>
!function(){var e;return(({814:"ondemand.s"})[e]||e)+"."+({814:"abc123def"})[e]+"a.js"}();
</script></head><body>ok</body></html>`;

// A stripped variant that lacks the ondemand webpack runtime.
const BAD_HOMEPAGE = `<!doctype html><html><head><title>X</title></head><body></body></html>`;

// A migration interstitial we must not retry.
const MIGRATION_HOMEPAGE = `<!doctype html><html><head>
<meta http-equiv="refresh" content="0; url=https://x.com/x/migrate?tok=abc123DEF_-%20"></head></html>`;

const noSleep = () => Promise.resolve();

function mockFetch(bodies: string[], status = 200): jest.Mock {
  let i = 0;
  return jest.fn(async () => {
    const body = bodies[Math.min(i, bodies.length - 1)];
    i++;
    return new Response(body, { status });
  });
}

describe('createResilientFetch', () => {
  test('returns immediately when the first homepage is usable', async () => {
    const base = mockFetch([GOOD_HOMEPAGE]);
    const f = createResilientFetch(base, { sleep: noSleep });
    const res = await f('https://x.com');
    expect(await res.text()).toContain('ondemand.s');
    expect(base).toHaveBeenCalledTimes(1);
  });

  test('retries a stripped homepage until a good one arrives', async () => {
    const base = mockFetch([BAD_HOMEPAGE, BAD_HOMEPAGE, GOOD_HOMEPAGE]);
    const f = createResilientFetch(base, { sleep: noSleep });
    const res = await f('https://x.com');
    expect(await res.text()).toContain('ondemand.s');
    expect(base).toHaveBeenCalledTimes(3);
  });

  test('gives up after maxHomepageAttempts and returns the last response', async () => {
    const base = mockFetch([BAD_HOMEPAGE]);
    const f = createResilientFetch(base, { sleep: noSleep, maxHomepageAttempts: 3 });
    const res = await f('https://x.com');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(BAD_HOMEPAGE);
    expect(base).toHaveBeenCalledTimes(3);
  });

  test('does not retry a migration interstitial', async () => {
    const base = mockFetch([MIGRATION_HOMEPAGE, GOOD_HOMEPAGE]);
    const f = createResilientFetch(base, { sleep: noSleep });
    const res = await f('https://x.com');
    expect(await res.text()).toContain('migrate?tok=');
    expect(base).toHaveBeenCalledTimes(1);
  });

  test('passes non-homepage requests straight through', async () => {
    const base = mockFetch([BAD_HOMEPAGE]);
    const f = createResilientFetch(base, { sleep: noSleep });
    await f('https://api.x.com/graphql/abc/Followers?variables=%7B%7D');
    expect(base).toHaveBeenCalledTimes(1);
  });

  test('does not retry non-GET requests to the homepage', async () => {
    const base = mockFetch([BAD_HOMEPAGE]);
    const f = createResilientFetch(base, { sleep: noSleep });
    await f('https://x.com', { method: 'POST' });
    expect(base).toHaveBeenCalledTimes(1);
  });

  test('treats twitter.com and www prefixes as the homepage too', async () => {
    const base = mockFetch([BAD_HOMEPAGE, GOOD_HOMEPAGE]);
    const f = createResilientFetch(base, { sleep: noSleep });
    await f('https://www.twitter.com/');
    expect(base).toHaveBeenCalledTimes(2);
  });

  test('does not treat sub-paths as the homepage', async () => {
    const base = mockFetch([BAD_HOMEPAGE]);
    const f = createResilientFetch(base, { sleep: noSleep });
    await f('https://x.com/AppsFlyer');
    expect(base).toHaveBeenCalledTimes(1);
  });

  test('returns a non-OK homepage response without retrying', async () => {
    const base = mockFetch([BAD_HOMEPAGE], 503);
    const f = createResilientFetch(base, { sleep: noSleep });
    const res = await f('https://x.com');
    expect(res.status).toBe(503);
    expect(base).toHaveBeenCalledTimes(1);
  });
});
