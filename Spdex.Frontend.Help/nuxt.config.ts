export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/devtools',
  ],

  runtimeConfig: {
    public: {
      buildSha: process.env.BUILD_SHA || 'dev',
      buildTime: process.env.BUILD_TIME || '',
      publicBaseUrl: process.env.NUXT_PUBLIC_HELP_BASE_URL || 'https://help.spdex.com',
      newspdexUrl: process.env.NUXT_PUBLIC_NEWSPDEX_URL || 'https://new.spdex.com',
      mcpDocsUrl: process.env.NUXT_PUBLIC_MCP_DOCS_URL || '/ai/mcp-quickstart',
    },
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },

  css: ['~/assets/css/tailwind.css', '~/assets/css/global.css'],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  ssr: true,

  app: {
    head: {
      title: 'SPdex 帮助中心',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'SPdex 帮助中心，提供 AI 观察助手、SPdex AI MCP、数据口径和安全使用说明。' },
        { name: 'theme-color', content: '#0f766e' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
})
