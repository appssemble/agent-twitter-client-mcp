/**
 * X's transaction-id generation depends on scraping an inline webpack runtime
 * from the x.com homepage to locate the "ondemand" chunk hash. From datacenter
 * IPs X intermittently serves a stripped homepage variant that omits that
 * runtime, so the scrape throws `ONDEMAND_FILE_URL_RESOLUTION_ERROR` and every
 * followers/profile call fails. Worse, the scraper caches the homepage document
 * for five minutes and only invalidates the cache when the *fetch* fails - not
 * when the fetch succeeds but returns an unusable page - so a single bad
 * response poisons every call for the full TTL.
 *
 * This wraps the fetch the scraper uses so that, for the homepage request only,
 * we validate the response actually contains the ondemand runtime and retry a
 * few times when it does not. Because we only ever hand back a *good* homepage,
 * the scraper caches a good document and the five-minute outage windows go away.
 * When X returns a legitimate migration interstitial we pass it straight
 * through - migration is the scraper's job, not a failure to retry.
 */

// The exact patterns the library uses, kept in sync with
// x-client-transaction-id (ondemand) and @the-convocation/twitter-scraper
// (migration). If the ondemand pattern matches, the library's own resolver
// will succeed on the same HTML.
const ON_DEMAND_FILE_HASH_REGEX =
  /(\d+):\s*["']ondemand\.s["'][\s\S]*?\}\)\[e\]\s*\|\|\s*e\)\s*\+\s*["']\.["']\s*\+\s*\(\{[\s\S]*?\b\1:\s*["']([a-zA-Z0-9_-]+)["']/s;
const MIGRATION_REDIRECTION_REGEX =
  /(http(?:s)?:\/\/(?:www\.)?(twitter|x){1}\.com(\/x)?\/migrate([/?])?tok=[a-zA-Z0-9%\-_]+)+/i;

export interface ResilientFetchOptions {
  maxHomepageAttempts?: number;
  /** Base backoff in ms; attempt N waits baseBackoffMs * 2^(N-1). */
  baseBackoffMs?: number;
  /** Injectable sleep, for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

function requestMethod(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1]
): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request && input.method) return input.method.toUpperCase();
  return 'GET';
}

function isHomepageRequest(url: string, method: string): boolean {
  if (method !== 'GET') return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.replace(/^www\./, '');
  if (host !== 'x.com' && host !== 'twitter.com') return false;
  return parsed.pathname === '/' || parsed.pathname === '';
}

/** A homepage is usable if the library will be able to resolve the ondemand
 *  chunk from it, or if it is a migration interstitial we should not retry. */
function isUsableHomepage(html: string): boolean {
  return (
    MIGRATION_REDIRECTION_REGEX.test(html) ||
    ON_DEMAND_FILE_HASH_REGEX.test(html)
  );
}

/**
 * Wraps a base fetch, adding validate-and-retry behaviour to the x.com homepage
 * request that transaction-id generation relies on. All other requests pass
 * through untouched.
 */
export function createResilientFetch(
  baseFetch: typeof fetch = fetch,
  options: ResilientFetchOptions = {}
): typeof fetch {
  const maxAttempts = options.maxHomepageAttempts ?? 4;
  const baseBackoff = options.baseBackoffMs ?? 300;
  const sleep = options.sleep ?? defaultSleep;

  const resilientFetch = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    if (!isHomepageRequest(requestUrl(input), requestMethod(input, init))) {
      return baseFetch(input, init);
    }

    let lastResponse: Response | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await baseFetch(input, init);

      // Preserve non-OK responses as-is; the caller expects to see them.
      if (!res.ok) return res;

      // Reading the body consumes it, so hand back a fresh, still-readable
      // Response carrying the same status and headers.
      const html = await res.text();
      const replay = new Response(html, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers
      });

      if (isUsableHomepage(html)) return replay;

      lastResponse = replay;
      if (attempt < maxAttempts) {
        await sleep(baseBackoff * 2 ** (attempt - 1));
      }
    }

    // Every attempt returned an unusable homepage. Give the last one back so
    // behaviour degrades to the pre-fix path (the scraper will throw its own
    // ondemand error) rather than hanging or masking the failure.
    return lastResponse as Response;
  };

  return resilientFetch as typeof fetch;
}
