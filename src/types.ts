import * as zod from 'zod';
import { Tweet, Profile } from '@the-convocation/twitter-scraper';

// Authentication Types
export type AuthMethod = 'cookies' | 'credentials' | 'api';

export interface AuthConfig {
  method: AuthMethod;
  data: CookieAuth | CredentialsAuth | ApiAuth;
}

export interface CookieAuth {
  cookies: string[];
}

export interface CredentialsAuth {
  username: string;
  password: string;
  email?: string;
  twoFactorSecret?: string;
}

export interface ApiAuth {
  apiKey: string;
  apiSecretKey: string;
  accessToken: string;
  accessTokenSecret: string;
}

// Tool Input Schemas
export const GetUserTweetsSchema = zod.object({
  username: zod.string().min(1, 'Username is required'),
  count: zod.number().int().min(1).max(200).default(20),
  includeReplies: zod.boolean().default(false),
  includeRetweets: zod.boolean().default(true)
});

export const GetTweetByIdSchema = zod.object({
  id: zod.string().min(1, 'Tweet ID is required')
});

// Define the search modes
type SearchMode = 'Top' | 'Latest' | 'Photos' | 'Videos';

export const SearchTweetsSchema = zod.object({
  query: zod.string().min(1, 'Search query is required'),
  count: zod.number().int().min(1).max(100).default(20),
  searchMode: zod.string().default('Top')
});

export const SendTweetSchema = zod.object({
  text: zod.string().min(1, 'Tweet text is required').max(280, 'Tweet cannot exceed 280 characters'),
  replyToTweetId: zod.string().optional(),
  media: zod.array(zod.object({
    data: zod.string(), // Base64 encoded media
    mediaType: zod.string() // MIME type
  })).optional()
});

export const SendTweetWithPollSchema = zod.object({
  text: zod.string().min(1, 'Tweet text is required').max(280, 'Tweet cannot exceed 280 characters'),
  replyToTweetId: zod.string().optional(),
  poll: zod.object({
    options: zod.array(zod.object({
      label: zod.string().min(1).max(25)
    })).min(2).max(4),
    durationMinutes: zod.number().int().min(5).max(10080).default(1440) // Default 24 hours
  })
});

export const LikeTweetSchema = zod.object({
  id: zod.string().min(1, 'Tweet ID is required')
});

export const RetweetSchema = zod.object({
  id: zod.string().min(1, 'Tweet ID is required')
});

export const QuoteTweetSchema = zod.object({
  text: zod.string().min(1, 'Tweet text is required').max(280, 'Tweet cannot exceed 280 characters'),
  quotedTweetId: zod.string().min(1, 'Quoted tweet ID is required'),
  media: zod.array(zod.object({
    data: zod.string(), // Base64 encoded media
    mediaType: zod.string() // MIME type
  })).optional()
});

export const GetUserProfileSchema = zod.object({
  username: zod.string().min(1, 'Username is required')
});

export const FollowUserSchema = zod.object({
  username: zod.string().min(1, 'Username is required')
});

export const GetFollowersSchema = zod.object({
  userId: zod.string().min(1, 'User ID is required'),
  count: zod.number().int().min(1).max(200).default(20)
});

export const GetFollowingSchema = zod.object({
  userId: zod.string().min(1, 'User ID is required'),
  count: zod.number().int().min(1).max(200).default(20)
});

export const GrokChatSchema = zod.object({
  message: zod.string().min(1, 'Message is required'),
  conversationId: zod.string().optional(),
  returnSearchResults: zod.boolean().default(true),
  returnCitations: zod.boolean().default(true)
});

// Response Types
export interface TweetResponse {
  id: string;
  text: string;
  author: {
    id: string;
    username: string;
    name: string;
  };
  createdAt?: string;
  metrics?: {
    likes?: number;
    retweets?: number;
    replies?: number;
    views?: number;
  };
  media?: {
    photos?: { url: string; alt?: string }[];
    videos?: { url: string; preview: string }[];
  };
  urls?: string[];
  isRetweet?: boolean;
  isReply?: boolean;
  isQuote?: boolean;
  quotedTweet?: TweetResponse;
  inReplyToTweet?: TweetResponse;
  permanentUrl: string;
}

export interface ProfileResponse {
  id: string;
  username: string;
  name: string;
  bio?: string;
  location?: string;
  website?: string;
  joinedDate?: string;
  isVerified?: boolean;
  isPrivate?: boolean;
  followersCount?: number;
  followingCount?: number;
  tweetsCount?: number;
  profileImageUrl?: string;
  bannerImageUrl?: string;
}

export interface SearchResponse {
  query: string;
  tweets: TweetResponse[];
  nextCursor?: string;
}

export interface FollowResponse {
  success: boolean;
  message: string;
}

export interface GrokChatResponse {
  conversationId: string;
  message: string;
  webResults?: any[];
}

// Error Types
export class TwitterMcpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'TwitterMcpError';
  }
} 