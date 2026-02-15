/**
 * 全局认证路由守卫。
 * 除 /login 和 /activate 页面外，所有路由都需要有效的 token 和已激活的令牌。
 * 无 token → 跳转登录页；未激活令牌 → 跳转激活页。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // 登录页和激活页不需要拦截
  if (to.path === '/login' || to.path === '/activate') return

  const token = useCookie('spdex_token')

  // 无 token → 跳转登录页
  if (!token.value) {
    return navigateTo('/login')
  }

  // 检查令牌激活状态
  const { user, fetchUser } = useAuth()

  // 如果用户信息尚未加载，调用 fetchUser 获取（SSR 首次请求时）
  if (!user.value) {
    const ok = await fetchUser()
    if (!ok) {
      return navigateTo('/login')
    }
  }

  // 未激活令牌 → 跳转激活页
  if (!user.value?.tokenType) {
    return navigateTo('/activate')
  }
})
