import {
  AuthConfig,
  TwitterMcpError,
  TweetResponse,
  ProfileResponse,
  SearchResponse
} from './types.js';
import { AuthenticationManager } from './authentication.js';
import { formatTweet, formatProfile, formatSearch } from './utils/formatters.js';
import { SearchMode } from '@the-convocation/twitter-scraper';

export class TwitterClient {
  private authManager: AuthenticationManager;

  constructor() {
    this.authManager = AuthenticationManager.getInstance();
  }

  /**
   * Get tweets from a user
   */
  async getUserTweets(
    config: AuthConfig,
    username: string,
    count: number,
    includeReplies: boolean = false,
    includeRetweets: boolean = true
  ): Promise<TweetResponse[]> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const tweetIterator = includeReplies
        ? scraper.getTweetsAndReplies(username, count)
        : scraper.getTweets(username, count);
      const tweets: any[] = [];
      for await (const tweet of tweetIterator) {
        if (!includeRetweets && tweet.isRetweet) {
          continue;
        }
        tweets.push(tweet);
        if (tweets.length >= count) {
          break;
        }
      }
      return tweets.map(formatTweet);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a tweet by ID
   */
  async getTweetById(
    config: AuthConfig,
    id: string
  ): Promise<TweetResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const tweet = await scraper.getTweet(id);
      if (!tweet) {
        throw new TwitterMcpError(
          `Tweet with ID ${id} not found`,
          'tweet_not_found',
          404
        );
      }
      return formatTweet(tweet);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Search for tweets
   */
  async searchTweets(
    config: AuthConfig,
    query: string,
    count: number,
    searchMode: string = 'Top'
  ): Promise<SearchResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const mode = this.getSearchMode(searchMode);
      const tweets: any[] = [];
      for await (const tweet of scraper.searchTweets(query, count, mode)) {
        tweets.push(tweet);
        if (tweets.length >= count) {
          break;
        }
      }
      return formatSearch(query, tweets);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a user's profile
   */
  async getUserProfile(
    config: AuthConfig,
    username: string
  ): Promise<ProfileResponse> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const profile = await scraper.getProfile(username);
      return formatProfile(profile);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a user's followers
   */
  async getFollowers(
    config: AuthConfig,
    userId: string,
    count: number
  ): Promise<ProfileResponse[]> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const profiles: any[] = [];
      for await (const profile of scraper.getFollowers(userId, count)) {
        profiles.push(profile);
        if (profiles.length >= count) {
          break;
        }
      }
      return profiles.map(formatProfile);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a user's following
   */
  async getFollowing(
    config: AuthConfig,
    userId: string,
    count: number
  ): Promise<ProfileResponse[]> {
    try {
      const scraper = await this.authManager.getScraper(config);
      const profiles: any[] = [];
      for await (const profile of scraper.getFollowing(userId, count)) {
        profiles.push(profile);
        if (profiles.length >= count) {
          break;
        }
      }
      return profiles.map(formatProfile);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Helper to convert string search mode to SearchMode enum
   */
  private getSearchMode(mode: string): any {
    switch (mode) {
      case 'Latest':
        return SearchMode.Latest;
      case 'Photos':
        return SearchMode.Photos;
      case 'Videos':
        return SearchMode.Videos;
      case 'Top':
      default:
        return SearchMode.Top;
    }
  }

  /**
   * Centralized error handling
   */
  private handleError(error: unknown): never {
    if (error instanceof TwitterMcpError) {
      throw error;
    }
    console.error('Twitter client error:', error);
    throw new TwitterMcpError(
      `Twitter client error: ${(error as Error).message}`,
      'twitter_client_error',
      500
    );
  }
}
