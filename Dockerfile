# Node 20 slim with tools needed for c2pa-node
FROM node:20-slim

# Install minimal dependencies (openssl, ca-certificates) and clean up
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

# Support both Lambda and ECS/Fargate
# For Lambda: use CMD with lambda.handler
# For ECS/Fargate: use CMD with node server.js

EXPOSE 3000

# Default to server mode (can be overridden for Lambda)
CMD ["node", "server.js"]
