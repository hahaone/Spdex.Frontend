export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/devtools',
  ],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? '',
      mockMode: process.env.NUXT_PUBLIC_MOCK_MODE !== 'false',
      buildSha: process.env.BUILD_SHA || 'dev',
      buildTime: process.env.BUILD_TIME || '',
      // 阿里云验证码2.0（默认关闭；与后端 Captcha:Enabled 必须同开同关）
      captchaEnabled: process.env.NUXT_PUBLIC_CAPTCHA_ENABLED === 'true',
      captchaSceneId: process.env.NUXT_PUBLIC_CAPTCHA_SCENE_ID || '',
      captchaPrefix: process.env.NUXT_PUBLIC_CAPTCHA_PREFIX || '',
      captchaRegion: process.env.NUXT_PUBLIC_CAPTCHA_REGION || 'cn',
      authCookieDomain: process.env.NUXT_PUBLIC_AUTH_COOKIE_DOMAIN || '',
      quantilearnFlashUrl: process.env.NUXT_PUBLIC_QUANTILEARN_FLASH_URL
        || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3004/flash' : 'https://ql.spdex.com/flash'),
    },
  },

  routeRules: {
    '/api/**': {
      proxy: { to: `${process.env.API_INTERNAL_URL || 'http://localhost:5010'}/api/**` },
    },
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },

  imports: {
    dirs: ['composables', 'types'],
  },

  components: {
    dirs: [
      { path: '~/components', pathPrefix: false },
    ],
  },

  css: ['~/assets/css/tailwind.css', '~/assets/css/global.css', '~/assets/css/classic-desktop.css'],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  ssr: true,

  app: {
    head: {
      title: 'SPdex_超级指数网提供免费必发交易量、PolyMarket预测市场成交明细、Kalshi成交量等超级指数分析',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'SPdex 超级指数系统 — 必发指数、走势图、实时赛况' },
        { name: 'theme-color', content: '#7c5cfa' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'SPdex' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
      ],
    },
  },
})
