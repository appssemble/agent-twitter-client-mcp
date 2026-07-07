/**
 * X rotates its internal GraphQL query IDs; the ones hardcoded in
 * @the-convocation/twitter-scraper go stale and X answers 404 for them
 * (Followers broke first — see upstream issue #165; Following still resolves
 * via a grace period but uses a rotated ID too). This module rewrites requests
 * to the current IDs and backfills the feature flags the newer queries require,
 * so we don't have to fork or patch the library.
 *
 * Current IDs and required feature switches come from X's web bundle
 * (https://abs.twimg.com/responsive-web/client-web/main.<hash>.js — search for
 * `operationName:"Followers"`). Last synced: 2026-07-07.
 */

const CURRENT_QUERY_IDS: Record<string, string> = {
  Followers: '4yeuNabfz3qFlfncCAy8Yw',
  Following: 'eNoXdfXv5rU75RBzlmfuPA'
};

// Flags the current queries list in featureSwitches but the library omits;
// X rejects the request with a 400 when a required flag is absent.
const REQUIRED_FEATURES: Record<string, boolean> = {
  content_disclosure_ai_generated_indicator_enabled: false,
  content_disclosure_indicator_enabled: false,
  rweb_cashtags_composer_attachment_enabled: false,
  rweb_cashtags_enabled: false,
  rweb_conversational_replies_downvote_enabled: false
};

const GRAPHQL_PATH = /^(.*\/graphql)\/([^/]+)\/([^/?]+)$/;

function updateGraphqlUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const match = parsed.pathname.match(GRAPHQL_PATH);
  if (!match) {
    return url;
  }

  const [, prefix, , operation] = match;
  const currentId = CURRENT_QUERY_IDS[operation];
  if (!currentId) {
    return url;
  }

  parsed.pathname = `${prefix}/${currentId}/${operation}`;

  const rawFeatures = parsed.searchParams.get('features');
  const features = rawFeatures ? JSON.parse(rawFeatures) : {};
  parsed.searchParams.set(
    'features',
    JSON.stringify({ ...REQUIRED_FEATURES, ...features })
  );

  return parsed.toString();
}

/**
 * Request transform for the scraper (ScraperOptions.transform.request).
 */
export function rewriteGraphqlRequest(
  ...args: Parameters<typeof fetch>
): Parameters<typeof fetch> {
  const [input, init] = args;
  if (typeof input === 'string') {
    return [updateGraphqlUrl(input), init];
  }
  if (input instanceof URL) {
    return [new URL(updateGraphqlUrl(input.toString())), init];
  }
  return args;
}
