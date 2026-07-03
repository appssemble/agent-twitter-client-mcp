import http from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createTwitterMcpServer } from './server.js';
import { AuthConfig } from './types.js';
import { performHealthCheck } from './health.js';
import { logError, logInfo } from './utils/logger.js';

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function isAuthorized(req: http.IncomingMessage): boolean {
  const expectedToken = process.env.MCP_AUTH_TOKEN;
  if (!expectedToken) {
    return true;
  }
  const authHeader = req.headers.authorization;
  return authHeader === `Bearer ${expectedToken}`;
}

// Streamable HTTP transport in stateless mode: a fresh server and transport
// per request, so the container can be scaled horizontally without sticky
// sessions.
async function handleMcpRequest(
  authConfig: AuthConfig,
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  if (!isAuthorized(req)) {
    sendJson(res, 401, {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Unauthorized' },
      id: null
    });
    return;
  }

  if (req.method !== 'POST') {
    // Stateless mode: no SSE notification stream, no sessions to delete
    sendJson(res, 405, {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed' },
      id: null
    });
    return;
  }

  const server = createTwitterMcpServer(authConfig);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on('close', () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    logError('Error handling MCP request', error);
    if (!res.headersSent) {
      sendJson(res, 500, {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
}

async function handleHealthRequest(
  authConfig: AuthConfig,
  res: http.ServerResponse
): Promise<void> {
  try {
    const healthStatus = await performHealthCheck(authConfig);
    sendJson(res, healthStatus.status === 'healthy' ? 200 : 503, healthStatus);
  } catch (error) {
    sendJson(res, 500, { status: 'unhealthy', error: String(error) });
  }
}

export function startHttpServer(authConfig: AuthConfig, port: number): http.Server {
  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/mcp') {
      await handleMcpRequest(authConfig, req, res);
    } else if (url.pathname === '/health') {
      await handleHealthRequest(authConfig, res);
    } else {
      sendJson(res, 404, { error: 'Not found' });
    }
  });

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logError(`Port ${port} is already in use. Please specify a different port using the PORT environment variable.`, error);
    } else {
      logError('HTTP server error', error);
    }
  });

  httpServer.listen(port, () => {
    logInfo(`Twitter MCP server running on HTTP transport at http://0.0.0.0:${port}/mcp`);
    if (!process.env.MCP_AUTH_TOKEN) {
      logInfo('MCP_AUTH_TOKEN is not set - the /mcp endpoint is unauthenticated');
    }
  });

  return httpServer;
}
