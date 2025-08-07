# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci --only=production
RUN cd client && npm ci --only=production
RUN cd server && npm ci --only=production

# Copy application files
COPY . .

# Build React app
RUN cd client && npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app .

# Install PM2 globally
RUN npm install -g pm2

# Expose ports
EXPOSE 3000 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start application
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
