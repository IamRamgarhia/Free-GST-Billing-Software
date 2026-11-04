# Free GST Billing - image for a NAS or server. Built by `npm run release:docker`
# (scripts/build-linux.mjs), whose build context holds the staged app in app/.
#
# Books: the /data volume (FGSB_HOME=/data). Runs as the unprivileged "node"
# user. The server answers 127.0.0.1 inside the container unless
# FGSB_ALLOW_UNSAFE_LAN=1; docker-compose.yml sets that AND publishes the port
# to the host's 127.0.0.1 only, because the app has no login yet.
FROM node:20.19.0-bookworm-slim

ENV NODE_ENV=production \
    FGSB_HOME=/data

COPY app /app
RUN echo docker > /app/install-kind.txt \
 && chown -R root:root /app \
 && chmod -R a+rX,go-w /app \
 && mkdir -p /data \
 && chown node:node /data

USER node
WORKDIR /data
VOLUME /data
EXPOSE 47371

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:47371/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# data/port.txt remembers a desktop's port; in a container the port is always
# 47371 (books copied from a PC must not move it), so that file is reset.
CMD ["sh", "-c", "rm -f /data/data/port.txt; exec node /app/server.js"]
