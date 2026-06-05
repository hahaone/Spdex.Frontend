// 后台管理：SPA（ssr: false）——无 SEO 需求，简化 Naive UI 集成；Nitro server (BFF) 仍正常工作。
const requireAuth = process.env.NUXT_PUBLIC_REQUIRE_AUTH !== 'false'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  devtools: { enabled: true },

  ssr: false,

  modules: [
    '@nuxt/eslint',
    '@nuxt/devtools',
  ],

  // Naive UI（SPA 下直接全局注册，见 app/plugins/naive.ts）
  build: { transpile: ['naive-ui'] },
  vite: { optimizeDeps: { include: ['naive-ui'] } },

  runtimeConfig: {
    // 后端 WebApi 内网地址（BFF 转发用）。生产经 docker-compose 注入。
    adminApiInternalUrl: process.env.ADMIN_API_INTERNAL_URL
      || process.env.API_INTERNAL_URL
      || 'http://127.0.0.1:5000',
    public: {
      requireAuth,
      buildSha: process.env.BUILD_SHA || 'dev',
      buildTime: process.env.BUILD_TIME || '',
    },
  },

  typescript: { strict: true, typeCheck: false },

  components: {
    dirs: [{ path: '~/components', pathPrefix: false }],
  },

  css: ['~/assets/css/tailwind.css'],

  postcss: {
    plugins: { tailwindcss: {}, autoprefixer: {} },
  },

  app: {
    head: {
      title: 'SPdex 管理后台',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'robots', content: 'noindex,nofollow' },
      ],
    },
  },
})
