/**
 * 用户访问采集（仅客户端）。每次路由切换 fire-and-forget 上报一条页面访问，
 * 不阻塞导航、不抛错。登录与匿名都上报（后端按会话归属用户或记为匿名）。
 * 端(viewMode) 直接从 localStorage 偏好 + 视口宽度推断，避免在 afterEach 里依赖组件作用域的 composable。
 */
const SID_KEY = 'newspdex_track_sid'
const VIEW_MODE_KEY = 'newspdex_desktop_view_mode'
const DESKTOP_MIN_WIDTH = 1200

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SID_KEY)
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem(SID_KEY, id)
    }
    return id
  }
  catch {
    return ''
  }
}

function currentViewMode(): 'modern' | 'classic' | 'mobile' {
  if (typeof window === 'undefined' || window.innerWidth < DESKTOP_MIN_WIDTH)
    return 'mobile'
  try {
    // 桌面无显式偏好时默认经典，与 useDesktopViewMode 口径一致
    return localStorage.getItem(VIEW_MODE_KEY) === 'modern' ? 'modern' : 'classic'
  }
  catch {
    return 'classic'
  }
}

export default defineNuxtPlugin(() => {
  const router = useRouter()
  let lastPath = ''

  function track(path: string) {
    if (!path || path === lastPath) return
    lastPath = path
    // fire-and-forget：同源 /api/** 由 Nitro 代理转发并携带会话 cookie
    $fetch('/api/newspdex/track/pageview', {
      method: 'POST',
      body: { path, viewMode: currentViewMode(), sessionId: getSessionId() },
    }).catch(() => {})
  }

  // 首屏（afterEach 在初次导航后才挂上，需补一条当前路由）
  track(router.currentRoute.value.path)
  router.afterEach(to => track(to.path))
})
