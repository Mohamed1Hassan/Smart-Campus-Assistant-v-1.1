# ================================
# Stage 1: Dependencies
# ================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install OpenSSL for Prisma
# Install OpenSSL for Prisma and Build Tools for Canvas
RUN apk add --no-cache openssl libc6-compat python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --legacy-peer-deps --only=production && \
    npm cache clean --force

# Generate Prisma Client
RUN npx prisma generate

# ================================
# Stage 2: Builder
# ================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install OpenSSL for Prisma and Build Tools for Canvas
# Install OpenSSL for Prisma and Build Tools for Canvas
RUN apk add --no-cache openssl libc6-compat python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies)
RUN npm ci --legacy-peer-deps

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript for server
RUN npx tsc --project tsconfig.server.json

# ================================
# Stage 3: Production Runtime
# ================================
FROM node:20-alpine AS runner
WORKDIR /app

# Install OpenSSL for Prisma
# Install OpenSSL for Prisma and Runtime for Canvas
RUN apk add --no-cache openssl libc6-compat cairo pango jpeg giflib librsvg

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy package.json and production dependencies from deps stage
COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=appuser:nodejs /app/package*.json ./

# Copy Prisma files
COPY --chown=appuser:nodejs prisma ./prisma/

# Copy compiled server code from builder
# Copy compiled server code from builder
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/config ./config
COPY --from=builder --chown=appuser:nodejs /app/src ./src

# Copy other necessary files
COPY --chown=appuser:nodejs scripts ./scripts

# Create uploads directory
RUN mkdir -p /app/uploads/avatars && \
    chown -R appuser:nodejs /app/uploads

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
# Start the server
CMD ["npm", "start"]
