/**
 * 全局认证路由守卫。
 * 除 /login 和 /admin 页面外，所有路由都需要有效的 2026 教学频道 token。
 * 2026 教学频道不需要额外绑定口令。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path.startsWith('/admin')) return

  const token = useCookie('spdex_token')

  // 无 token → 跳转登录页
  if (!token.value) {
    return navigateTo('/login')
  }

  const { user, fetchUser } = useAuth()

  // 如果用户信息尚未加载，调用 fetchUser 获取（SSR 首次请求时）
  if (!user.value) {
    const ok = await fetchUser()
    if (!ok) {
      // fetchUser 返回 false：token 无效(已清除) 或 网络错误(token 保留)
      // 只有 token 被清除时才跳转登录页；网络错误时不要误判成“未激活”
      if (!token.value) {
        return navigateTo('/login')
      }
      return
    }
  }
})
