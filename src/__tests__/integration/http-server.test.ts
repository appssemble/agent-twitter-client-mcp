import http from 'http';
import { AddressInfo } from 'net';
import { startHttpServer } from '../../http-server.js';
import { AuthConfig } from '../../types.js';

const authConfig: AuthConfig = {
  method: 'cookies',
  data: { cookies: [] }
};

const MCP_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream'
};

function initializeRequest() {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'jest-test-client', version: '1.0.0' }
    }
  };
}

describe('HTTP transport', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll((done) => {
    server = startHttpServer(authConfig, 0);
    server.on('listening', () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    delete process.env.MCP_AUTH_TOKEN;
    server.close(done);
  });

  afterEach(() => {
    delete process.env.MCP_AUTH_TOKEN;
  });

  test('initialize succeeds over POST /mcp', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: MCP_HEADERS,
      body: JSON.stringify(initializeRequest())
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.serverInfo.name).toBe('agent-twitter-client-mcp');
    expect(body.result.capabilities.tools).toBeDefined();
  });

  test('tools/list returns the tool catalog over POST /mcp', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: MCP_HEADERS,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    const toolNames = body.result.tools.map((tool: { name: string }) => tool.name);
    expect(toolNames).toEqual([
      'get_user_tweets',
      'get_tweet_by_id',
      'search_tweets',
      'get_user_profile',
      'get_followers',
      'get_following',
      'post_tweet',
      'follow_user',
      'like_tweet',
      'retweet',
      'health_check'
    ]);
  });

  test('rejects requests without a token when MCP_AUTH_TOKEN is set', async () => {
    process.env.MCP_AUTH_TOKEN = 'secret-token';

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: MCP_HEADERS,
      body: JSON.stringify(initializeRequest())
    });

    expect(response.status).toBe(401);
  });

  test('rejects requests with a wrong token when MCP_AUTH_TOKEN is set', async () => {
    process.env.MCP_AUTH_TOKEN = 'secret-token';

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { ...MCP_HEADERS, 'Authorization': 'Bearer wrong-token' },
      body: JSON.stringify(initializeRequest())
    });

    expect(response.status).toBe(401);
  });

  test('accepts requests with the correct token when MCP_AUTH_TOKEN is set', async () => {
    process.env.MCP_AUTH_TOKEN = 'secret-token';

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { ...MCP_HEADERS, 'Authorization': 'Bearer secret-token' },
      body: JSON.stringify(initializeRequest())
    });

    expect(response.status).toBe(200);
  });

  test('returns 405 for GET /mcp (stateless mode has no SSE stream)', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' }
    });

    expect(response.status).toBe(405);
  });

  test('GET /live returns 200 without touching Twitter', async () => {
    const response = await fetch(`${baseUrl}/live`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('returns 404 for unknown paths', async () => {
    const response = await fetch(`${baseUrl}/unknown`);
    expect(response.status).toBe(404);
  });
});
