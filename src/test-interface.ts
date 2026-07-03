#!/usr/bin/env node
import { TwitterClient } from './twitter-client.js';
import { AuthConfig } from './types.js';
import { performHealthCheck } from './health.js';
import { logInfo, logError } from './utils/logger.js';
import dotenv from 'dotenv';
import readline from 'readline';
import { TweetTools } from './tools/tweets.js';
import { ProfileTools } from './tools/profiles.js';

// Load environment variables
dotenv.config();

// Create tools instances
const tweetTools = new TweetTools();
const profileTools = new ProfileTools();
const client = new TwitterClient();

// Configure auth from environment variables
function getAuthConfig(): AuthConfig {
  // Determine auth method
  const authMethod = process.env.AUTH_METHOD || 'cookies';
  
  switch (authMethod) {
    case 'cookies':
      const cookiesStr = process.env.TWITTER_COOKIES;
      if (!cookiesStr) {
        throw new Error('TWITTER_COOKIES environment variable is required for cookie auth');
      }
      return {
        method: 'cookies',
        data: { cookies: JSON.parse(cookiesStr) }
      };
    
    case 'credentials':
      const username = process.env.TWITTER_USERNAME;
      const password = process.env.TWITTER_PASSWORD;
      if (!username || !password) {
        throw new Error('TWITTER_USERNAME and TWITTER_PASSWORD are required for credential auth');
      }
      return {
        method: 'credentials',
        data: {
          username,
          password,
          email: process.env.TWITTER_EMAIL,
          twoFactorSecret: process.env.TWITTER_2FA_SECRET
        }
      };
    
    case 'api':
      const apiKey = process.env.TWITTER_API_KEY;
      const apiSecretKey = process.env.TWITTER_API_SECRET_KEY;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
      if (!apiKey || !apiSecretKey || !accessToken || !accessTokenSecret) {
        throw new Error('API credentials are required for API auth');
      }
      return {
        method: 'api',
        data: {
          apiKey,
          apiSecretKey,
          accessToken,
          accessTokenSecret
        }
      };
    
    default:
      throw new Error(`Unsupported auth method: ${authMethod}`);
  }
}

// Get auth config
let authConfig: AuthConfig;
try {
  authConfig = getAuthConfig();
  logInfo('Authentication configuration loaded', { method: authConfig.method });
} catch (error) {
  logError('Failed to load authentication configuration', error);
  process.exit(1);
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Available test commands
const commands = {
  'health': 'Run a health check',
  'profile <username>': 'Get a user profile',
  'tweets <username> [count]': 'Get tweets from a user',
  'tweet <id>': 'Get a specific tweet by ID',
  'search <query> [count]': 'Search for tweets',
  'followers <userId> [count]': 'Get a user\'s followers',
  'following <userId> [count]': 'Get users a user is following',
  'help': 'Show available commands',
  'exit': 'Exit the test interface'
};

// Show welcome message
console.log('\n🐦 Twitter MCP Test Interface 🐦\n');
console.log('Type a command to test the MCP functionality. Type "help" to see available commands.\n');

// Process commands
async function processCommand(input: string) {
  const args = input.trim().split(' ');
  const command = args[0].toLowerCase();

  try {
    switch (command) {
      case 'health':
        console.log('Running health check...');
        const healthResult = await performHealthCheck(authConfig);
        console.log(JSON.stringify(healthResult, null, 2));
        break;

      case 'profile':
        if (!args[1]) {
          console.log('Error: Username is required');
          break;
        }
        console.log(`Getting profile for ${args[1]}...`);
        const profileResult = await profileTools.getUserProfile(authConfig, { username: args[1] });
        console.log(JSON.stringify(profileResult, null, 2));
        break;

      case 'tweets':
        if (!args[1]) {
          console.log('Error: Username is required');
          break;
        }
        const count = args[2] ? parseInt(args[2]) : 10;
        console.log(`Getting ${count} tweets from ${args[1]}...`);
        const tweetsResult = await tweetTools.getUserTweets(authConfig, { 
          username: args[1], 
          count, 
          includeReplies: false, 
          includeRetweets: true 
        });
        console.log(JSON.stringify(tweetsResult, null, 2));
        break;

      case 'tweet':
        if (!args[1]) {
          console.log('Error: Tweet ID is required');
          break;
        }
        console.log(`Getting tweet ${args[1]}...`);
        const tweetResult = await tweetTools.getTweetById(authConfig, { id: args[1] });
        console.log(JSON.stringify(tweetResult, null, 2));
        break;

      case 'search':
        if (!args[1]) {
          console.log('Error: Search query is required');
          break;
        }
        const searchCount = args[2] ? parseInt(args[2]) : 10;
        console.log(`Searching for "${args[1]}"...`);
        const searchResult = await tweetTools.searchTweets(authConfig, { 
          query: args[1], 
          count: searchCount, 
          searchMode: 'Top' 
        });
        console.log(JSON.stringify(searchResult, null, 2));
        break;

      case 'followers':
        if (!args[1]) {
          console.log('Error: User ID is required');
          break;
        }
        const followersCount = args[2] ? parseInt(args[2]) : 10;
        console.log(`Getting ${followersCount} followers for user ${args[1]}...`);
        const followersResult = await profileTools.getFollowers(authConfig, { 
          userId: args[1], 
          count: followersCount 
        });
        console.log(JSON.stringify(followersResult, null, 2));
        break;

      case 'following':
        if (!args[1]) {
          console.log('Error: User ID is required');
          break;
        }
        const followingCount = args[2] ? parseInt(args[2]) : 10;
        console.log(`Getting ${followingCount} following for user ${args[1]}...`);
        const followingResult = await profileTools.getFollowing(authConfig, { 
          userId: args[1], 
          count: followingCount 
        });
        console.log(JSON.stringify(followingResult, null, 2));
        break;

      case 'help':
        console.log('\nAvailable commands:');
        Object.entries(commands).forEach(([cmd, desc]) => {
          console.log(`  ${cmd.padEnd(25)} ${desc}`);
        });
        console.log();
        break;

      case 'exit':
        console.log('Exiting test interface...');
        rl.close();
        process.exit(0);
        break;

      default:
        console.log(`Unknown command: ${command}`);
        console.log('Type "help" to see available commands.');
        break;
    }
  } catch (error) {
    logError(`Error executing command ${command}`, error);
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Prompt for next command
  rl.prompt();
}

// Start the command loop
rl.setPrompt('agent-twitter-client-mcp> ');
rl.prompt();
rl.on('line', async (line) => {
  await processCommand(line);
}).on('close', () => {
  console.log('Goodbye!');
  process.exit(0);
}); 