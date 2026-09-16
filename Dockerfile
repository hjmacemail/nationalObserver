FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY . .
# Users and encrypted settings live on a Railway volume (RAILWAY_VOLUME_MOUNT_PATH is detected automatically).
# Runs as root because Railway volumes are mounted root-owned.
EXPOSE 3000
CMD ["node", "server.js"]
