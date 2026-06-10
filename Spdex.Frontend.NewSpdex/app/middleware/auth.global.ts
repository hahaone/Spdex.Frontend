/**
 * 全局路由守卫：未登录跳 /login。
 * 基于后端 HttpOnly session cookie，与后端 /api/newspdex/auth 配合使用。
 */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/membership']

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth()

  if (PUBLIC_PATHS.includes(to.path)) return

  // 硬刷新 / 直接打开链接，useState 不跨页面持久 → 拉 /me 填充会籍 tier + 权益。
  // 避免 useAuth().tier 兜底为 'Free' 时把白金/黄金等误判为免费版。
  if (!user.value) {
    const ok = await fetchUser()
    if (!ok) return navigateTo('/login')
  }
})
