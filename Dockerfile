# Multi-stage: сборка фронтенда и запуск Node
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.js ./
COPY routes ./routes
COPY services ./services
COPY telegram ./telegram
COPY models ./models
COPY public ./public

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
