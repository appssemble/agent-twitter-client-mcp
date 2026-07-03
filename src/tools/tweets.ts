import {
  GetUserTweetsSchema,
  GetTweetByIdSchema,
  SearchTweetsSchema,
  AuthConfig
} from '../types.js';
import { TwitterClient } from '../twitter-client.js';
import { validateInput } from '../utils/validators.js';

// Define types for the validated parameters
type GetUserTweetsParams = {
  username: string;
  count: number;
  includeReplies: boolean;
  includeRetweets: boolean;
};

type GetTweetByIdParams = {
  id: string;
};

type SearchTweetsParams = {
  query: string;
  count: number;
  searchMode: string;
};

export class TweetTools {
  private client: TwitterClient;

  constructor() {
    this.client = new TwitterClient();
  }

  /**
   * Get tweets from a user
   */
  async getUserTweets(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<GetUserTweetsParams>(GetUserTweetsSchema, args);
    const tweets = await this.client.getUserTweets(
      authConfig,
      params.username,
      params.count,
      params.includeReplies,
      params.includeRetweets
    );

    return {
      tweets,
      count: tweets.length,
      username: params.username
    };
  }

  /**
   * Get a specific tweet by ID
   */
  async getTweetById(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<GetTweetByIdParams>(GetTweetByIdSchema, args);
    const tweet = await this.client.getTweetById(authConfig, params.id);

    return {
      tweet
    };
  }

  /**
   * Search for tweets
   */
  async searchTweets(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<SearchTweetsParams>(SearchTweetsSchema, args);
    const searchResults = await this.client.searchTweets(
      authConfig,
      params.query,
      params.count,
      params.searchMode
    );

    return searchResults;
  }
}
