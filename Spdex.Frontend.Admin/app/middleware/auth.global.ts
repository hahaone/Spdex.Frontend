export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig()
  if (!config.public.requireAuth) return
  if (to.path === '/login') return

  const { admin, fetchMe } = useAuth()
  if (admin.value) return

  const me = await fetchMe()
  if (!me) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
