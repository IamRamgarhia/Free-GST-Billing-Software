FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=47371 \
    DATA_DIR=/data

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 47371
VOLUME ["/data"]
CMD ["node", "server.js"]
