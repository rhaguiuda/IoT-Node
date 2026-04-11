# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Production dependencies only
FROM node:22-alpine AS proddeps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 3: Build
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm run build:collector

# Stage 4: Runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libstdc++
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist ./dist
COPY --from=proddeps /app/node_modules ./node_modules
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "server.js"]
