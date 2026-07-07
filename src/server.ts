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
import { WriteTools } from './tools/write.js';
import { TwitterMcpError, AuthConfig } from './types.js';
import { performHealthCheck } from './health.js';
import { logError, logInfo, sanitizeForLogging } from './utils/logger.js';

// Create tools instances
const tweetTools = new TweetTools();
const profileTools = new ProfileTools();
const writeTools = new WriteTools();

// Shared input schema for the session cookies every write tool requires. The
// acting account's cookies are supplied per call rather than from the server's
// ambient auth. Nested under `credentials` so logs redact the whole object.
const writeCredentialsSchema = {
  type: 'object',
  description: 'Session cookies for the acting Twitter/X account',
  properties: {
    authToken: {
      type: 'string',
      description: 'The account\'s auth_token cookie value'
    },
    ct0: {
      type: 'string',
      description: 'The account\'s ct0 (CSRF) cookie value'
    },
    twid: {
      type: 'string',
      description: 'The account\'s twid cookie value (e.g. "u%3D1234567890"); encodes the acting user id'
    }
  },
  required: ['authToken', 'ct0', 'twid']
} as const;

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

        // Write tools (require per-call account cookies)
        {
          name: 'post_tweet',
          description: 'Post a tweet, optionally as a reply. Requires the acting account\'s session cookies.',
          inputSchema: {
            type: 'object',
            properties: {
              credentials: writeCredentialsSchema,
              text: {
                type: 'string',
                description: 'Tweet text (1-280 characters)'
              },
              replyToTweetId: {
                type: 'string',
                description: 'ID of the tweet to reply to (optional)'
              }
            },
            required: ['credentials', 'text']
          }
        } as Tool,

        {
          name: 'follow_user',
          description: 'Follow a user by username. Requires the acting account\'s session cookies.',
          inputSchema: {
            type: 'object',
            properties: {
              credentials: writeCredentialsSchema,
              username: {
                type: 'string',
                description: 'Twitter username to follow (without @)'
              }
            },
            required: ['credentials', 'username']
          }
        } as Tool,

        {
          name: 'like_tweet',
          description: 'Like a tweet by ID. Requires the acting account\'s session cookies.',
          inputSchema: {
            type: 'object',
            properties: {
              credentials: writeCredentialsSchema,
              id: {
                type: 'string',
                description: 'Tweet ID to like'
              }
            },
            required: ['credentials', 'id']
          }
        } as Tool,

        {
          name: 'retweet',
          description: 'Retweet a tweet by ID. Requires the acting account\'s session cookies.',
          inputSchema: {
            type: 'object',
            properties: {
              credentials: writeCredentialsSchema,
              id: {
                type: 'string',
                description: 'Tweet ID to retweet'
              }
            },
            required: ['credentials', 'id']
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

        // Profile tools
        case 'get_user_profile':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await profileTools.getUserProfile(authConfig, args))
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

        // Write tools (credentials come from args, not the server auth config)
        case 'post_tweet':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await writeTools.postTweet(args))
            }] as TextContent[]
          };

        case 'follow_user':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await writeTools.followUser(args))
            }] as TextContent[]
          };

        case 'like_tweet':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await writeTools.likeTweet(args))
            }] as TextContent[]
          };

        case 'retweet':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await writeTools.retweet(args))
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
