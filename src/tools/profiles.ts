import {
  GetUserProfileSchema,
  GetFollowersSchema,
  GetFollowingSchema,
  AuthConfig
} from '../types.js';
import { TwitterClient } from '../twitter-client.js';
import { validateInput } from '../utils/validators.js';

// Define types for the validated parameters
type GetUserProfileParams = {
  username: string;
};

type GetFollowersParams = {
  userId: string;
  count: number;
};

type GetFollowingParams = {
  userId: string;
  count: number;
};

export class ProfileTools {
  private client: TwitterClient;

  constructor() {
    this.client = new TwitterClient();
  }

  /**
   * Get a user profile
   */
  async getUserProfile(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<GetUserProfileParams>(GetUserProfileSchema, args);
    const profile = await this.client.getUserProfile(authConfig, params.username);

    return {
      profile
    };
  }

  /**
   * Get a user's followers
   */
  async getFollowers(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<GetFollowersParams>(GetFollowersSchema, args);
    const profiles = await this.client.getFollowers(
      authConfig,
      params.userId,
      params.count
    );

    return {
      profiles,
      count: profiles.length,
      userId: params.userId
    };
  }

  /**
   * Get a user's following
   */
  async getFollowing(authConfig: AuthConfig, args: unknown) {
    const params = validateInput<GetFollowingParams>(GetFollowingSchema, args);
    const profiles = await this.client.getFollowing(
      authConfig,
      params.userId,
      params.count
    );

    return {
      profiles,
      count: profiles.length,
      userId: params.userId
    };
  }
}
