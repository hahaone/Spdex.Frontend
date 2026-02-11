// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/devtools',
    '@nuxtjs/tailwindcss',
  ],

  // Runtime config: values can be overridden by environment variables
  runtimeConfig: {
    // Server-only keys (not exposed to client)
    apiSecret: '',
    // Public keys (exposed to client via NUXT_PUBLIC_*)
    public: {
      apiBase: 'http://localhost:5000', // Spdex.WebApi default address
      buildSha: process.env.BUILD_SHA || 'dev',
      buildTime: process.env.BUILD_TIME || '',
    },
  },

  // Proxy /api requests to .NET backend
  // In Docker: API_INTERNAL_URL=http://webapi:5000
  // In development: defaults to http://localhost:5000
  routeRules: {
    '/api/**': {
      proxy: { to: `${process.env.API_INTERNAL_URL || 'http://localhost:5000'}/api/**` },
    },
  },

  // TypeScript strict mode
  typescript: {
    strict: true,
    typeCheck: true,
  },

  // Auto-import custom composables and types
  imports: {
    dirs: ['composables', 'types'],
  },

  // Global CSS
  css: ['~/assets/css/global.css'],

  // SSR enabled (default), can switch to SPA if needed
  ssr: true,

  app: {
    head: {
      title: 'SPdex\u7ade\u5f69\u5de5\u4f5c\u5ba4\u7248',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Sports data display and analysis platform' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
})
