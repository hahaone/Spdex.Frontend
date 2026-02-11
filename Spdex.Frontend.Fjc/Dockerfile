# ── Stage 1: Build ──
FROM node:22-alpine AS build
WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy everything and build
COPY . .
RUN npm run build

# ── Stage 2: Runtime ──
FROM node:22-alpine AS runtime
WORKDIR /app

# Copy only the built output
COPY --from=build /app/.output .output

EXPOSE 3000
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

CMD ["node", ".output/server/index.mjs"]
