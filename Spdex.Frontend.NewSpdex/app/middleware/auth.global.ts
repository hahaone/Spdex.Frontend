/**
 * 全局路由守卫：未登录跳 /login。
 * 基于真实 JWT token（cookie），与后端 /api/newspdex/auth 配合使用。
 */
const PUBLIC_PATHS = ['/login', '/register']

export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn } = useAuth()

  if (PUBLIC_PATHS.includes(to.path)) return
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
})
