import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  ErrorCode,
  McpError,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { TweetTools } from './tools/tweets.js';
import { ProfileTools } from './tools/profiles.js';
import { GrokTools } from './tools/grok.js';
import { TwitterMcpError, AuthConfig } from './types.js';
import { performHealthCheck } from './health.js';
import { logError, logInfo, sanitizeForLogging } from './utils/logger.js';

// Create tools instances
const tweetTools = new TweetTools();
const profileTools = new ProfileTools();
const grokTools = new GrokTools();

// Create a configured MCP server instance. HTTP mode creates one per request
// (stateless transport), stdio mode creates a single long-lived one.
export function createTwitterMcpServer(authConfig: AuthConfig): Server {
  const server = new Server({
    name: 'agent-twitter-client-mcp',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Define available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logInfo('Received ListToolsRequest');

    return {
      tools: [
        // Tweet tools
        {
          name: 'get_user_tweets',
          description: 'Fetch tweets from a specific user',
          inputSchema: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'Twitter username (without @)'
              },
              count: {
                type: 'number',
                description: 'Number of tweets to fetch (1-200)',
                default: 20
              },
              includeReplies: {
                type: 'boolean',
                description: 'Include replies in results',
                default: false
              },
              includeRetweets: {
                type: 'boolean',
                description: 'Include retweets in results',
                default: true
              }
            },
            required: ['username']
          }
        } as Tool,

        {
          name: 'get_tweet_by_id',
          description: 'Fetch a specific tweet by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Tweet ID'
              }
            },
            required: ['id']
          }
        } as Tool,

        {
          name: 'search_tweets',
          description: 'Search for tweets by keyword',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              },
              count: {
                type: 'number',
                description: 'Number of tweets to return (10-100)',
                default: 20
              },
              searchMode: {
                type: 'string',
                description: 'Search mode: Top, Latest, Photos, or Videos',
                enum: ['Top', 'Latest', 'Photos', 'Videos'],
                default: 'Top'
              }
            },
            required: ['query']
          }
        } as Tool,

        {
          name: 'send_tweet',
          description: 'Post a new tweet',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Tweet content (max 280 characters)'
              },
              replyToTweetId: {
                type: 'string',
                description: 'ID of tweet to reply to (optional)'
              },
              media: {
                type: 'array',
                description: 'Media attachments (optional, max 4 images or 1 video)',
                items: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'string',
                      description: 'Base64 encoded media data'
                    },
                    mediaType: {
                      type: 'string',
                      description: 'MIME type of media (e.g., image/jpeg, video/mp4)'
                    }
                  },
                  required: ['data', 'mediaType']
                }
              }
            },
            required: ['text']
          }
        } as Tool,

        {
          name: 'send_tweet_with_poll',
          description: 'Post a tweet with a poll',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Tweet content (max 280 characters)'
              },
              replyToTweetId: {
                type: 'string',
                description: 'ID of tweet to reply to (optional)'
              },
              poll: {
                type: 'object',
                description: 'Poll configuration',
                properties: {
                  options: {
                    type: 'array',
                    description: 'Poll options (2-4 options)',
                    items: {
                      type: 'object',
                      properties: {
                        label: {
                          type: 'string',
                          description: 'Option label (max 25 characters)'
                        }
                      },
                      required: ['label']
                    },
                    minItems: 2,
                    maxItems: 4
                  },
                  durationMinutes: {
                    type: 'number',
                    description: 'Poll duration in minutes (5-10080, default 1440)',
                    default: 1440
                  }
                },
                required: ['options']
              }
            },
            required: ['text', 'poll']
          }
        } as Tool,

        {
          name: 'like_tweet',
          description: 'Like a tweet',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Tweet ID to like'
              }
            },
            required: ['id']
          }
        } as Tool,

        {
          name: 'retweet',
          description: 'Retweet a tweet',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Tweet ID to retweet'
              }
            },
            required: ['id']
          }
        } as Tool,

        {
          name: 'quote_tweet',
          description: 'Quote a tweet',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Quote content (max 280 characters)'
              },
              quotedTweetId: {
                type: 'string',
                description: 'ID of tweet to quote'
              },
              media: {
                type: 'array',
                description: 'Media attachments (optional, max 4 images or 1 video)',
                items: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'string',
                      description: 'Base64 encoded media data'
                    },
                    mediaType: {
                      type: 'string',
                      description: 'MIME type of media (e.g., image/jpeg, video/mp4)'
                    }
                  },
                  required: ['data', 'mediaType']
                }
              }
            },
            required: ['text', 'quotedTweetId']
          }
        } as Tool,

        // Profile tools
        {
          name: 'get_user_profile',
          description: 'Get a user\'s profile information',
          inputSchema: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'Twitter username (without @)'
              }
            },
            required: ['username']
          }
        } as Tool,

        {
          name: 'follow_user',
          description: 'Follow a Twitter user',
          inputSchema: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'Username to follow (without @)'
              }
            },
            required: ['username']
          }
        } as Tool,

        {
          name: 'get_followers',
          description: 'Get a user\'s followers',
          inputSchema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                description: 'User ID'
              },
              count: {
                type: 'number',
                description: 'Number of followers to fetch (1-200)',
                default: 20
              }
            },
            required: ['userId']
          }
        } as Tool,

        {
          name: 'get_following',
          description: 'Get users a user is following',
          inputSchema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                description: 'User ID'
              },
              count: {
                type: 'number',
                description: 'Number of following to fetch (1-200)',
                default: 20
              }
            },
            required: ['userId']
          }
        } as Tool,

        // Grok tools
        {
          name: 'grok_chat',
          description: 'Chat with Grok via Twitter',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Message to send to Grok'
              },
              conversationId: {
                type: 'string',
                description: 'Optional conversation ID for continuing a conversation'
              },
              returnSearchResults: {
                type: 'boolean',
                description: 'Whether to return search results',
                default: true
              },
              returnCitations: {
                type: 'boolean',
                description: 'Whether to return citations',
                default: true
              }
            },
            required: ['message']
          }
        } as Tool,

        // Health check tool
        {
          name: 'health_check',
          description: 'Check the health of the Twitter MCP server',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        } as Tool
      ]
    };
  });

  // Execute tools
  server.setRequestHandler(CallToolRequestSchema, async (request: { params: unknown }) => {
    // Add type assertion for request.params
    const { name, arguments: args } = request.params as { name: string; arguments: unknown };

    logInfo('Received CallToolRequest', {
      tool: name,
      args: sanitizeForLogging(args as Record<string, unknown> || {} as Record<string, unknown>)
    });

    try {
      switch (name) {
        // Tweet tools
        case 'get_user_tweets':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await tweetTools.getUserTweets(authConfig, args))
            }] as TextContent[]
          };

        case 'get_tweet_by_id':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await tweetTools.getTweetById(authConfig, args))
            }] as TextContent[]
          };

        case 'search_tweets':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await tweetTools.searchTweets(authConfig, args))
            }] as TextContent[]
          };

        case 'send_tweet':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await tweetTools.sendTweet(authConfig, args))
            }] as TextContent[]
          };

        case 'send_tweet_with_poll':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await tweetTools.sendTweetWithPoll(authConfig, args))
            }] as TextContent[]
          };

        case 'like_tweet':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await tweetTools.likeTweet(authConfig, args))
            }] as TextContent[]
          };

        case 'retweet':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await tweetTools.retweet(authConfig, args))
            }] as TextContent[]
          };

        case 'quote_tweet':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await tweetTools.quoteTweet(authConfig, args))
            }] as TextContent[]
          };

        // Profile tools
        case 'get_user_profile':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await profileTools.getUserProfile(authConfig, args))
            }] as TextContent[]
          };

        case 'follow_user':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await profileTools.followUser(authConfig, args))
            }] as TextContent[]
          };

        case 'get_followers':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await profileTools.getFollowers(authConfig, args))
            }] as TextContent[]
          };

        case 'get_following':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await profileTools.getFollowing(authConfig, args))
            }] as TextContent[]
          };

        // Grok tools
        case 'grok_chat':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await grokTools.grokChat(authConfig, args))
            }] as TextContent[]
          };

        // Health check
        case 'health_check':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await performHealthCheck(authConfig))
            }] as TextContent[]
          };

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    } catch (error) {
      logError(`Error executing tool ${name}`, error, { tool: name });

      if (error instanceof McpError) {
        throw error;
      }

      if (error instanceof TwitterMcpError) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`,
            isError: true
          }] as TextContent[]
        };
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // Error handler
  server.onerror = (error) => {
    logError('MCP Server Error', error);
  };

  return server;
}
