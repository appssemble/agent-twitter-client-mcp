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

// Credentials passed per-call to write tools. Writes are not backed by the
// server's ambient auth: the caller supplies the acting account's session
// cookies with every write request. rettiwt-api needs three cookies:
// auth_token (session), ct0 (CSRF), and twid (encodes the acting user's id,
// which rettiwt requires to build its API key).
export interface WriteCredentials {
  authToken: string;
  ct0: string;
  twid: string;
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

// Session cookies for the acting account, shared by every write tool. Nested
// under a `credentials` key so sanitizeForLogging redacts the whole object in
// logs (the key matches its "credential" filter; a bare `ct0` would not).
export const WriteCredentialsSchema = zod.object({
  authToken: zod.string().min(1, 'authToken cookie is required'),
  ct0: zod.string().min(1, 'ct0 cookie is required'),
  twid: zod.string().min(1, 'twid cookie is required')
});

export const PostTweetSchema = zod.object({
  credentials: WriteCredentialsSchema,
  text: zod.string().min(1, 'Tweet text is required').max(280, 'Tweet cannot exceed 280 characters'),
  replyToTweetId: zod.string().optional()
});

export const FollowUserSchema = zod.object({
  credentials: WriteCredentialsSchema,
  username: zod.string().min(1, 'Username is required')
});

export const LikeTweetSchema = zod.object({
  credentials: WriteCredentialsSchema,
  id: zod.string().min(1, 'Tweet ID is required')
});

export const RetweetSchema = zod.object({
  credentials: WriteCredentialsSchema,
  id: zod.string().min(1, 'Tweet ID is required')
});

export const GetUserProfileSchema = zod.object({
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