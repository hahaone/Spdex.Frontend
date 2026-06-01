/**
 * PWA 安装 / 运行模式检测，给「添加到主屏幕」引导用。
 *   - isStandalone: 是否已在主屏 App（PWA）模式打开
 *   - isIOS:        iOS 设备（Web Push 仅 Safari「添加到主屏幕」后可用）
 *   - canInstall:   安卓/桌面 Chrome 是否可一键安装（beforeinstallprompt 已捕获且未安装）
 *   - promptInstall(): 触发原生安装弹窗（安卓/桌面 Chrome）
 *
 * beforeinstallprompt 事件在 plugins/pwa.client.ts 里早早捕获后存入下面的单例 ref。
 */
import { computed, ref } from 'vue'

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>
}

/** 模块级单例：插件捕获到的安装提示事件 */
export const pwaInstallPrompt = ref<BeforeInstallPromptEvent | null>(null)

export function usePwaInstall() {
  const isStandalone = computed(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(display-mode: standalone)')?.matches === true
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true
  })

  const isIOS = computed(() => {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    // iPadOS 13+ 伪装成 Mac，用 maxTouchPoints 兜底识别
    return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
  })

  const canInstall = computed(() => !!pwaInstallPrompt.value && !isStandalone.value)

  async function promptInstall(): Promise<boolean> {
    const e = pwaInstallPrompt.value
    if (!e) return false
    try {
      await e.prompt()
      const choice = await e.userChoice
      pwaInstallPrompt.value = null
      return choice.outcome === 'accepted'
    }
    catch {
      return false
    }
  }

  return { isStandalone, isIOS, canInstall, promptInstall }
}
