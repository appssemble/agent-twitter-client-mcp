import { Tweet, Profile } from '@the-convocation/twitter-scraper';
import { TweetResponse, ProfileResponse, SearchResponse } from '../types.js';

/**
 * Format a Tweet object from agent-twitter-client to TweetResponse
 */
export function formatTweet(tweet: Tweet): TweetResponse {
  return {
    id: tweet.id!,
    text: tweet.text!,
    author: {
      id: tweet.userId!,
      username: tweet.username!,
      name: tweet.name!
    },
    createdAt: tweet.timeParsed ? tweet.timeParsed.toISOString() : undefined,
    metrics: {
      likes: tweet.likes,
      retweets: tweet.retweets,
      replies: tweet.replies,
      views: tweet.views
    },
    media: {
      photos: tweet.photos ? tweet.photos.map(photo => ({
        url: photo.url,
        alt: photo.alt_text
      })) : undefined,
      videos: tweet.videos ? tweet.videos.map(video => ({
        url: video.url!,
        preview: video.preview || ''
      })) : undefined
    },
    urls: tweet.urls,
    isRetweet: tweet.isRetweet,
    isReply: tweet.isReply,
    isQuote: tweet.isQuoted,
    quotedTweet: tweet.quotedStatus ? formatTweet(tweet.quotedStatus) : undefined,
    inReplyToTweet: tweet.inReplyToStatus ? formatTweet(tweet.inReplyToStatus) : undefined,
    permanentUrl: tweet.permanentUrl!
  };
}

/**
 * Format a Profile object from agent-twitter-client to ProfileResponse
 */
export function formatProfile(profile: Profile): ProfileResponse {
  return {
    id: profile.userId!,
    username: profile.username!,
    name: profile.name!,
    bio: profile.biography,
    location: profile.location,
    website: profile.website,
    joinedDate: profile.joined ? profile.joined.toISOString() : undefined,
    isVerified: profile.isVerified,
    isPrivate: profile.isPrivate,
    followersCount: profile.followersCount,
    followingCount: profile.followingCount,
    tweetsCount: profile.tweetsCount,
    profileImageUrl: profile.avatar,
    bannerImageUrl: profile.banner
  };
}

/**
 * Format search results
 */
export function formatSearch(query: string, tweets: Tweet[]): SearchResponse {
  return {
    query,
    tweets: tweets.map(formatTweet)
  };
} 