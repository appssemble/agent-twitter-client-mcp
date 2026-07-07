import { Scraper } from '@the-convocation/twitter-scraper';
import {
  AuthConfig,
  CookieAuth,
  CredentialsAuth,
  TwitterMcpError
} from './types.js';

export class AuthenticationManager {
  private static instance: AuthenticationManager;
  private scraperInstances = new Map<string, Scraper>();

  private constructor() {}

  public static getInstance(): AuthenticationManager {
    if (!AuthenticationManager.instance) {
      AuthenticationManager.instance = new AuthenticationManager();
    }
    return AuthenticationManager.instance;
  }

  /**
   * Get or create a scraper instance based on the provided authentication config
   */
  public async getScraper(config: AuthConfig): Promise<Scraper> {
    const key = this.getScraperKey(config);

    if (this.scraperInstances.has(key)) {
      return this.scraperInstances.get(key)!;
    }

    // Create a new scraper and authenticate.
    // xClientTransactionId: X enforces the x-client-transaction-id header on
    // some GraphQL endpoints (Followers among them) and answers 404 - not
    // 401 - when it is missing, so the header generation must be opted in.
    // (Generating it needs ArrayBuffer.prototype.transfer, hence Node >= 22.)
    const scraper = new Scraper({
      experimental: { xClientTransactionId: true, xpff: false }
    });
    try {
      await this.authenticate(scraper, config);
      this.scraperInstances.set(key, scraper);
      return scraper;
    } catch (error) {
      throw new TwitterMcpError(
        `Authentication failed: ${(error as Error).message}`,
        'auth_failure',
        401
      );
    }
  }

  /**
   * Authenticate a scraper instance based on config
   */
  private async authenticate(scraper: Scraper, config: AuthConfig): Promise<void> {
    switch (config.method) {
      case 'cookies':
        await this.authenticateWithCookies(scraper, config.data as CookieAuth);
        break;
      case 'credentials':
        await this.authenticateWithCredentials(scraper, config.data as CredentialsAuth);
        break;
      case 'api':
        throw new TwitterMcpError(
          'API key authentication is no longer supported. Use cookie or credential authentication instead.',
          'unsupported_auth_method',
          400
        );
      default:
        throw new TwitterMcpError(
          `Unsupported authentication method: ${config.method}`,
          'unsupported_auth_method',
          400
        );
    }
  }

  /**
   * Twitter moved to x.com; the scraper stores cookies against x.com URLs,
   * so cookies exported with the old .twitter.com domain would be silently
   * rejected by the cookie jar. Rewrite the domain so both forms work.
   */
  private normalizeCookieDomain(cookie: string): string {
    return cookie.replace(/Domain=\.?twitter\.com/i, 'Domain=x.com');
  }

  /**
   * Authenticate using cookies
   */
  private async authenticateWithCookies(scraper: Scraper, auth: CookieAuth): Promise<void> {
    try {
      await scraper.setCookies(auth.cookies.map(c => this.normalizeCookieDomain(c)));
      const isLoggedIn = await scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new TwitterMcpError(
          'Cookie authentication failed',
          'cookie_auth_failure',
          401
        );
      }
    } catch (error) {
      if (error instanceof TwitterMcpError) {
        throw error;
      }
      throw new TwitterMcpError(
        `Cookie authentication error: ${(error as Error).message}`,
        'cookie_auth_error',
        500
      );
    }
  }

  /**
   * Authenticate using username/password
   */
  private async authenticateWithCredentials(scraper: Scraper, auth: CredentialsAuth): Promise<void> {
    try {
      await scraper.login(
        auth.username,
        auth.password,
        auth.email,
        auth.twoFactorSecret
      );
    } catch (error) {
      throw new TwitterMcpError(
        `Credential authentication error: ${(error as Error).message}`,
        'credential_auth_error',
        401
      );
    }
  }

  /**
   * Generate a unique key for the scraper instance
   */
  private getScraperKey(config: AuthConfig): string {
    let cookieAuth: CookieAuth;
    let authTokenCookie: string | undefined;
    let ct0Cookie: string | undefined;
    let authToken: string;
    let ct0: string;
    let creds: CredentialsAuth;

    switch (config.method) {
      case 'cookies':
        // For cookies, use a combination of auth_token and ct0 if available
        cookieAuth = config.data as CookieAuth;
        authTokenCookie = cookieAuth.cookies.find(c => c.includes('auth_token='));
        ct0Cookie = cookieAuth.cookies.find(c => c.includes('ct0='));

        if (authTokenCookie && ct0Cookie) {
          authToken = authTokenCookie.split('=')[1].split(';')[0];
          ct0 = ct0Cookie.split('=')[1].split(';')[0];
          return `cookies_${authToken}_${ct0}`;
        }
        return `cookies_${Date.now()}`;

      case 'credentials':
        creds = config.data as CredentialsAuth;
        return `credentials_${creds.username}`;

      default:
        return `unknown_${Date.now()}`;
    }
  }

  /**
   * Clear all scraper instances
   */
  public clearAllScrapers(): void {
    this.scraperInstances.clear();
  }
}
