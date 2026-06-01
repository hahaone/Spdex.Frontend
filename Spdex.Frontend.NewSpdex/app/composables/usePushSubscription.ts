/**
 * Web Push 订阅（后台推送）。基于 service worker + PushManager + VAPID。
 *   - subscribe(): 申请通知权限 → 拿后端 VAPID 公钥 → pushManager.subscribe → 上报后端
 *   - unsubscribe(): 退订并通知后端清理
 * 订阅后，后台信号引擎产生新信号会主动推送，**关页/锁屏也能收到**（iOS 需先「添加到主屏幕」）。
 */

import type { ApiResponse } from '~/types/auth'

interface VapidResult {
  publicKey: string
  enabled: boolean
}

/** VAPID base64url 公钥 → Uint8Array（applicationServerKey 需要） */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export type PushSubscribeResult = { ok: boolean, reason?: string }

export function usePushSubscription() {
  const supported = ref(false)
  const subscribed = ref(false)
  const busy = ref(false)
  const permission = ref<NotificationPermission | 'unsupported'>('unsupported')

  function checkSupport(): boolean {
    if (typeof window === 'undefined') {
      supported.value = false
      return false
    }
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    supported.value = ok
    permission.value = ok ? Notification.permission : 'unsupported'
    return ok
  }

  async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null
    try {
      return await navigator.serviceWorker.ready
    }
    catch {
      return null
    }
  }

  /** 同步当前订阅状态（页面加载时调一次） */
  async function refreshState(): Promise<void> {
    if (!checkSupport()) return
    const reg = await getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    subscribed.value = !!sub
  }

  async function subscribe(): Promise<PushSubscribeResult> {
    if (!checkSupport()) return { ok: false, reason: '当前浏览器不支持推送' }
    busy.value = true
    try {
      const perm = await Notification.requestPermission()
      permission.value = perm
      if (perm !== 'granted') return { ok: false, reason: '通知权限被拒绝' }

      const vapid = await $apiFetch<ApiResponse<VapidResult>>('/api/newspdex/push/vapid-public-key')
      const pk = vapid?.data?.publicKey
      if (!pk || vapid?.data?.enabled === false) return { ok: false, reason: '服务端推送未配置' }

      const reg = await getRegistration()
      if (!reg) return { ok: false, reason: 'Service Worker 未就绪' }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pk) as BufferSource,
      })

      const json = sub.toJSON() as { endpoint?: string, keys?: { p256dh?: string, auth?: string } }
      const res = await $apiFetch<ApiResponse<unknown>>('/api/newspdex/push/subscribe', {
        method: 'POST',
        body: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        },
      })
      if (res?.code !== 0) return { ok: false, reason: res?.message || '订阅上报失败' }

      subscribed.value = true
      return { ok: true }
    }
    catch {
      return { ok: false, reason: '订阅失败，请重试' }
    }
    finally {
      busy.value = false
    }
  }

  async function unsubscribe(): Promise<boolean> {
    if (!checkSupport()) return false
    busy.value = true
    try {
      const reg = await getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await $apiFetch<ApiResponse<unknown>>('/api/newspdex/push/unsubscribe', {
          method: 'POST',
          body: { endpoint },
        }).catch(() => {})
      }
      subscribed.value = false
      return true
    }
    catch {
      return false
    }
    finally {
      busy.value = false
    }
  }

  return { supported, subscribed, busy, permission, checkSupport, refreshState, subscribe, unsubscribe }
}
