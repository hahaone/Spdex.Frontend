/**
 * 全局路由守卫：未登录跳 /login。
 * 基于后端 HttpOnly session cookie，与后端 /api/newspdex/auth 配合使用。
 */
import type { ApiResponse } from '~/types/auth'

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/membership']
const AI_PATH_PREFIXES = ['/ai', '/account/mcp']

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth()

  if (PUBLIC_PATHS.includes(to.path)) return

  // 硬刷新 / 直接打开链接，useState 不跨页面持久 → 拉 /me 填充会籍 tier + 权益。
  // 避免 useAuth().tier 兜底为 'Free' 时把白金/黄金等误判为免费版。
  if (!user.value) {
    const ok = await fetchUser()
    if (!ok) {
      return navigateTo({
        path: '/login',
        query: { redirect: to.fullPath },
      })
    }
  }

  if (AI_PATH_PREFIXES.some(prefix => to.path === prefix || to.path.startsWith(`${prefix}/`))) {
    try {
      const access = await $apiFetch<ApiResponse<{ enabled: boolean }>>('/api/newspdex/ai/access')
      if (access.code !== 0 || access.data?.enabled !== true) {
        return navigateTo('/')
      }
    }
    catch {
      return navigateTo('/')
    }
  }
})
