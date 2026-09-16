# 1. Base dependencies stage
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# 2. Builder stage
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN mkdir -p /app/public
RUN npx prisma generate
RUN npm run build
RUN npx esbuild prisma/seed.ts --bundle --platform=node --format=cjs --outfile=prisma/seed.js --external:@prisma/client --external:pg --external:pgvector

# 3. Lean Production Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
RUN npm install -g prisma@5.22.0
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Expose Next.js Web Server (3000) and Telemetry WebSocket Server (3001)
EXPOSE 3000
EXPOSE 3001

# Copy standalone bundle and static assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/cases-input ./cases-input
COPY --from=builder /app/package.json ./package.json

CMD ["node", "server.js"]
