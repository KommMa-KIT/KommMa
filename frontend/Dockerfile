# Multi-stage build:
# The base stage installs dependencies once.
# The dev and build stages reuse it independently.
FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# Development stage:
# Runs the development server with hot reload.
# Used with the bind mount configured in docker-compose.yml.
FROM base AS dev
ENV NODE_ENV=development
COPY . .
CMD ["npm", "start"]

# Build stage:
# Creates the static production bundle.
FROM base AS build
ARG REACT_APP_API_MODE=local
ENV NODE_ENV=production
ENV REACT_APP_API_MODE=$REACT_APP_API_MODE
COPY . .
RUN npm run build

# Production stage:
# Serves only the generated static bundle.
# No development server or source code is included.
FROM node:20-slim AS prod
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/build ./build
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]