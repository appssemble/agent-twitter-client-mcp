import {
  PostTweetSchema,
  FollowUserSchema,
  LikeTweetSchema,
  RetweetSchema,
  WriteCredentials
} from '../types.js';
import { TwitterWriteClient } from '../write-client.js';
import { validateInput } from '../utils/validators.js';

// Validated parameter shapes
type PostTweetParams = {
  credentials: WriteCredentials;
  text: string;
  replyToTweetId?: string;
};

type FollowUserParams = {
  credentials: WriteCredentials;
  username: string;
};

type LikeTweetParams = {
  credentials: WriteCredentials;
  id: string;
};

type RetweetParams = {
  credentials: WriteCredentials;
  id: string;
};

export class WriteTools {
  private client: TwitterWriteClient;

  constructor() {
    this.client = new TwitterWriteClient();
  }

  /**
   * Post a tweet (optionally a reply).
   */
  async postTweet(args: unknown) {
    const params = validateInput<PostTweetParams>(PostTweetSchema, args);
    return this.client.postTweet(params.credentials, params.text, params.replyToTweetId);
  }

  /**
   * Follow a user.
   */
  async followUser(args: unknown) {
    const params = validateInput<FollowUserParams>(FollowUserSchema, args);
    return this.client.followUser(params.credentials, params.username);
  }

  /**
   * Like a tweet.
   */
  async likeTweet(args: unknown) {
    const params = validateInput<LikeTweetParams>(LikeTweetSchema, args);
    return this.client.likeTweet(params.credentials, params.id);
  }

  /**
   * Retweet a tweet.
   */
  async retweet(args: unknown) {
    const params = validateInput<RetweetParams>(RetweetSchema, args);
    return this.client.retweet(params.credentials, params.id);
  }
}
