# HTTP Transport Support — Design

**Date:** 2026-07-03
**Goal:** Allow agent-twitter-client-mcp to be deployed as a Docker container serving as an HTTP MCP server, while keeping existing stdio usage working.

> Note: the user was unavailable during the design Q&A, so the recommended
> defaults below were chosen autonomously. Each is easy to revisit.

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| Transport flavor | Streamable HTTP only (`POST /mcp`) | Current MCP spec standard; supported by all modern clients. Legacy SSE is deprecated and adds maintenance burden. |
| Endpoint auth | Optional bearer token via `MCP_AUTH_TOKEN` env var | The container holds live Twitter credentials; anyone reaching the port could tweet as the owner. When the var is unset, no auth is enforced (private-network deployments). |
| Mode selection | `MCP_TRANSPORT=http\|stdio`, default `stdio` | No breaking change for existing npx/local users. The Dockerfile sets `MCP_TRANSPORT=http`. |
| Sessions | Stateless (`sessionIdGenerator: undefined`) | The server holds no per-session state (auth comes from env vars) and sends no server-initiated notifications. Stateless keeps Docker deployments horizontally scalable with no sticky sessions. |

## Architecture

```
src/index.ts          entry point: dotenv, auth config, transport selection
src/server.ts         createTwitterMcpServer(authConfig) factory
                      (tool list + call handlers, moved out of index.ts)
src/http-server.ts    startHttpServer(authConfig, port)
                      - POST /mcp  -> bearer check -> fresh Server + fresh
                        StreamableHTTPServerTransport per request (stateless
                        pattern from the MCP SDK docs), handleRequest()
                      - GET/DELETE /mcp -> 405 (no SSE stream / no sessions)
                      - GET /health -> existing performHealthCheck()
```

- **Stdio mode** behaves exactly as today: stdio MCP transport plus the
  auxiliary health-check HTTP server (still controlled by
  `DISABLE_HTTP_SERVER` / `--no-http-server`).
- **HTTP mode** runs a single Node `http` server on `PORT` (default 3000)
  serving both `/mcp` and `/health`. No Express/Hono dependency is added;
  the SDK transport works directly with Node request/response objects.
- Per stateless SDK guidance, each `POST /mcp` creates a fresh `Server`
  instance and transport, and closes them when the response ends. This is
  why the server construction moves into a factory.

## Error handling

- Malformed JSON / protocol errors: handled by the SDK transport (JSON-RPC
  error responses).
- Missing/wrong bearer token when `MCP_AUTH_TOKEN` is set: `401` with a
  JSON-RPC error body.
- Unknown paths: `404` JSON body (as today).
- Tool errors: unchanged — existing TwitterMcpError/McpError handling moves
  with the handlers into `server.ts`.

## Docker

- `Dockerfile`: add `ENV MCP_TRANSPORT=http`. Healthcheck already targets
  `/health` and keeps working.
- `docker-compose.yml`: add `MCP_TRANSPORT=http` and `MCP_AUTH_TOKEN`
  passthrough.

## Testing

- Jest integration test (`src/__tests__/integration/http-server.test.ts`):
  starts the HTTP server on an ephemeral port and asserts:
  - `initialize` + `tools/list` succeed over `POST /mcp` (no Twitter auth
    needed for these);
  - requests without/with wrong token get `401` when `MCP_AUTH_TOKEN` is set;
  - `GET /health` responds.
- Manual verification: `curl` against a locally running server and a smoke
  test of the built Docker image.
