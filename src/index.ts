#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTwitterMcpServer } from './server.js';
import { startHttpServer } from './http-server.js';
import { AuthConfig } from './types.js';
import { performHealthCheck } from './health.js';
import { logError, logInfo } from './utils/logger.js';
import dotenv from 'dotenv';
import http from 'http';

// Load environment variables
dotenv.config();

// Log command-line arguments and environment variables
console.log('Command-line arguments:', process.argv);
console.log('MCP_TRANSPORT env var:', process.env.MCP_TRANSPORT);
console.log('DISABLE_HTTP_SERVER env var:', process.env.DISABLE_HTTP_SERVER);
console.log('PORT env var:', process.env.PORT);

// Configure auth from environment variables
function getAuthConfig(): AuthConfig {
  // Determine auth method
  const authMethod = process.env.AUTH_METHOD || 'cookies';

  switch (authMethod) {
    case 'cookies': {
      const cookiesStr = process.env.TWITTER_COOKIES;
      if (!cookiesStr) {
        throw new Error('TWITTER_COOKIES environment variable is required for cookie auth');
      }
      return {
        method: 'cookies',
        data: { cookies: JSON.parse(cookiesStr) }
      };
    }

    case 'credentials': {
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
    }

    case 'api': {
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
    }

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

async function runInitialHealthCheck(): Promise<void> {
  try {
    const healthStatus = await performHealthCheck(authConfig);
    logInfo('Initial health check completed', { status: healthStatus.status });

    if (healthStatus.status === 'unhealthy') {
      logError('Initial health check failed', new Error('Health check returned unhealthy status'), healthStatus.details);
    }
  } catch (error) {
    logError('Initial health check failed with error', error);
  }
}

// Start the server on stdio transport, with an auxiliary HTTP server for
// health checks (legacy behavior)
async function startStdioServer() {
  const server = createTwitterMcpServer(authConfig);
  const transport = new StdioServerTransport();
  logInfo('Starting Twitter MCP server on stdio transport...');
  await server.connect(transport);
  logInfo('Twitter MCP server running on stdio');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logInfo('Shutting down Twitter MCP server...');
    await server.close();
    process.exit(0);
  });

  await runInitialHealthCheck();

  // Start HTTP server for health checks
  const port = process.env.PORT || 3000;
  console.log(`Attempting to start HTTP server on port ${port}`);

  // Check if HTTP server should be disabled
  const disableHttpServer = process.env.DISABLE_HTTP_SERVER === 'true' ||
    process.argv.includes('--no-http-server');
  console.log(`Should HTTP server be disabled? ${disableHttpServer}`);

  if (!disableHttpServer) {
    const httpServer = http.createServer(async (req, res) => {
      if (req.url === '/health') {
        try {
          const healthStatus = await performHealthCheck(authConfig);
          res.writeHead(healthStatus.status === 'healthy' ? 200 : 503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(healthStatus));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'unhealthy', error: String(error) }));
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please specify a different port using the PORT environment variable.`);
        logError(`Port ${port} is already in use`, error);
      } else {
        logError('HTTP server error', error);
      }
    });

    httpServer.listen(port, () => {
      logInfo(`HTTP server for health checks running on port ${port}`);
    });
  } else {
    console.log('HTTP server is disabled by configuration');
  }
}

// Start the server on Streamable HTTP transport (serves /mcp and /health)
async function startHttpTransportServer() {
  const port = Number(process.env.PORT) || 3000;
  logInfo('Starting Twitter MCP server on HTTP transport...');
  const httpServer = startHttpServer(authConfig, port);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logInfo('Shutting down Twitter MCP server...');
    httpServer.close(() => process.exit(0));
  });

  await runInitialHealthCheck();
}

// Start the server
async function startServer() {
  try {
    const transportMode = (process.env.MCP_TRANSPORT || 'stdio').toLowerCase();

    switch (transportMode) {
      case 'stdio':
        await startStdioServer();
        break;
      case 'http':
        await startHttpTransportServer();
        break;
      default:
        throw new Error(`Unsupported MCP_TRANSPORT: ${transportMode} (expected 'stdio' or 'http')`);
    }
  } catch (error) {
    logError('Failed to start Twitter MCP server', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logError('Error starting Twitter MCP server', error);
  process.exit(1);
});
