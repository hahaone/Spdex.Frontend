# ── Stage 1: Build ──
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

ARG BUILD_SHA=unknown
ARG BUILD_TIME=unknown
ARG NUXT_PUBLIC_HELP_BASE_URL=https://help.spdex.com
ARG NUXT_PUBLIC_NEWSPDEX_URL=https://new.spdex.com
ARG NUXT_PUBLIC_MCP_DOCS_URL=/ai/mcp-quickstart
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}
ENV NUXT_PUBLIC_HELP_BASE_URL=${NUXT_PUBLIC_HELP_BASE_URL}
ENV NUXT_PUBLIC_NEWSPDEX_URL=${NUXT_PUBLIC_NEWSPDEX_URL}
ENV NUXT_PUBLIC_MCP_DOCS_URL=${NUXT_PUBLIC_MCP_DOCS_URL}

COPY . .
RUN npx nuxt prepare && npm run build

# ── Stage 2: Runtime ──
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=build /app/.output .output

EXPOSE 3006
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3006
ENV HOST=0.0.0.0
ENV PORT=3006
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3006
ENV NUXT_PUBLIC_PUBLIC_BASE_URL=https://help.spdex.com

CMD ["node", ".output/server/index.mjs"]
