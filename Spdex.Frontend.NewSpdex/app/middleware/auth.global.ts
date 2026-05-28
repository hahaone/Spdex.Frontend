/**
 * 全局路由守卫：未登录跳 /login。
 * 基于真实 JWT token（cookie），与后端 /api/newspdex/auth 配合使用。
 */
export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn } = useAuth()

  if (to.path === '/login') return
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
})
