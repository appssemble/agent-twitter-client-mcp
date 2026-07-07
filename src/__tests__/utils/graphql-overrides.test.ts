import { rewriteGraphqlRequest } from '../../utils/graphql-overrides.js';

const STALE_FOLLOWERS_URL =
  'https://api.x.com/graphql/P7m4Qr-rJEB8KUluOenU6A/Followers?variables=%7B%22userId%22%3A%22123%22%2C%22count%22%3A20%7D&features=%7B%22rweb_video_screen_enabled%22%3Afalse%7D';
const STALE_FOLLOWING_URL =
  'https://api.x.com/graphql/T5wihsMTYHncY7BB4YxHSg/Following?variables=%7B%22userId%22%3A%22123%22%2C%22count%22%3A20%7D&features=%7B%22rweb_video_screen_enabled%22%3Afalse%7D';

describe('rewriteGraphqlRequest', () => {
  test('rewrites stale Followers queryId to the current one', () => {
    const [url] = rewriteGraphqlRequest(STALE_FOLLOWERS_URL, { method: 'GET' });
    expect(url).toContain('/graphql/4yeuNabfz3qFlfncCAy8Yw/Followers');
    expect(url).not.toContain('P7m4Qr-rJEB8KUluOenU6A');
  });

  test('rewrites stale Following queryId to the current one', () => {
    const [url] = rewriteGraphqlRequest(STALE_FOLLOWING_URL, { method: 'GET' });
    expect(url).toContain('/graphql/eNoXdfXv5rU75RBzlmfuPA/Following');
  });

  test('adds feature flags required by the current query, preserving existing ones', () => {
    const [url] = rewriteGraphqlRequest(STALE_FOLLOWERS_URL, undefined);
    const features = JSON.parse(
      new URL(url as string).searchParams.get('features')!
    );
    expect(features.rweb_video_screen_enabled).toBe(false);
    expect(features.content_disclosure_indicator_enabled).toBe(false);
    expect(features.content_disclosure_ai_generated_indicator_enabled).toBe(false);
    expect(features.rweb_cashtags_enabled).toBe(false);
    expect(features.rweb_cashtags_composer_attachment_enabled).toBe(false);
    expect(features.rweb_conversational_replies_downvote_enabled).toBe(false);
  });

  test('preserves the init argument untouched', () => {
    const init = { method: 'GET', headers: { authorization: 'Bearer x' } };
    const [, out] = rewriteGraphqlRequest(STALE_FOLLOWERS_URL, init);
    expect(out).toBe(init);
  });

  test('accepts URL objects', () => {
    const [url] = rewriteGraphqlRequest(new URL(STALE_FOLLOWERS_URL), undefined);
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).pathname).toBe('/graphql/4yeuNabfz3qFlfncCAy8Yw/Followers');
  });

  test('leaves GraphQL operations without an override untouched', () => {
    const original =
      'https://api.x.com/graphql/SomeQueryId123/UserByScreenName?variables=%7B%7D';
    const [url] = rewriteGraphqlRequest(original, undefined);
    expect(url).toBe(original);
  });

  test('leaves non-GraphQL URLs untouched', () => {
    const original = 'https://api.x.com/1.1/account/verify_credentials.json';
    const [url] = rewriteGraphqlRequest(original, undefined);
    expect(url).toBe(original);
  });
});
