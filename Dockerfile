FROM node:25-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files first for layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY server.js ./
COPY src/ ./src/
COPY panel/ ./panel/

EXPOSE 3000

USER node

CMD ["node", "server.js"]
