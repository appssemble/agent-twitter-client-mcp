# agent-twitter-client-mcp Docker Image

This Docker image provides a Model Context Protocol (MCP) server that integrates with Twitter using the `agent-twitter-client` package, allowing AI models to interact with Twitter without direct API access.

## Usage

### Pull the image

```bash
docker pull ghcr.io/ryanmac/agent-twitter-client-mcp:latest
```

### Run with Docker

```bash
docker run -p 3001:3000 \
  -e AUTH_METHOD=cookies \
  -e TWITTER_COOKIES='["auth_token=YOUR_AUTH_TOKEN; Domain=.twitter.com", "ct0=YOUR_CT0_VALUE; Domain=.twitter.com"]' \
  ghcr.io/ryanmac/agent-twitter-client-mcp:latest
```

### Run with Docker Compose

Create a `.env` file with your configuration:

```
# Port Configuration
MCP_HOST_PORT=3001    # The port on your host machine
MCP_CONTAINER_PORT=3000  # The port inside the container

# Twitter Authentication
AUTH_METHOD=cookies
TWITTER_COOKIES=[]
```

Then run:

```bash
docker-compose up -d
```

### Deploy on Coolify

The repository includes `docker-compose.coolify.yml`, tailored for Coolify:

1. In Coolify, add a new resource: **Docker Compose** (public repository or
   your fork), pointing at this repository.
2. Set **Docker Compose Location** to `/docker-compose.coolify.yml`.
3. Coolify reads the compose file and automatically creates the environment
   variables in the UI:
   - `TWITTER_COOKIES` - **required** (shown first with a red border; deploy
     is blocked until you provide it). Paste your cookie JSON array.
   - `MCP_AUTH_TOKEN` - **auto-generated** secure random token. Copy it from
     the Environment Variables tab to configure your MCP clients.
   - `AUTH_METHOD` and the credential/API variables - pre-filled with
     defaults, editable if you use another auth method.
4. Set your domain on the service. The `SERVICE_FQDN_MCP_3000` magic variable
   makes Coolify route the domain (with HTTPS) to container port 3000
   automatically - no manual port mapping needed.
5. Deploy. Your MCP endpoint is `https://your-domain/mcp` and the health
   check is at `https://your-domain/health`.

### Connect an MCP client over HTTP

The container serves MCP over Streamable HTTP at `http://localhost:3001/mcp`
(a `/health` endpoint is also available). To require authentication, set
`MCP_AUTH_TOKEN`; clients must then send `Authorization: Bearer <token>`.

Example client configuration (e.g. Claude Code):

```bash
claude mcp add --transport http twitter http://localhost:3001/mcp \
  --header "Authorization: Bearer YOUR_MCP_AUTH_TOKEN"
```

## Configuration

### Environment Variables

- `PORT`: The port the server listens on inside the container (default: 3000)
- `MCP_TRANSPORT`: MCP transport mode - `http` (default in the container) or `stdio`
- `MCP_AUTH_TOKEN`: Optional bearer token protecting the `/mcp` endpoint (HTTP mode)
- `AUTH_METHOD`: Authentication method (cookies, credentials, or api)
- `TWITTER_COOKIES`: JSON array of Twitter cookies
- `TWITTER_USERNAME`: Twitter username (for credentials auth)
- `TWITTER_PASSWORD`: Twitter password (for credentials auth)
- `TWITTER_EMAIL`: Twitter email (for credentials auth)
- `TWITTER_2FA_SECRET`: Twitter 2FA secret (for credentials auth)
- `TWITTER_API_KEY`: Twitter API key (for API auth)
- `TWITTER_API_SECRET_KEY`: Twitter API secret key (for API auth)
- `TWITTER_ACCESS_TOKEN`: Twitter access token (for API auth)
- `TWITTER_ACCESS_TOKEN_SECRET`: Twitter access token secret (for API auth)

## Features

- Tweet operations (fetch, search, post, like, retweet)
- User operations (profiles, follow, followers)
- Grok integration

For more information, see the [full documentation](https://github.com/ryanmac/agent-twitter-client-mcp).
