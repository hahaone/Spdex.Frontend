export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/devtools',
  ],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:5010',
      mockMode: process.env.NUXT_PUBLIC_MOCK_MODE !== 'false',
      buildSha: process.env.BUILD_SHA || 'dev',
      buildTime: process.env.BUILD_TIME || '',
      // 阿里云验证码2.0（默认关闭；与后端 Captcha:Enabled 必须同开同关）
      captchaEnabled: process.env.NUXT_PUBLIC_CAPTCHA_ENABLED === 'true',
      captchaSceneId: process.env.NUXT_PUBLIC_CAPTCHA_SCENE_ID || '',
      captchaPrefix: process.env.NUXT_PUBLIC_CAPTCHA_PREFIX || '',
      captchaRegion: process.env.NUXT_PUBLIC_CAPTCHA_REGION || 'cn',
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
      title: '新版 SPdex',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: '新版 SPdex mobile-first prototype' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
})
