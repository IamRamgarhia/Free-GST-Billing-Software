# ==============================================================================
# Multi-stage Dockerfile for Free GST Billing Software
# Stage 1: Build Vite frontend and assets
# Stage 2: Minimal, secure production container running Express API & static server
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (ignoring lifecycle scripts until code is copied)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy application source code
COPY . .

# Run prebuild (bundles offline tesseract OCR assets) and build Vite frontend to dist/
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runner
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment defaults
ENV NODE_ENV=production \
    PORT=47371 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled frontend from builder
COPY --from=builder /app/dist ./dist

# Copy backend server and utilities required by server.js
COPY server.js ./
COPY src/utils.js ./src/utils.js

# Setup persistent data folder and permissions for unprivileged node user
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user
USER node

# Expose default application port
EXPOSE 47371

# Persistent storage volume for invoices, backups, settings
VOLUME ["/app/data"]

# Health check using Express /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:47371/api/health || exit 1

# Start the unified backend and frontend server
CMD ["node", "server.js"]
