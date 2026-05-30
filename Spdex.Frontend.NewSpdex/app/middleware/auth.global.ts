/**
 * 全局路由守卫：未登录跳 /login。
 * 基于真实 JWT token（cookie），与后端 /api/newspdex/auth 配合使用。
 */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password']

export default defineNuxtRouteMiddleware(async (to) => {
  const { isLoggedIn, user, fetchUser } = useAuth()

  if (PUBLIC_PATHS.includes(to.path)) return
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }

  // 有 token 但 user 未水合（硬刷新 / 直接打开链接，useState 不跨页面持久）→ 拉 /me 填充会籍 tier + 权益。
  // 否则 useAuth().tier 兜底为 'Free'，首页会员中心、顶栏 tier 徽章、useEntitlements 都会把白金/黄金等误判为免费版。
  if (import.meta.client && !user.value) {
    const ok = await fetchUser()
    if (!ok) return navigateTo('/login')
  }
})
