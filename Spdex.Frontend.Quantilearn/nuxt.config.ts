export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/devtools',
  ],

  runtimeConfig: {
    public: {
      quantilearnApiBase: process.env.NUXT_PUBLIC_QUANTILEARN_API_BASE
        ?? (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:5176'),
      buildSha: process.env.BUILD_SHA || 'dev',
      buildTime: process.env.BUILD_TIME || '',
    },
  },

  routeRules: {
    '/api/quantilearn/**': {
      proxy: { to: `${process.env.API_INTERNAL_URL || 'http://127.0.0.1:5015'}/api/quantilearn/**` },
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  components: {
    dirs: [
      { path: '~/components', pathPrefix: false },
    ],
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
      title: 'SPdex Quantilearn',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'SPdex Quantilearn sports quantitative analysis workstation' },
        { name: 'theme-color', content: '#10202b' },
      ],
    },
  },
})
