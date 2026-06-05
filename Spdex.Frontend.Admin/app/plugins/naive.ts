import naive from 'naive-ui'

// SPA 模式下全局注册 Naive UI 所有组件。
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(naive)
})
