import { TwitterClient } from '../../twitter-client.js';
import { AuthConfig } from '../../types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Skip these tests unless specifically enabled
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

(runIntegrationTests ? describe : describe.skip)('Twitter Integration Tests', () => {
  let client: TwitterClient;
  let authConfig: AuthConfig;

  beforeAll(() => {
    // Set up auth config from environment variables
    const authMethod = process.env.AUTH_METHOD || 'cookies';
    
    if (authMethod === 'cookies') {
      const cookiesStr = process.env.TWITTER_COOKIES;
      if (!cookiesStr) {
        throw new Error('TWITTER_COOKIES environment variable is required for cookie auth');
      }
      authConfig = {
        method: 'cookies',
        data: { cookies: JSON.parse(cookiesStr) }
      };
    } else if (authMethod === 'credentials') {
      const username = process.env.TWITTER_USERNAME;
      const password = process.env.TWITTER_PASSWORD;
      if (!username || !password) {
        throw new Error('TWITTER_USERNAME and TWITTER_PASSWORD are required for credential auth');
      }
      authConfig = {
        method: 'credentials',
        data: {
          username,
          password,
          email: process.env.TWITTER_EMAIL,
          twoFactorSecret: process.env.TWITTER_2FA_SECRET
        }
      };
    } else if (authMethod === 'api') {
      const apiKey = process.env.TWITTER_API_KEY;
      const apiSecretKey = process.env.TWITTER_API_SECRET_KEY;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
      if (!apiKey || !apiSecretKey || !accessToken || !accessTokenSecret) {
        throw new Error('API credentials are required for API auth');
      }
      authConfig = {
        method: 'api',
        data: {
          apiKey,
          apiSecretKey,
          accessToken,
          accessTokenSecret
        }
      };
    } else {
      throw new Error(`Auth method ${authMethod} not configured for tests`);
    }
    
    client = new TwitterClient();
  });

  test('can fetch a user profile', async () => {
    const profile = await client.getUserProfile(authConfig, 'twitter');
    expect(profile).toBeDefined();
    expect(profile.username).toBe('twitter');
  }, 30000); // Longer timeout for API calls

  test('can search tweets', async () => {
    const results = await client.searchTweets(authConfig, 'twitter', 5, 'Top');
    expect(results).toBeDefined();
    expect(results.tweets.length).toBeGreaterThan(0);
  }, 30000);

  test('can get tweets from a user', async () => {
    const tweets = await client.getUserTweets(authConfig, 'twitter', 5);
    expect(tweets).toBeDefined();
    expect(tweets.length).toBeGreaterThan(0);
  }, 30000);

}); 