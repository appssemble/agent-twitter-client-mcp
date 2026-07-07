import { WriteCredentials, TwitterMcpError } from './types.js';
import { WriteAuthenticationManager } from './write-authentication.js';

/**
 * Client for Twitter write operations (post, follow, like, retweet), backed by
 * rettiwt-api. Each method authenticates with the caller-supplied session
 * cookies via WriteAuthenticationManager.
 */
export class TwitterWriteClient {
  private authManager: WriteAuthenticationManager;

  constructor() {
    this.authManager = WriteAuthenticationManager.getInstance();
  }

  /**
   * Post a tweet, optionally as a reply to another tweet.
   */
  async postTweet(
    credentials: WriteCredentials,
    text: string,
    replyToTweetId?: string
  ): Promise<{ success: true; tweetId: string | null; text: string; replyToTweetId?: string }> {
    try {
      const rettiwt = this.authManager.getRettiwt(credentials);
      const tweetId = await rettiwt.tweet.post({ text, replyTo: replyToTweetId });
      return { success: true, tweetId: tweetId ?? null, text, replyToTweetId };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Follow a user by username. rettiwt follows by numeric user id, so the
   * username is resolved to an id first.
   */
  async followUser(
    credentials: WriteCredentials,
    username: string
  ): Promise<{ success: boolean; username: string; userId: string }> {
    try {
      const rettiwt = this.authManager.getRettiwt(credentials);
      const user = await rettiwt.user.details(username);
      if (!user) {
        throw new TwitterMcpError(
          `User @${username} not found`,
          'user_not_found',
          404
        );
      }
      const success = await rettiwt.user.follow(user.id);
      return { success, username, userId: user.id };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Like a tweet by ID.
   */
  async likeTweet(
    credentials: WriteCredentials,
    id: string
  ): Promise<{ success: boolean; id: string }> {
    try {
      const rettiwt = this.authManager.getRettiwt(credentials);
      const success = await rettiwt.tweet.like(id);
      return { success, id };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Retweet a tweet by ID.
   */
  async retweet(
    credentials: WriteCredentials,
    id: string
  ): Promise<{ success: boolean; id: string }> {
    try {
      const rettiwt = this.authManager.getRettiwt(credentials);
      const success = await rettiwt.tweet.retweet(id);
      return { success, id };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Centralized error handling (mirrors TwitterClient).
   */
  private handleError(error: unknown): never {
    if (error instanceof TwitterMcpError) {
      throw error;
    }
    console.error('Twitter write client error:', error);
    throw new TwitterMcpError(
      `Twitter write client error: ${(error as Error).message}`,
      'twitter_write_client_error',
      500
    );
  }
}
