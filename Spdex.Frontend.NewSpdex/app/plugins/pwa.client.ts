/**
 * PWA 插件：
 *  - 捕获 beforeinstallprompt（安卓/桌面 Chrome 的一键安装），存单例供「添加到主屏幕」引导用
 *  - 注册 service worker（仅生产环境，避免本地 dev 的 HMR 缓存困扰）。SW 文件 public/sw.js，scope='/'
 */
import { pwaInstallPrompt } from '~/composables/usePwaInstall'

export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  // 一键安装提示（早捕获，避免错过事件）
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pwaInstallPrompt.value = e as typeof pwaInstallPrompt.value
  })
  window.addEventListener('appinstalled', () => {
    pwaInstallPrompt.value = null
  })

  // service worker 仅生产注册
  if (import.meta.dev) return
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 注册失败不影响应用使用
    })
  })
})
