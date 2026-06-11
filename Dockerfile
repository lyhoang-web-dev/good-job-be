# syntax=docker/dockerfile:1


# Multi-stage: compile TypeScript in a full dev graph, ship only pruned prod deps + dist.
# Runtime uses Alpine + ffmpeg (ffprobe) for the media worker.


ARG NODE_VERSION=22


FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app


# openssl: Prisma CLI needs it on Alpine to pick the right query engine (avoids openssl-1.1.x fallback).
RUN apk add --no-cache libc6-compat openssl


COPY package.json package-lock.json ./
# prisma/ must exist before npm ci — postinstall runs prisma generate.
COPY prisma ./prisma


RUN npm ci


COPY tsconfig.json tsconfig.build.json ./
COPY src ./src


RUN npm run build \
 && npm prune --omit=dev \
 && find dist \( -name '*.map' -o -name '*.d.ts' \) -delete


FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app


ENV NODE_ENV=production
ENV JWT_EXPIRES_IN=7d
ENV UPLOAD_DIR=./uploads
ENV MAX_FILE_SIZE_MB=100
ENV MAX_VIDEO_DURATION_SECS=180
ENV RATE_LIMIT_WINDOW_MS=60000
ENV RATE_LIMIT_MAX=100


# ffprobe is required at runtime (see media.worker.ts). This is the main non-Node size cost.
# su-exec: drop root after fixing ownership of upload volume (compose mounts are often root-owned).
RUN apk add --no-cache ffmpeg openssl su-exec \
 && addgroup -g 1001 -S nodejs \
 && adduser -S -u 1001 -G nodejs apiuser


COPY --from=builder --chown=apiuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=apiuser:nodejs /app/dist ./dist
COPY --from=builder --chown=apiuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=apiuser:nodejs /app/prisma ./prisma


COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh


EXPOSE 4000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]


