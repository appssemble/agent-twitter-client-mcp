# Use a Node.js image for building the server
# (Debian-based: agent-twitter-client's native wrtc binary requires glibc,
# which Alpine/musl does not provide)
FROM node:20-slim AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies without running scripts (to avoid premature build)
RUN npm ci --ignore-scripts

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Use a smaller Node.js image for the runtime
FROM node:20-slim

# Set the working directory in the runtime image
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
# Use --ignore-scripts to prevent running the prepare script which requires tsc
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder stage
COPY --from=builder /app/build ./build

# Copy documentation
COPY README.md ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
# Serve MCP over Streamable HTTP at /mcp (set to "stdio" for stdio transport)
ENV MCP_TRANSPORT=http

# Add metadata labels
LABEL org.opencontainers.image.source="https://github.com/ryanmac/agent-twitter-client-mcp"
LABEL org.opencontainers.image.description="MCP server for Twitter integration using agent-twitter-client"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.documentation="https://github.com/ryanmac/agent-twitter-client-mcp"

# Add healthcheck (node-based: the slim image ships no wget/curl)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Expose the port
EXPOSE ${PORT}

# Start the application
CMD ["node", "build/index.js"] 