FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force && mkdir /data && chown node:node /data
COPY *.mjs ./
USER node
VOLUME /data
EXPOSE 8080
CMD ["node", "server.mjs"]
