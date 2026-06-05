# ── Stage 1: Build ──
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts || npm install --ignore-scripts

ARG BUILD_SHA=unknown
ARG BUILD_TIME=unknown
ARG API_INTERNAL_URL=http://127.0.0.1:5000
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}
ENV API_INTERNAL_URL=${API_INTERNAL_URL}

COPY . .
RUN npx nuxt prepare && npm run build

# ── Stage 2: Runtime ──
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=build /app/.output .output

EXPOSE 3005
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3005
ENV HOST=0.0.0.0
ENV PORT=3005
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3005
ENV API_INTERNAL_URL=http://127.0.0.1:5000

CMD ["node", ".output/server/index.mjs"]
