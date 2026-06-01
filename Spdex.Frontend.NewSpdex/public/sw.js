/* NewSpdex service worker
 * 保守缓存策略（直播数据网站，宁可不缓存也不要给用户旧数据）：
 *  - /api/**      实时数据：永不缓存，一律走网络
 *  - /_nuxt/**    带 hash 的不可变构建产物：cache-first
 *  - 导航/其它同源 GET：network-first，离线时回退缓存（降级）
 * 升级缓存版本只需改 CACHE 名。
 */
const CACHE = 'newspdex-shell-v1'
const PRECACHE = [
  '/favicon.ico',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/logo.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // 第三方：透传
  if (url.pathname.startsWith('/api')) return // API 实时数据：永不缓存

  // 带 hash 的构建产物（不可变）：cache-first
  if (url.pathname.startsWith('/_nuxt/')) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit
        || fetch(request).then((resp) => {
          const copy = resp.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return resp
        }),
      ),
    )
    return
  }

  // 导航与其它同源 GET：network-first，失败回退缓存（离线降级）
  event.respondWith(
    fetch(request)
      .then((resp) => {
        const copy = resp.clone()
        caches.open(CACHE).then((c) => c.put(request, copy))
        return resp
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/'))),
  )
})

/* ─── Web Push（后台信号推送）───
 * 后端用 VAPID 把 {title, body, url, tag} 推过来，这里 showNotification；
 * 点击通知聚焦/打开对应页面。即使页面已关闭也能收到。
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  }
  catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'SPdex 新信号'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/push' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/push'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) {
            try { client.navigate(url) }
            catch { /* 跨源等情况忽略 */ }
          }
          return undefined
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : undefined
    }),
  )
})
