/**
 * 注册 PWA service worker（仅生产环境，避免本地 dev 的 HMR 缓存困扰）。
 * SW 文件 public/sw.js，scope = '/'。
 */
export default defineNuxtPlugin(() => {
  if (import.meta.dev) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 注册失败不影响应用使用
    })
  })
})
