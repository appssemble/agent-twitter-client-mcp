import { Buffer } from 'node:buffer';
import { validateInput } from '../utils/validators.js';
import { sanitizeForLogging } from '../utils/logger.js';
import { WriteAuthenticationManager } from '../write-authentication.js';
import {
  PostTweetSchema,
  FollowUserSchema,
  LikeTweetSchema,
  RetweetSchema,
  TwitterMcpError
} from '../types.js';

const creds = { authToken: 'auth-token-value', ct0: 'ct0-value', twid: 'u%3D1234567890' };

describe('Write tool validation', () => {
  describe('PostTweetSchema', () => {
    test('accepts valid input', () => {
      const result = validateInput(PostTweetSchema, { credentials: creds, text: 'hello' });
      expect(result).toEqual({ credentials: creds, text: 'hello' });
    });

    test('accepts an optional replyToTweetId', () => {
      const result = validateInput(PostTweetSchema, {
        credentials: creds,
        text: 'hi',
        replyToTweetId: '123'
      });
      expect(result.replyToTweetId).toBe('123');
    });

    test('rejects missing credentials', () => {
      expect(() => validateInput(PostTweetSchema, { text: 'hello' })).toThrow(TwitterMcpError);
    });

    test('rejects credentials missing ct0', () => {
      expect(() =>
        validateInput(PostTweetSchema, {
          credentials: { authToken: 'x', twid: 'u%3D1' },
          text: 'hello'
        })
      ).toThrow(TwitterMcpError);
    });

    test('rejects credentials missing twid', () => {
      expect(() =>
        validateInput(PostTweetSchema, {
          credentials: { authToken: 'x', ct0: 'y' },
          text: 'hello'
        })
      ).toThrow(TwitterMcpError);
    });

    test('rejects empty text', () => {
      expect(() => validateInput(PostTweetSchema, { credentials: creds, text: '' })).toThrow(
        TwitterMcpError
      );
    });

    test('rejects text longer than 280 characters', () => {
      expect(() =>
        validateInput(PostTweetSchema, { credentials: creds, text: 'a'.repeat(281) })
      ).toThrow(TwitterMcpError);
    });
  });

  describe('FollowUserSchema', () => {
    test('accepts valid input', () => {
      const result = validateInput(FollowUserSchema, { credentials: creds, username: 'jack' });
      expect(result.username).toBe('jack');
    });

    test('rejects missing username', () => {
      expect(() => validateInput(FollowUserSchema, { credentials: creds })).toThrow(TwitterMcpError);
    });

    test('rejects missing credentials', () => {
      expect(() => validateInput(FollowUserSchema, { username: 'jack' })).toThrow(TwitterMcpError);
    });
  });

  describe('LikeTweetSchema / RetweetSchema', () => {
    test('accept a tweet id with credentials', () => {
      expect(validateInput(LikeTweetSchema, { credentials: creds, id: '42' }).id).toBe('42');
      expect(validateInput(RetweetSchema, { credentials: creds, id: '42' }).id).toBe('42');
    });

    test('reject a missing id', () => {
      expect(() => validateInput(LikeTweetSchema, { credentials: creds })).toThrow(TwitterMcpError);
      expect(() => validateInput(RetweetSchema, { credentials: creds })).toThrow(TwitterMcpError);
    });
  });

  describe('rettiwt authentication', () => {
    const auth = WriteAuthenticationManager.getInstance();

    afterEach(() => auth.clearAllInstances());

    // Every accepted twid form must encode into an API key that rettiwt's
    // getUserId regex accepts; otherwise the Rettiwt constructor throws.
    test.each(['u%3D1234567890', 'u=1234567890', '"u=1234567890"', '1234567890'])(
      'builds a valid Rettiwt instance for twid form %s',
      (twid) => {
        expect(() => auth.getRettiwt({ ...creds, twid })).not.toThrow();
      }
    );

    test('caches the Rettiwt instance per credential', () => {
      const a = auth.getRettiwt(creds);
      const b = auth.getRettiwt(creds);
      expect(a).toBe(b);
    });

    // Regression: rettiwt decodes the API key via `split(';').map(s => new Cookie(s))`,
    // and cookiejar keeps a leading space as part of the cookie name. If the key is
    // built with "; " separators, auth_token/ct0 become " auth_token"/" ct0", get
    // dropped from the request, and every write 401s. No segment may start with
    // whitespace, and each expected cookie must be present with its exact name.
    test('encodes cookies so no segment has a leading space', () => {
      const rettiwt = auth.getRettiwt(creds);
      const decoded = Buffer.from(rettiwt.apiKey as string, 'base64').toString('ascii');
      const segments = decoded.split(';');
      for (const segment of segments) {
        expect(segment).toBe(segment.trimStart());
      }
      const names = segments.map((segment) => segment.split('=')[0]);
      expect(names).toEqual(expect.arrayContaining(['auth_token', 'ct0', 'twid']));
    });

    test('rejects a twid with no numeric user id', () => {
      expect(() => auth.getRettiwt({ ...creds, twid: 'not-a-twid' })).toThrow(TwitterMcpError);
    });
  });

  describe('credential redaction', () => {
    test('sanitizeForLogging redacts the whole credentials object', () => {
      const sanitized = sanitizeForLogging({ credentials: creds, text: 'hello' });
      expect(sanitized.credentials).toBe('[REDACTED]');
      expect(sanitized.text).toBe('hello');
    });
  });
});
