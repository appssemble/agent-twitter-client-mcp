import { Rettiwt } from 'rettiwt-api';
import { Buffer } from 'node:buffer';
import { WriteCredentials, TwitterMcpError } from './types.js';

/**
 * Authentication manager for write operations.
 *
 * Reads go through @the-convocation/twitter-scraper, which is read-only. Writes
 * (posting, following, liking, retweeting) instead use rettiwt-api, which is
 * actively maintained and supports write actions. Because writes act on behalf
 * of a specific user, the acting account's session cookies are supplied per
 * call rather than taken from the server's ambient auth config.
 *
 * rettiwt authenticates with an "API key" that is simply the base-64 encoding
 * of the account's cookie header. We build that key from the supplied cookies
 * so callers pass raw cookies rather than a pre-generated key.
 *
 * Authenticated Rettiwt instances are cached per credential so repeated writes
 * from the same account reuse one session.
 */
export class WriteAuthenticationManager {
  private static instance: WriteAuthenticationManager;
  private rettiwtInstances = new Map<string, Rettiwt>();

  private constructor() {}

  public static getInstance(): WriteAuthenticationManager {
    if (!WriteAuthenticationManager.instance) {
      WriteAuthenticationManager.instance = new WriteAuthenticationManager();
    }
    return WriteAuthenticationManager.instance;
  }

  /**
   * Get or create an authenticated Rettiwt instance for the given credentials.
   */
  public getRettiwt(credentials: WriteCredentials): Rettiwt {
    const key = this.getInstanceKey(credentials);

    const cached = this.rettiwtInstances.get(key);
    if (cached) {
      return cached;
    }

    const apiKey = this.buildApiKey(credentials);
    try {
      // The Rettiwt constructor derives the acting user id from the twid cookie
      // and throws if the key is structurally invalid, so this validates the
      // credential shape up front (though not whether the cookies are live).
      const rettiwt = new Rettiwt({ apiKey });
      this.rettiwtInstances.set(key, rettiwt);
      return rettiwt;
    } catch (error) {
      throw new TwitterMcpError(
        `Write authentication failed: ${(error as Error).message}. Ensure auth_token, ct0 and twid are valid cookies for the acting account.`,
        'write_auth_failure',
        401
      );
    }
  }

  /**
   * Build rettiwt's API key: base64 of the account's cookie header.
   *
   * rettiwt derives the acting user id by matching `twid=u%3D<id>;` (or the
   * quoted `twid="u=<id>"` form) against the decoded key, so twid must be
   * normalised to that shape and must not be the final cookie (the regex
   * requires a trailing `;`). We therefore place twid first.
   *
   * The pairs are joined with `;` and NO trailing space: rettiwt parses the
   * decoded key with `split(';').map(item => new Cookie(item))`, and cookiejar
   * keeps a leading space as part of the cookie name (" auth_token" != "auth_token"),
   * which would silently drop auth_token/ct0 from the request and yield a 401.
   */
  private buildApiKey(credentials: WriteCredentials): string {
    const twid = this.normalizeTwid(credentials.twid);
    const cookieString =
      `twid=${twid};auth_token=${credentials.authToken};ct0=${credentials.ct0}`;
    return Buffer.from(cookieString).toString('base64');
  }

  /**
   * Reduce any accepted twid form (`u%3D123`, `u=123`, `"u=123"`, or a bare id)
   * to the canonical `u%3D<id>` that rettiwt's user-id regex matches.
   */
  private normalizeTwid(twid: string): string {
    const match = twid.match(/\d+/);
    if (!match) {
      throw new TwitterMcpError(
        'twid cookie does not contain a numeric user id',
        'write_auth_failure',
        401
      );
    }
    return `u%3D${match[0]}`;
  }

  /**
   * Cache key derived from the acting account's session cookies.
   */
  private getInstanceKey(credentials: WriteCredentials): string {
    return `write_${credentials.authToken}_${credentials.ct0}_${credentials.twid}`;
  }

  /**
   * Clear all cached Rettiwt instances.
   */
  public clearAllInstances(): void {
    this.rettiwtInstances.clear();
  }
}
